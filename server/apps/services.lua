function ResolveBusinessLine(raw, exceptNumber)
    raw = tostring(raw or '')
    local digits = raw:gsub('%D', '')
    for _, biz in ipairs(Config.Phone.Businesses) do
        if biz.number and (raw == biz.number
            or (digits ~= '' and digits == tostring(biz.number):gsub('%D', ''))) then
            local _, workers = GetDutyRoster(biz.job)
            local lines = {}
            for _, id in ipairs(workers) do
                local entry = EnsurePhone(id)
                if entry and entry.number ~= exceptNumber and not entry.settings.airplane then
                    lines[#lines + 1] = entry.number
                end
            end
            return biz, lines
        end
    end
    return nil, nil
end

function LineFor(number)
    number = tostring(number or '')
    if number == '' then return nil end
    for _, biz in ipairs(Config.Phone.Businesses) do
        if biz.number and tostring(biz.number) == number then return biz end
    end
    return nil
end

function LineFromInput(raw)
    raw = tostring(raw or '')
    local digits = raw:gsub('%D', '')
    for _, biz in ipairs(Config.Phone.Businesses) do
        if biz.number and (raw == biz.number
            or (digits ~= '' and digits == tostring(biz.number):gsub('%D', ''))) then
            return biz
        end
    end
    return nil
end

function OnLine(src, number)
    local biz = LineFor(number)
    if not biz then return nil end
    local job = Framework.GetJobInfo(src)
    if job and job.onduty and job.name == biz.job then return biz end
    return nil
end

function NotifyLine(biz, payload, exceptSrc)
    local _, workers = GetDutyRoster(biz.job)
    for _, id in ipairs(workers) do
        if id ~= exceptSrc then
            local entry = EnsurePhone(id)
            if entry and not entry.settings.airplane then
                TriggerClientEvent('XS-Phone:client:lineMessage', id, payload)
            end
        end
    end
end

function BusinessLines()
    local map = {}
    for _, biz in ipairs(Config.Phone.Businesses) do
        if biz.number then map[tostring(biz.number)] = biz.label end
    end
    return map
end

function GetDutyRoster(job)
    local count, sources = 0, {}
    for _, playerId in ipairs(GetPlayers()) do
        local id = tonumber(playerId)
        local info = Framework.GetJobInfo(id)
        if info and info.name == job and info.onduty then
            count += 1
            sources[#sources + 1] = id
        end
    end
    return count, sources
end

PhoneCallback('XS-Phone:city:list', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    AwaitDB()

    local announcements = {}
    for _, row in ipairs(MySQL.query.await(
        'SELECT job, announcement FROM phone_business_info') or {}) do
        announcements[row.job] = row.announcement
    end

    local myJob = Framework.GetJobInfo(src)

    local out = {}
    local mine = {}
    for _, biz in ipairs(Config.Phone.Businesses) do
        local onDuty = GetDutyRoster(biz.job)
        local c = biz.coords
        out[#out + 1] = {
            job = biz.job,
            label = biz.label,
            number = biz.number,
            category = biz.category or 'Businesses',
            emergency = biz.emergency == true,
            open = onDuty > 0,
            onDuty = onDuty,
            announcement = announcements[biz.job],
            isBoss = myJob ~= nil and myJob.name == biz.job and myJob.isboss,
            x = c and tonumber(c.x) or nil,
            y = c and tonumber(c.y) or nil,
        }
        if biz.number and myJob and myJob.onduty and myJob.name == biz.job then
            local count = MySQL.scalar.await(
                'SELECT COUNT(*) FROM phone_thread_members WHERE number = ?', { tostring(biz.number) }) or 0
            mine[#mine + 1] = { number = tostring(biz.number), label = biz.label, chats = count }
        end
    end
    return { ok = true, data = out, lines = mine }
end)

PhoneCallback('XS-Phone:city:setAnnouncement', function(src, data)
    if not RateOK(src, 'businessWrite') then return { ok = false, error = 'rate_limited' } end

    local myJob = Framework.GetJobInfo(src)
    if not myJob or not myJob.isboss then return { ok = false, error = 'not_boss' } end

    local listed = false
    for _, biz in ipairs(Config.Phone.Businesses) do
        if biz.job == myJob.name then listed = true break end
    end
    if not listed then return { ok = false, error = 'not_listed' } end

    local text = tostring(data and data.text or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, 140)
    AwaitDB()
    MySQL.query.await([[
        INSERT INTO phone_business_info (job, announcement) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE announcement = VALUES(announcement)
    ]], { myJob.name, text ~= '' and text or nil })
    return { ok = true }
end)


PhoneCallback('XS-Phone:line:threads', function(src, data)
    local biz = OnLine(src, data and data.number)
    if not biz then return { ok = false, error = 'off_duty' } end
    local line = tostring(biz.number)
    local rows = MySQL.query.await([[
        SELECT t.id,
            (SELECT number FROM phone_thread_members WHERE thread_id = t.id AND number != ? LIMIT 1) AS caller,
            lm.body AS lastBody, lm.media_url AS lastMedia, (lm.location IS NOT NULL) AS lastLocation,
            lm.sender_number AS lastSender, UNIX_TIMESTAMP(lm.sent_at) * 1000 AS lastAt
        FROM phone_thread_members tm
        JOIN phone_threads t ON t.id = tm.thread_id
        LEFT JOIN phone_messages lm ON lm.id = (SELECT MAX(id) FROM phone_messages WHERE thread_id = t.id)
        WHERE tm.number = ?
        ORDER BY COALESCE(lm.sent_at, t.created_at) DESC LIMIT 40
    ]], { line, line }) or {}
    return { ok = true, data = { line = line, label = biz.label, threads = rows } }
end)

local function lineThread(src, data)
    local biz = OnLine(src, data and data.number)
    if not biz then return nil, 'off_duty' end
    local threadId = tonumber(data.threadId)
    if not threadId then return nil, 'bad_payload' end
    local member = MySQL.scalar.await(
        'SELECT 1 FROM phone_thread_members WHERE thread_id = ? AND number = ?', { threadId, tostring(biz.number) })
    if not member then return nil, 'not_member' end
    return biz, threadId
end

PhoneCallback('XS-Phone:line:messages', function(src, data)
    local biz, threadId = lineThread(src, data)
    if not biz then return { ok = false, error = threadId } end
    local rows = MySQL.query.await([[
        SELECT id, sender_number AS sender, body, media_url AS media, location,
               UNIX_TIMESTAMP(sent_at) * 1000 AS sentAt
        FROM phone_messages WHERE thread_id = ? ORDER BY id DESC LIMIT 60
    ]], { threadId }) or {}
    local messages = {}
    for i = #rows, 1, -1 do
        local row = rows[i]
        row.location = DecodeLocation and DecodeLocation(row.location) or nil
        messages[#messages + 1] = row
    end
    local caller = MySQL.scalar.await(
        'SELECT number FROM phone_thread_members WHERE thread_id = ? AND number != ? LIMIT 1', { threadId, tostring(biz.number) })
    return { ok = true, data = { line = tostring(biz.number), caller = caller, messages = messages } }
end)

PhoneCallback('XS-Phone:line:send', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'sendMessage') then return { ok = false, error = 'rate_limited' } end
    local biz, threadId = lineThread(src, data)
    if not biz then return { ok = false, error = threadId } end
    local body = tostring(data.body or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, 1000)
    if body == '' then return { ok = false, error = 'empty' } end
    local message = DeliverMessage(threadId, tostring(biz.number), body)
    NotifyLine(biz, { line = tostring(biz.number), label = biz.label, threadId = threadId, message = message, reply = true }, src)
    return { ok = true, data = message }
end)
