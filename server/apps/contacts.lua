local NAME_MAX = 50

local function cleanName(name)
    if type(name) ~= 'string' then return nil end
    name = name:gsub('^%s+', ''):gsub('%s+$', ''):sub(1, NAME_MAX)
    if name == '' then return nil end
    return name
end

PhoneCallback('cipher-phone:contacts:list', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local rows = MySQL.query.await([[
        SELECT id, saved_number AS number, name, avatar_url AS avatar, favorite, blocked
        FROM phone_contacts WHERE owner_number = ?
        ORDER BY favorite DESC, name ASC
    ]], { me })
    return { ok = true, data = rows }
end)

local function cleanAvatar(me, url)
    if url == nil or url == '' then return nil, true end
    url = tostring(url)
    if not OwnsPhoto(me, url) then return nil, false end
    return url, true
end

PhoneCallback('cipher-phone:contacts:add', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'contactsWrite') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local name = cleanName(data.name)
    local number = NormalizeNumber(data.number or '')
    if not name then return { ok = false, error = 'bad_name' } end
    if not number then return { ok = false, error = 'bad_number' } end

    local avatar, avatarOk = cleanAvatar(me, data.avatarUrl)
    if not avatarOk then return { ok = false, error = 'bad_media' } end

    local ok, id = pcall(MySQL.insert.await,
        'INSERT INTO phone_contacts (owner_number, saved_number, name, avatar_url) VALUES (?, ?, ?, ?)',
        { me, number, name, avatar })
    if not ok or not id then return { ok = false, error = 'exists' } end

    return { ok = true, data = { id = id, number = number, name = name, avatar = avatar, favorite = 0, blocked = 0 } }
end)

PhoneCallback('cipher-phone:contacts:update', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'contactsWrite') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local name = cleanName(data.name)
    local number = NormalizeNumber(data.number or '')
    if not name then return { ok = false, error = 'bad_name' } end
    if not number then return { ok = false, error = 'bad_number' } end

    local avatar, avatarOk = cleanAvatar(me, data.avatarUrl)
    if not avatarOk then return { ok = false, error = 'bad_media' } end

    local ok = pcall(MySQL.update.await, [[
        UPDATE phone_contacts SET name = ?, saved_number = ?, avatar_url = ?
        WHERE id = ? AND owner_number = ?
    ]], { name, number, avatar, tonumber(data.id) or 0, me })
    if not ok then return { ok = false, error = 'exists' } end

    return { ok = true }
end)

PhoneCallback('cipher-phone:contacts:delete', function(src, data)
    if not RateOK(src, 'contactsWrite') then return { ok = false, error = 'rate_limited' } end
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    MySQL.update.await('DELETE FROM phone_contacts WHERE id = ? AND owner_number = ?',
        { tonumber(data and data.id) or 0, me })
    return { ok = true }
end)

local function toggleFlag(src, id, column)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    MySQL.update.await(([[
        UPDATE phone_contacts SET %s = 1 - %s WHERE id = ? AND owner_number = ?
    ]]):format(column, column), { tonumber(id) or 0, me })
    return { ok = true }
end

PhoneCallback('cipher-phone:contacts:favorite', function(src, data)
    if not RateOK(src, 'contactsWrite') then return { ok = false, error = 'rate_limited' } end
    return toggleFlag(src, data and data.id, 'favorite')
end)

PhoneCallback('cipher-phone:contacts:block', function(src, data)
    if not RateOK(src, 'contactsWrite') then return { ok = false, error = 'rate_limited' } end
    return toggleFlag(src, data and data.id, 'blocked')
end)

function IsBlockedBy(owner, sender)
    return MySQL.scalar.await([[
        SELECT 1 FROM phone_contacts
        WHERE owner_number = ? AND saved_number = ? AND blocked = 1
    ]], { owner, sender }) ~= nil
end
