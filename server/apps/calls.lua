local calls = {}
local numberInCall = {}
local nextCallId = 0
local nextChannel = 0

local function voiceReady()
    return GetResourceState('pma-voice') == 'started'
end

local function setVoiceChannel(src, channel)
    if voiceReady() and GetPlayerPed(src) ~= 0 then
        exports['pma-voice']:setPlayerCall(src, channel)
    end
end

local function pushState(src, payload)
    if src and GetPlayerPed(src) ~= 0 then
        TriggerClientEvent('XS-Phone:client:callState', src, payload)
    end
end

local function logCall(caller, callee, anonymous, state, duration)
    MySQL.insert.await(
        'INSERT INTO phone_calls (caller, callee, anonymous, state, duration) VALUES (?, ?, ?, ?, ?)',
        { caller, callee, anonymous and 1 or 0, state, duration or 0 })
end

local function missedNotify(src, from)
    if not src then return end
    TriggerClientEvent('XS-Phone:client:pushNotify', src, {
        app = 'phone', title = 'Missed call', body = from,
    })
end

function PhoneInCall(number)
    return numberInCall[number] ~= nil
end

local function shown(m)
    if m.hidden then return 'Anonymous' end
    return m.label or m.number
end

local function others(call, number)
    local list = {}
    for _, n in ipairs(call.order) do
        local m = call.members[n]
        if m and n ~= number then
            list[#list + 1] = { number = shown(m), state = m.state }
        end
    end
    return list
end

local function counts(call)
    local active, ringing = 0, 0
    for _, m in pairs(call.members) do
        if m.state == 'active' then active += 1 else ringing += 1 end
    end
    return active, ringing
end

local function broadcast(call, notice)
    if not call.answeredAt then return end
    for n, m in pairs(call.members) do
        if m.state == 'active' then
            pushState(m.src, { phase = 'active', callId = call.id, members = others(call, n), notice = notice })
        end
    end
end

local function dropMember(call, number)
    local m = call.members[number]
    if not m then return nil end
    call.members[number] = nil
    for i, n in ipairs(call.order) do
        if n == number then table.remove(call.order, i) break end
    end
    if numberInCall[number] == call.id then numberInCall[number] = nil end
    return m
end

local function closeLeg(call, m, reason)
    local callee = m.line or m.number
    if m.state == 'active' then
        if m.by then logCall(m.by, callee, m.byHidden, 'completed', os.time() - (m.joinedAt or os.time())) end
        setVoiceChannel(m.src, 0)
    elseif m.by then
        logCall(m.by, callee, m.byHidden, reason == 'declined' and 'declined' or 'missed', 0)
        if reason ~= 'declined' and not m.line then missedNotify(m.src, m.byHidden and 'Anonymous' or m.by) end
    end
end

local function endCall(call, reason)
    if call.finished then return end
    call.finished = true
    calls[call.id] = nil
    for n, m in pairs(call.members) do
        if numberInCall[n] == call.id then numberInCall[n] = nil end
        closeLeg(call, m, m.state == 'ringing' and 'cancelled' or reason)
        pushState(m.src, { phase = 'ended', callId = call.id, reason = reason })
    end
    call.members = {}
    call.order = {}
end

local function settle(call, reason, notice)
    if call.finished then return end
    local active, ringing = counts(call)
    if not call.answeredAt then
        if ringing == 0 or active == 0 then endCall(call, reason) end
        return
    end
    if active == 0 or (active == 1 and ringing == 0) then
        endCall(call, active == 1 and 'hangup' or reason)
        return
    end
    broadcast(call, notice)
end

local function resolveTarget(raw, me)
    local hidden = false
    local prefix = Config.Phone.Calls.anonymousPrefix
    if prefix and raw:sub(1, #prefix) == prefix then
        hidden = true
        raw = raw:sub(#prefix + 1)
    end

    local biz, lines = ResolveBusinessLine(raw, me)
    if biz then
        local free = {}
        for _, n in ipairs(lines or {}) do
            if not numberInCall[n] then free[#free + 1] = n end
        end
        if #free == 0 then return nil, 'no_answer', hidden, tostring(biz.number) end
        return free[math.random(#free)], nil, hidden, nil, biz.label, biz
    end

    local to = NormalizeNumber(raw)
    if not to or to == me then return nil, 'invalid_number', hidden end
    return to, nil, hidden
end

local function reachable(to, from, hidden, line)
    local src = GetSourceByNumber(to)
    local settings = src and GetSettingsByNumber(to) or nil
    if not src or numberInCall[to] or (settings and settings.airplane) or IsBlockedBy(to, from) then
        logCall(from, line or to, hidden, 'missed', 0)
        return nil, 'no_answer'
    end
    if settings and settings.dnd and not line then
        logCall(from, to, hidden, 'missed', 0)
        missedNotify(src, hidden and 'Anonymous' or from)
        return nil, 'no_answer'
    end
    return src
end

local function ring(call, number)
    SetTimeout((Config.Phone.Calls.timeout or 25) * 1000, function()
        local c = calls[call.id]
        local m = c and c.members[number]
        if not m or m.state ~= 'ringing' then return end
        dropMember(c, number)
        closeLeg(c, m, 'no_answer')
        pushState(m.src, { phase = 'ended', callId = c.id, reason = 'no_answer' })
        settle(c, 'no_answer', { number = shown(m), reason = 'no_answer' })
    end)
end

PhoneCallback('XS-Phone:calls:start', function(src, data)
    if not RateOK(src, 'callStart') then return { ok = false, error = 'rate_limited' } end

    local me = EnsurePhone(src)
    if not me then return { ok = false, error = 'no_phone' } end
    if me.settings.airplane then return { ok = false, error = 'airplane' } end
    if numberInCall[me.number] then return { ok = false, error = 'busy_self' } end

    local asLine = data and data.asLine and OnLine(src, data.asLine) or nil
    if data and data.asLine and not asLine then return { ok = false, error = 'off_duty' } end
    local caller = asLine and tostring(asLine.number) or me.number

    local to, err, hidden, missedLine, label, biz = resolveTarget(tostring(data and data.to or ''), me.number)
    if asLine then hidden = false end
    if not to then
        if missedLine then logCall(caller, missedLine, hidden, 'missed', 0) end
        return { ok = false, error = err }
    end

    local calleeSrc, unreachable = reachable(to, caller, hidden, biz and tostring(biz.number) or nil)
    if not calleeSrc then return { ok = false, error = unreachable } end

    nextCallId += 1
    local call = {
        id = nextCallId,
        startedAt = os.time(),
        members = {
            [me.number] = { number = me.number, src = src, state = 'active', hidden = hidden,
                label = asLine and asLine.label or nil },
            [to] = { number = to, src = calleeSrc, state = 'ringing', by = caller, byHidden = hidden, label = label,
                line = biz and tostring(biz.number) or nil },
        },
        order = { me.number, to },
    }
    calls[call.id] = call
    numberInCall[me.number] = call.id
    numberInCall[to] = call.id

    pushState(calleeSrc, {
        phase = 'incoming', callId = call.id,
        number = hidden and 'Anonymous' or caller,
        members = others(call, to),
        line = biz and (biz.label .. ' · ' .. tostring(biz.number)) or nil,
        photo = not hidden and not asLine and PhotosFor and PhotosFor(to, { me.number })[me.number] or nil,
    })
    pushState(src, { phase = 'outgoing', callId = call.id, number = label or to })
    ring(call, to)

    return { ok = true, data = { callId = call.id } }
end)

PhoneCallback('XS-Phone:calls:add', function(src, data)
    if not RateOK(src, 'callStart') then return { ok = false, error = 'rate_limited' } end

    local me = EnsurePhone(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local call = calls[tonumber(data and data.callId) or 0]
    local mine = call and call.members[me.number]
    if not mine or mine.state ~= 'active' or not call.answeredAt then
        return { ok = false, error = 'not_active' }
    end

    local size = 0
    for _ in pairs(call.members) do size += 1 end
    if size >= (Config.Phone.Calls.maxParticipants or 5) then return { ok = false, error = 'full' } end

    local to, err, hidden, missedLine, label, biz = resolveTarget(tostring(data.to or ''), me.number)
    hidden = hidden or mine.hidden
    local lineNumber = biz and tostring(biz.number) or nil
    if not to then
        if missedLine then logCall(me.number, missedLine, hidden, 'missed', 0) end
        return { ok = false, error = err }
    end
    if call.members[to] then return { ok = false, error = 'already_in' } end
    if numberInCall[to] then
        logCall(me.number, lineNumber or to, hidden, 'missed', 0)
        return { ok = false, error = 'busy' }
    end

    local targetSrc, unreachable = reachable(to, me.number, hidden, lineNumber)
    if not targetSrc then return { ok = false, error = unreachable } end

    call.members[to] = { number = to, src = targetSrc, state = 'ringing', by = me.number, byHidden = hidden,
        label = label, line = lineNumber }
    call.order[#call.order + 1] = to
    numberInCall[to] = call.id

    pushState(targetSrc, {
        phase = 'incoming', callId = call.id,
        number = hidden and 'Anonymous' or me.number,
        members = others(call, to),
        line = biz and (biz.label .. ' · ' .. lineNumber) or nil,
        photo = not hidden and PhotosFor and PhotosFor(to, { me.number })[me.number] or nil,
    })
    broadcast(call)
    ring(call, to)
    return { ok = true }
end)

PhoneCallback('XS-Phone:calls:answer', function(src, data)
    local call = calls[tonumber(data and data.callId) or 0]
    local number = GetPhoneNumber(src)
    local m = call and number and call.members[number]
    if not m or m.src ~= src or m.state ~= 'ringing' then
        return { ok = false, error = 'no_call' }
    end

    m.state = 'active'
    m.joinedAt = os.time()
    if not call.answeredAt then
        call.answeredAt = os.time()
        nextChannel = (nextChannel % 90000) + 1
        call.channel = 10000 + nextChannel
        for _, other in pairs(call.members) do
            if other.state == 'active' then
                other.joinedAt = other.joinedAt or call.answeredAt
                setVoiceChannel(other.src, call.channel)
            end
        end
    else
        setVoiceChannel(src, call.channel)
    end

    broadcast(call)
    return { ok = true }
end)

PhoneCallback('XS-Phone:calls:decline', function(src, data)
    local call = calls[tonumber(data and data.callId) or 0]
    local number = GetPhoneNumber(src)
    local m = call and number and call.members[number]
    if not m or m.src ~= src or m.state ~= 'ringing' then
        return { ok = false, error = 'no_call' }
    end
    dropMember(call, number)
    closeLeg(call, m, 'declined')
    pushState(src, { phase = 'ended', callId = call.id, reason = 'declined' })
    settle(call, 'declined', { number = shown(m), reason = 'declined' })
    return { ok = true }
end)

local function leave(call, number, src)
    local m = call.members[number]
    if not m then return end
    if not call.answeredAt and m.state == 'active' then
        endCall(call, 'cancelled')
        return
    end
    dropMember(call, number)
    closeLeg(call, m, 'hangup')
    pushState(src, { phase = 'ended', callId = call.id, reason = 'hangup' })
    settle(call, 'hangup', { number = shown(m), reason = 'left' })
end

PhoneCallback('XS-Phone:calls:hangup', function(src, data)
    local call = calls[tonumber(data and data.callId) or 0]
    local number = GetPhoneNumber(src)
    local m = call and number and call.members[number]
    if not m or m.src ~= src or m.state ~= 'active' then
        return { ok = false, error = 'no_call' }
    end
    leave(call, number, src)
    return { ok = true }
end)

PhoneCallback('XS-Phone:calls:history', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local rows = MySQL.query.await([[
        SELECT caller, callee, anonymous, state, duration,
               UNIX_TIMESTAMP(started_at) * 1000 AS at
        FROM phone_calls
        WHERE caller = ? OR callee = ?
        ORDER BY id DESC LIMIT 50
    ]], { me, me })

    local out = {}
    for _, r in ipairs(rows) do
        local outgoing = r.caller == me
        out[#out + 1] = {
            number = outgoing and r.callee
                or (DbBool(r.anonymous) and 'Anonymous' or r.caller),
            direction = outgoing and 'out' or 'in',
            state = r.state,
            duration = r.duration,
            at = r.at,
        }
    end
    return { ok = true, data = out }
end)

local function hangUpAll(src)
    for _, call in pairs(calls) do
        for number, m in pairs(call.members) do
            if m.src == src then
                if m.state == 'ringing' then
                    dropMember(call, number)
                    closeLeg(call, m, 'no_answer')
                    pushState(src, { phase = 'ended', callId = call.id, reason = 'no_answer' })
                    settle(call, 'no_answer', { number = shown(m), reason = 'no_answer' })
                else
                    leave(call, number, src)
                end
                break
            end
        end
    end
end

AddEventHandler('playerDropped', function()
    hangUpAll(source)
end)

AddEventHandler('QBCore:Server:OnPlayerUnload', function(src)
    hangUpAll(tonumber(src) or source)
end)
