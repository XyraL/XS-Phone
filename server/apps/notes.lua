PhoneCallback('XS-Phone:notes:list', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local rows = MySQL.query.await([[
        SELECT id, title, body, UNIX_TIMESTAMP(updated_at) * 1000 AS at
        FROM phone_notes WHERE owner_number = ?
        ORDER BY updated_at DESC LIMIT 100
    ]], { me })
    return { ok = true, data = rows }
end)

PhoneCallback('XS-Phone:notes:save', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'notesWrite') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local title = tostring(data.title or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, 60)
    local body = tostring(data.body or ''):sub(1, 5000)
    if title == '' then title = 'Untitled' end

    local id = tonumber(data.id)
    if id then
        MySQL.update.await(
            'UPDATE phone_notes SET title = ?, body = ? WHERE id = ? AND owner_number = ?',
            { title, body, id, me })
        return { ok = true, data = { id = id } }
    end
    id = MySQL.insert.await(
        'INSERT INTO phone_notes (owner_number, title, body) VALUES (?, ?, ?)',
        { me, title, body })
    return { ok = true, data = { id = id } }
end)

PhoneCallback('XS-Phone:notes:delete', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    MySQL.update.await('DELETE FROM phone_notes WHERE id = ? AND owner_number = ?',
        { tonumber(data and data.id) or 0, me })
    return { ok = true }
end)
