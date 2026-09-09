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
    for _, biz in ipairs(Config.Phone.Businesses) do
        local onDuty = GetDutyRoster(biz.job)
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
        }
    end
    return { ok = true, data = out }
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
