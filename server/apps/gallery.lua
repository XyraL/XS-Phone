function IsAllowedMediaUrl(url)
    if type(url) ~= 'string' or #url > 255 or not url:find('^https://') then
        return false
    end
    local host = url:match('^https://([^/]+)')
    if not host then return false end
    host = host:lower():gsub(':%d+$', '')
    for _, allowed in ipairs(Config.Phone.Media.allowedHosts) do
        if host == allowed:lower() then return true end
    end
    return false
end

function IsAllowedExternalImage(url)
    if IsAllowedMediaUrl(url) then return true end
    if type(url) ~= 'string' or #url > 255 or not url:find('^https://') then
        return false
    end
    local host = url:match('^https://([^/]+)')
    if not host then return false end
    host = host:lower():gsub(':%d+$', '')
    for _, allowed in ipairs(Config.Phone.Media.externalHosts or {}) do
        if host == allowed:lower() then return true end
    end
    return false
end

PhoneCallback('cipher-phone:gallery:list', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local rows = MySQL.query.await([[
        SELECT id, url, UNIX_TIMESTAMP(taken_at) * 1000 AS at
        FROM phone_photos WHERE owner_number = ?
        ORDER BY id DESC LIMIT 200
    ]], { me })
    return { ok = true, data = rows }
end)

PhoneCallback('cipher-phone:gallery:save', function(src, data)
    if not RateOK(src, 'photoSave') then return { ok = false, error = 'rate_limited' } end
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local url = data and data.url
    if not IsAllowedMediaUrl(url) then return { ok = false, error = 'bad_url' } end

    local count = MySQL.scalar.await(
        'SELECT COUNT(*) FROM phone_photos WHERE owner_number = ?', { me }) or 0
    if count >= (Config.Phone.Media.maxPhotos or 200) then
        return { ok = false, error = 'full' }
    end

    local id = MySQL.insert.await(
        'INSERT INTO phone_photos (owner_number, url) VALUES (?, ?)', { me, url })
    return { ok = true, data = { id = id, url = url, at = os.time() * 1000 } }
end)

PhoneCallback('cipher-phone:gallery:importUrl', function(src, data)
    if not RateOK(src, 'galleryImport') then return { ok = false, error = 'rate_limited' } end
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local url = tostring(data and data.url or ''):gsub('^%s+', ''):gsub('%s+$', '')
    if not IsAllowedExternalImage(url) then return { ok = false, error = 'bad_host' } end

    local count = MySQL.scalar.await(
        'SELECT COUNT(*) FROM phone_photos WHERE owner_number = ?', { me }) or 0
    if count >= (Config.Phone.Media.maxPhotos or 200) then
        return { ok = false, error = 'full' }
    end

    local id = MySQL.insert.await(
        'INSERT INTO phone_photos (owner_number, url) VALUES (?, ?)', { me, url })
    return { ok = true, data = { id = id, url = url, at = os.time() * 1000 } }
end)

PhoneCallback('cipher-phone:gallery:delete', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    MySQL.update.await(
        'DELETE FROM phone_photos WHERE id = ? AND owner_number = ?',
        { tonumber(data and data.id) or 0, me })
    return { ok = true }
end)

function OwnsPhoto(number, url)
    return MySQL.scalar.await(
        'SELECT 1 FROM phone_photos WHERE owner_number = ? AND url = ? LIMIT 1',
        { number, url }) ~= nil
end
