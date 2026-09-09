local BODY_MAX = 1000
local GROUP_NAME_MAX = 30
local GROUP_MEMBER_MAX = 8
local PAGE_SIZE = 50

local function pushTo(number, payload)
    local tgt = GetSourceByNumber(number)
    if not tgt then
        if Config.Debug then print(('^3[XS-Phone]^0 text to %s not pushed: offline'):format(number)) end
        return
    end
    local settings = GetSettingsByNumber(number)
    if settings and settings.airplane then
        if Config.Debug then print(('^3[XS-Phone]^0 text to %s not pushed: airplane mode'):format(number)) end
        return
    end
    local sender = payload.message and payload.message.sender
    if sender then
        payload.fromName = MySQL.scalar.await(
            'SELECT name FROM phone_contacts WHERE owner_number = ? AND saved_number = ?',
            { number, sender }) or sender
    end
    TriggerClientEvent('XS-Phone:client:newMessage', tgt, payload)
end

local function isMember(threadId, number)
    return MySQL.scalar.await(
        'SELECT 1 FROM phone_thread_members WHERE thread_id = ? AND number = ?',
        { threadId, number }) ~= nil
end

local function findDirectThread(a, b)
    return MySQL.scalar.await([[
        SELECT t.id FROM phone_threads t
        JOIN phone_thread_members m1 ON m1.thread_id = t.id AND m1.number = ?
        JOIN phone_thread_members m2 ON m2.thread_id = t.id AND m2.number = ?
        WHERE t.is_group = 0 LIMIT 1
    ]], { a, b })
end

local function createThread(isGroup, name, members)
    local id = MySQL.insert.await(
        'INSERT INTO phone_threads (is_group, name) VALUES (?, ?)',
        { isGroup and 1 or 0, name })
    for _, n in ipairs(members) do
        MySQL.insert.await(
            'INSERT INTO phone_thread_members (thread_id, number) VALUES (?, ?)', { id, n })
    end
    return id
end

local function deliver(threadId, sender, body, mediaUrl)
    local msgId = MySQL.insert.await(
        'INSERT INTO phone_messages (thread_id, sender_number, body, media_url) VALUES (?, ?, ?, ?)',
        { threadId, sender, body, mediaUrl })
    MySQL.update.await(
        'UPDATE phone_thread_members SET last_read = ? WHERE thread_id = ? AND number = ?',
        { msgId, threadId, sender })

    local message = {
        id = msgId, threadId = threadId, sender = sender,
        body = body, media = mediaUrl, sentAt = os.time() * 1000,
    }

    local others = MySQL.query.await(
        'SELECT number, muted FROM phone_thread_members WHERE thread_id = ? AND number != ?',
        { threadId, sender })
    for _, m in ipairs(others) do
        if DbBool(m.muted) then
            if Config.Debug then print(('^3[XS-Phone]^0 text to %s not pushed: thread muted (muted=%s)'):format(m.number, tostring(m.muted))) end
        elseif IsBlockedBy(m.number, sender) then
            if Config.Debug then print(('^3[XS-Phone]^0 text to %s not pushed: sender %s blocked'):format(m.number, sender)) end
        else
            pushTo(m.number, { threadId = threadId, message = message })
        end
    end
    return message
end

PhoneCallback('XS-Phone:messages:threads', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local rows = MySQL.query.await([[
        SELECT t.id, t.is_group AS isGroup, t.name, tm.muted, tm.last_read,
            (SELECT GROUP_CONCAT(number) FROM phone_thread_members
                WHERE thread_id = t.id AND number != tm.number) AS others,
            (SELECT COUNT(*) FROM phone_messages m
                WHERE m.thread_id = t.id AND m.id > tm.last_read
                  AND m.sender_number != tm.number) AS unread,
            lm.body AS lastBody, lm.media_url AS lastMedia, lm.sender_number AS lastSender,
            UNIX_TIMESTAMP(lm.sent_at) * 1000 AS lastAt
        FROM phone_thread_members tm
        JOIN phone_threads t ON t.id = tm.thread_id
        LEFT JOIN phone_messages lm
            ON lm.id = (SELECT MAX(id) FROM phone_messages WHERE thread_id = t.id)
        WHERE tm.number = ?
        ORDER BY COALESCE(lm.sent_at, t.created_at) DESC
    ]], { me })

    for _, r in ipairs(rows) do
        r.others = r.others and { string.strsplit(',', r.others) } or {}
    end
    return { ok = true, data = rows, me = me }
end)

PhoneCallback('XS-Phone:messages:getThread', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local threadId = tonumber(data and data.threadId)
    if not threadId or not isMember(threadId, me) then return { ok = false, error = 'not_member' } end

    local before = tonumber(data.before)
    local rows = MySQL.query.await([[
        SELECT id, sender_number AS sender, body, media_url AS media,
               UNIX_TIMESTAMP(sent_at) * 1000 AS sentAt
        FROM phone_messages
        WHERE thread_id = ? AND (? IS NULL OR id < ?)
        ORDER BY id DESC LIMIT ?
    ]], { threadId, before, before, PAGE_SIZE + 1 })

    local hasMore = #rows > PAGE_SIZE
    if hasMore then rows[#rows] = nil end
    local messages = {}
    for i = #rows, 1, -1 do messages[#messages + 1] = rows[i] end

    if not before then
        MySQL.update.await([[
            UPDATE phone_thread_members
            SET last_read = COALESCE((SELECT MAX(id) FROM phone_messages WHERE thread_id = ?), last_read)
            WHERE thread_id = ? AND number = ?
        ]], { threadId, threadId, me })
    end

    return { ok = true, data = { messages = messages, hasMore = hasMore } }
end)

PhoneCallback('XS-Phone:messages:markRead', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local threadId = tonumber(data and data.threadId)
    if not threadId then return { ok = false, error = 'bad_payload' } end

    MySQL.update.await([[
        UPDATE phone_thread_members
        SET last_read = COALESCE((SELECT MAX(id) FROM phone_messages WHERE thread_id = ?), last_read)
        WHERE thread_id = ? AND number = ?
    ]], { threadId, threadId, me })
    return { ok = true }
end)

PhoneCallback('XS-Phone:messages:send', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'sendMessage') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local body = tostring(data.body or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, BODY_MAX)

    local mediaUrl = nil
    if data.mediaUrl ~= nil then
        mediaUrl = tostring(data.mediaUrl)
        if not OwnsPhoto(me, mediaUrl) then return { ok = false, error = 'bad_media' } end
    end
    if body == '' and not mediaUrl then return { ok = false, error = 'empty' } end

    local threadId = tonumber(data.threadId)
    if threadId then
        if not isMember(threadId, me) then return { ok = false, error = 'not_member' } end
    else
        local to
        local biz, lines = ResolveBusinessLine(data.to, me)
        if biz then
            if not lines or #lines == 0 then return { ok = false, error = 'invalid_number' } end
            to = lines[math.random(#lines)]
        else
            to = NormalizeNumber(data.to or '')
        end
        if not to or to == me then return { ok = false, error = 'invalid_number' } end
        local exists = MySQL.scalar.await('SELECT 1 FROM phone_phones WHERE number = ?', { to })
        if not exists then return { ok = false, error = 'invalid_number' } end
        threadId = findDirectThread(me, to) or createThread(false, nil, { me, to })
    end

    local message = deliver(threadId, me, body, mediaUrl)
    return { ok = true, data = message }
end)

PhoneCallback('XS-Phone:messages:createGroup', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'threadWrite') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local name = tostring(data.name or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, GROUP_NAME_MAX)
    if name == '' then return { ok = false, error = 'bad_name' } end

    if type(data.members) ~= 'table' then return { ok = false, error = 'bad_members' } end
    local members, seen = { me }, { [me] = true }
    for _, raw in ipairs(data.members) do
        local n = NormalizeNumber(tostring(raw))
        if n and not seen[n] then
            local exists = MySQL.scalar.await('SELECT 1 FROM phone_phones WHERE number = ?', { n })
            if exists then
                seen[n] = true
                members[#members + 1] = n
            end
        end
    end
    if #members < 2 then return { ok = false, error = 'bad_members' } end
    if #members > GROUP_MEMBER_MAX then return { ok = false, error = 'too_many' } end

    local threadId = createThread(true, name, members)
    for _, n in ipairs(members) do
        if n ~= me then
            local tgt = GetSourceByNumber(n)
            if tgt then
                TriggerClientEvent('XS-Phone:client:pushNotify', tgt, {
                    app = 'messages', title = name, body = 'You were added to a group.',
                })
            end
        end
    end
    return { ok = true, data = { threadId = threadId } }
end)

PhoneCallback('XS-Phone:messages:toggleMute', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    MySQL.update.await(
        'UPDATE phone_thread_members SET muted = 1 - muted WHERE thread_id = ? AND number = ?',
        { tonumber(data and data.threadId) or 0, me })
    return { ok = true }
end)

PhoneCallback('XS-Phone:messages:leave', function(src, data)
    if not RateOK(src, 'threadWrite') then return { ok = false, error = 'rate_limited' } end
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local threadId = tonumber(data and data.threadId) or 0

    MySQL.update.await(
        'DELETE FROM phone_thread_members WHERE thread_id = ? AND number = ?', { threadId, me })

    local remaining = MySQL.scalar.await(
        'SELECT COUNT(*) FROM phone_thread_members WHERE thread_id = ?', { threadId }) or 0
    if remaining == 0 then
        MySQL.update.await('DELETE FROM phone_messages WHERE thread_id = ?', { threadId })
        MySQL.update.await('DELETE FROM phone_threads WHERE id = ?', { threadId })
    end
    return { ok = true }
end)

exports('SendMessage', function(fromDisplay, number, body)
    local service = tostring(fromDisplay or ''):upper():gsub('[^%w]', ''):sub(1, 12)
    body = tostring(body or ''):sub(1, BODY_MAX)
    if service == '' or body == '' then return false end

    number = NormalizeNumber(tostring(number or '')) or number
    local exists = MySQL.scalar.await('SELECT 1 FROM phone_phones WHERE number = ?', { number })
    if not exists then return false end

    AwaitDB()
    local threadId = findDirectThread(service, number)
        or createThread(false, nil, { service, number })
    deliver(threadId, service, body)
    return true
end)
