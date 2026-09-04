local function sweep()
    local r = Config.Phone.Retention or {}
    local removed = 0

    local function purge(table_, column, days)
        if not days or days <= 0 then return end
        local ok, n = pcall(MySQL.update.await,
            ('DELETE FROM `%s` WHERE `%s` < NOW() - INTERVAL ? DAY'):format(table_, column),
            { days })
        if ok then removed += (n or 0) end
    end

    purge('phone_messages', 'sent_at', r.messages)
    purge('phone_calls', 'started_at', r.calls)
    purge('phone_emails', 'created_at', r.mail)
    purge('phone_transactions', 'created_at', r.transactions)

    if r.messages and r.messages > 0 then
        local empty = MySQL.query.await([[
            SELECT t.id FROM phone_threads t
            WHERE t.created_at < NOW() - INTERVAL 1 DAY
              AND NOT EXISTS (SELECT 1 FROM phone_messages m WHERE m.thread_id = t.id)
        ]]) or {}
        for _, row in ipairs(empty) do
            MySQL.update.await('DELETE FROM phone_thread_members WHERE thread_id = ?', { row.id })
            MySQL.update.await('DELETE FROM phone_threads WHERE id = ?', { row.id })
            removed += 1
        end
    end

    if Config.Debug and removed > 0 then
        print(('^2[cipher-phone]^0 retention sweep removed %d rows'):format(removed))
    end
end

CreateThread(function()
    AwaitDB()
    Wait(60000)
    while true do
        sweep()
        Wait(6 * 60 * 60 * 1000)
    end
end)
