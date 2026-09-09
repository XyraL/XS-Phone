PhoneCallback('XS-Phone:music:list', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local rows = MySQL.query.await(
        'SELECT id, title, url FROM phone_music WHERE owner_number = ? ORDER BY id ASC LIMIT 100',
        { me })
    return { ok = true, data = rows }
end)

PhoneCallback('XS-Phone:music:add', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'musicWrite') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local title = tostring(data.title or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, 60)
    local url = tostring(data.url or '')
    if title == '' then return { ok = false, error = 'empty' } end
    if #url > 255 or not (url:find('^https://') or url:find('^http://')) then
        return { ok = false, error = 'bad_url' }
    end

    local count = MySQL.scalar.await(
        'SELECT COUNT(*) FROM phone_music WHERE owner_number = ?', { me }) or 0
    if count >= (Config.Phone.Music.maxTracks or 50) then
        return { ok = false, error = 'full' }
    end

    local id = MySQL.insert.await(
        'INSERT INTO phone_music (owner_number, title, url) VALUES (?, ?, ?)',
        { me, title, url })
    return { ok = true, data = { id = id, title = title, url = url } }
end)

PhoneCallback('XS-Phone:music:delete', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    MySQL.update.await('DELETE FROM phone_music WHERE id = ? AND owner_number = ?',
        { tonumber(data and data.id) or 0, me })
    return { ok = true }
end)
