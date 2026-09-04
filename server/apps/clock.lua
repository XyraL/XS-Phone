PhoneCallback('cipher-phone:alarms:list', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local rows = MySQL.query.await(
        'SELECT id, time, label, enabled FROM phone_alarms WHERE owner_number = ? ORDER BY time ASC',
        { me })
    return { ok = true, data = rows }
end)

PhoneCallback('cipher-phone:alarms:save', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'alarmsWrite') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local time = tostring(data.time or '')
    if not time:match('^%d%d:%d%d$') then return { ok = false, error = 'bad_time' } end
    local h, m = tonumber(time:sub(1, 2)), tonumber(time:sub(4, 5))
    if h > 23 or m > 59 then return { ok = false, error = 'bad_time' } end

    local label = tostring(data.label or ''):sub(1, 40)
    local count = MySQL.scalar.await(
        'SELECT COUNT(*) FROM phone_alarms WHERE owner_number = ?', { me }) or 0
    if count >= 10 then return { ok = false, error = 'full' } end

    local id = MySQL.insert.await(
        'INSERT INTO phone_alarms (owner_number, time, label) VALUES (?, ?, ?)',
        { me, time, label ~= '' and label or nil })
    return { ok = true, data = { id = id } }
end)

PhoneCallback('cipher-phone:alarms:toggle', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    MySQL.update.await(
        'UPDATE phone_alarms SET enabled = 1 - enabled WHERE id = ? AND owner_number = ?',
        { tonumber(data and data.id) or 0, me })
    return { ok = true }
end)

PhoneCallback('cipher-phone:alarms:delete', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    MySQL.update.await('DELETE FROM phone_alarms WHERE id = ? AND owner_number = ?',
        { tonumber(data and data.id) or 0, me })
    return { ok = true }
end)

CreateThread(function()
    local lastMinute = nil
    while true do
        Wait(20000)
        local minute = os.date('%H:%M')
        if minute ~= lastMinute then
            lastMinute = minute
            if DBReady then
                local rows = MySQL.query.await(
                    'SELECT owner_number, label FROM phone_alarms WHERE enabled = 1 AND time = ?',
                    { minute })
                for _, r in ipairs(rows or {}) do
                    local src = GetSourceByNumber(r.owner_number)
                    if src then
                        TriggerClientEvent('cipher-phone:client:pushNotify', src, {
                            app = 'clock', title = 'Alarm — ' .. minute,
                            body = r.label or 'Alarm',
                        })
                        Framework.Notify(src, ('Alarm: %s'):format(r.label or minute), 'inform')
                    end
                end
            end
        end
    end
end)
