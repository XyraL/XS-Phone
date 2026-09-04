local MSG_MAX = 500
local ROOM_KEEP = 300

local ALIAS_WORDS = { 'ghost', 'viper', 'static', 'cinder', 'howl', 'jackal',
    'raven', 'drift', 'echo', 'hex', 'omen', 'shade' }

local function randomAlias()
    return ('%s_%03d'):format(ALIAS_WORDS[math.random(#ALIAS_WORDS)], math.random(0, 999))
end

local function generateCode()
    local chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    for _ = 1, 50 do
        local code = ''
        for _ = 1, 6 do
            local i = math.random(#chars)
            code = code .. chars:sub(i, i)
        end
        local taken = MySQL.scalar.await(
            'SELECT 1 FROM phone_darkchat_rooms WHERE code = ?', { code })
        if not taken then return code end
    end
    error('darkchat code space exhausted')
end

local function membership(roomId, number)
    return MySQL.single.await(
        'SELECT handle FROM phone_darkchat_members WHERE room_id = ? AND number = ?',
        { roomId, number })
end

local function cleanAlias(input)
    local alias = tostring(input or ''):lower():gsub('[^%w_]', ''):sub(1, 20)
    if #alias < 3 then alias = randomAlias() end
    return alias
end

PhoneCallback('cipher-phone:darkchat:rooms', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local rows = MySQL.query.await([[
        SELECT r.id, r.code, r.name, m.handle,
            (SELECT COUNT(*) FROM phone_darkchat_members WHERE room_id = r.id) AS members
        FROM phone_darkchat_members m
        JOIN phone_darkchat_rooms r ON r.id = m.room_id
        WHERE m.number = ?
        ORDER BY r.id DESC
    ]], { me })
    return { ok = true, data = rows }
end)

PhoneCallback('cipher-phone:darkchat:create', function(src, data)
    if not RateOK(src, 'darkchatRoom') then return { ok = false, error = 'rate_limited' } end
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local name = tostring(data and data.name or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, 30)
    if name == '' then return { ok = false, error = 'bad_name' } end
    local alias = cleanAlias(data and data.alias)

    local code = generateCode()
    local roomId = MySQL.insert.await(
        'INSERT INTO phone_darkchat_rooms (code, name) VALUES (?, ?)', { code, name })
    MySQL.insert.await(
        'INSERT INTO phone_darkchat_members (room_id, number, handle) VALUES (?, ?, ?)',
        { roomId, me, alias })

    return { ok = true, data = { id = roomId, code = code, name = name, handle = alias } }
end)

PhoneCallback('cipher-phone:darkchat:join', function(src, data)
    if not RateOK(src, 'darkchatRoom') then return { ok = false, error = 'rate_limited' } end
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local code = tostring(data and data.code or ''):upper():gsub('%s', '')
    local room = MySQL.single.await(
        'SELECT id, code, name FROM phone_darkchat_rooms WHERE code = ?', { code })
    if not room then return { ok = false, error = 'gone' } end
    if membership(room.id, me) then return { ok = false, error = 'already' } end

    local alias = cleanAlias(data and data.alias)
    local ok = pcall(MySQL.insert.await,
        'INSERT INTO phone_darkchat_members (room_id, number, handle) VALUES (?, ?, ?)',
        { room.id, me, alias })
    if not ok then return { ok = false, error = 'already' } end

    return { ok = true, data = { id = room.id, code = room.code, name = room.name, handle = alias } }
end)

PhoneCallback('cipher-phone:darkchat:messages', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local roomId = tonumber(data and data.roomId) or 0
    local mine = membership(roomId, me)
    if not mine then return { ok = false, error = 'not_member' } end

    local rows = MySQL.query.await([[
        SELECT id, handle, body, UNIX_TIMESTAMP(sent_at) * 1000 AS at
        FROM phone_darkchat_messages WHERE room_id = ?
        ORDER BY id DESC LIMIT 100
    ]], { roomId })
    local flipped = {}
    for i = #rows, 1, -1 do flipped[#flipped + 1] = rows[i] end
    return { ok = true, data = { messages = flipped, myHandle = mine.handle } }
end)

PhoneCallback('cipher-phone:darkchat:send', function(src, data)
    if not RateOK(src, 'darkchatSend') then return { ok = false, error = 'rate_limited' } end
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local roomId = tonumber(data and data.roomId) or 0
    local mine = membership(roomId, me)
    if not mine then return { ok = false, error = 'not_member' } end

    local body = tostring(data.body or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, MSG_MAX)
    if body == '' then return { ok = false, error = 'empty' } end

    local msgId = MySQL.insert.await(
        'INSERT INTO phone_darkchat_messages (room_id, handle, body) VALUES (?, ?, ?)',
        { roomId, mine.handle, body })

    local cutoff = MySQL.scalar.await([[
        SELECT id FROM phone_darkchat_messages WHERE room_id = ?
        ORDER BY id DESC LIMIT 1 OFFSET ?
    ]], { roomId, ROOM_KEEP })
    if cutoff then
        MySQL.update.await(
            'DELETE FROM phone_darkchat_messages WHERE room_id = ? AND id <= ?',
            { roomId, cutoff })
    end

    local message = { id = msgId, roomId = roomId, handle = mine.handle, body = body, at = os.time() * 1000 }

    local members = MySQL.query.await(
        'SELECT number FROM phone_darkchat_members WHERE room_id = ? AND number != ?',
        { roomId, me })
    for _, m in ipairs(members) do
        local tgt = GetSourceByNumber(m.number)
        if tgt then
            TriggerClientEvent('cipher-phone:client:darkchat', tgt, { roomId = roomId, message = message })
        end
    end

    return { ok = true, data = message }
end)

PhoneCallback('cipher-phone:darkchat:leave', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local roomId = tonumber(data and data.roomId) or 0

    MySQL.update.await(
        'DELETE FROM phone_darkchat_members WHERE room_id = ? AND number = ?', { roomId, me })
    local remaining = MySQL.scalar.await(
        'SELECT COUNT(*) FROM phone_darkchat_members WHERE room_id = ?', { roomId }) or 0
    if remaining == 0 then
        MySQL.update.await('DELETE FROM phone_darkchat_messages WHERE room_id = ?', { roomId })
        MySQL.update.await('DELETE FROM phone_darkchat_rooms WHERE id = ?', { roomId })
    end
    return { ok = true }
end)
