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
    if GetPlayerPed(src) ~= 0 then
        TriggerClientEvent('XS-Phone:client:callState', src, payload)
    end
end

local function logCall(call, state, duration)
    MySQL.insert.await(
        'INSERT INTO phone_calls (caller, callee, anonymous, state, duration) VALUES (?, ?, ?, ?, ?)',
        { call.caller, call.callee, call.anonymous and 1 or 0, state, duration or 0 })
end

local function endCall(call, reason, loggedState)
    if call.finished then return end
    call.finished = true
    calls[call.id] = nil
    numberInCall[call.caller] = nil
    numberInCall[call.callee] = nil

    setVoiceChannel(call.callerSrc, 0)
    setVoiceChannel(call.calleeSrc, 0)

    local duration = 0
    if call.answeredAt then duration = os.time() - call.answeredAt end
    logCall(call, loggedState, duration)

    local payload = { phase = 'ended', callId = call.id, reason = reason }
    pushState(call.callerSrc, payload)
    pushState(call.calleeSrc, payload)
end

PhoneCallback('XS-Phone:calls:start', function(src, data)
    if not RateOK(src, 'callStart') then return { ok = false, error = 'rate_limited' } end

    local me = EnsurePhone(src)
    if not me then return { ok = false, error = 'no_phone' } end
    if me.settings.airplane then return { ok = false, error = 'airplane' } end

    local raw = tostring(data and data.to or '')
    local anonymous = false
    local prefix = Config.Phone.Calls.anonymousPrefix
    if prefix and raw:sub(1, #prefix) == prefix then
        anonymous = true
        raw = raw:sub(#prefix + 1)
    end

    if numberInCall[me.number] then return { ok = false, error = 'busy_self' } end

    local to, label
    local biz, lines = ResolveBusinessLine(raw, me.number)
    if biz then
        local free = {}
        for _, n in ipairs(lines or {}) do
            if not numberInCall[n] then free[#free + 1] = n end
        end
        if #free == 0 then
            logCall({ caller = me.number, callee = tostring(biz.number), anonymous = anonymous }, 'missed', 0)
            return { ok = false, error = 'no_answer' }
        end
        to = free[math.random(#free)]
        label = biz.label
    end

    to = to or NormalizeNumber(raw)
    if not to or to == me.number then return { ok = false, error = 'invalid_number' } end

    local calleeSrc = GetSourceByNumber(to)
    local calleeSettings = calleeSrc and GetSettingsByNumber(to) or nil

    local unreachable =
        not calleeSrc
        or numberInCall[to]
        or (calleeSettings and calleeSettings.airplane)
        or IsBlockedBy(to, me.number)

    if unreachable then
        logCall({ caller = me.number, callee = to, anonymous = anonymous }, 'missed', 0)
        return { ok = false, error = 'no_answer' }
    end

    if calleeSettings and calleeSettings.dnd then
        logCall({ caller = me.number, callee = to, anonymous = anonymous }, 'missed', 0)
        TriggerClientEvent('XS-Phone:client:pushNotify', calleeSrc, {
            app = 'phone', title = 'Missed call',
            body = anonymous and 'Anonymous' or me.number,
        })
        return { ok = false, error = 'no_answer' }
    end

    nextCallId += 1
    local call = {
        id = nextCallId,
        caller = me.number, callee = to,
        callerSrc = src, calleeSrc = calleeSrc,
        anonymous = anonymous,
        state = 'ringing',
        startedAt = os.time(),
    }
    calls[call.id] = call
    numberInCall[me.number] = call.id
    numberInCall[to] = call.id

    pushState(calleeSrc, {
        phase = 'incoming', callId = call.id,
        number = anonymous and 'Anonymous' or me.number,
    })
    pushState(src, { phase = 'outgoing', callId = call.id, number = label or to })

    SetTimeout((Config.Phone.Calls.timeout or 25) * 1000, function()
        local c = calls[call.id]
        if c and c.state == 'ringing' then
            TriggerClientEvent('XS-Phone:client:pushNotify', c.calleeSrc, {
                app = 'phone', title = 'Missed call',
                body = c.anonymous and 'Anonymous' or c.caller,
            })
            endCall(c, 'no_answer', 'missed')
        end
    end)

    return { ok = true, data = { callId = call.id } }
end)

PhoneCallback('XS-Phone:calls:answer', function(src, data)
    local call = calls[tonumber(data and data.callId) or 0]
    if not call or call.calleeSrc ~= src or call.state ~= 'ringing' then
        return { ok = false, error = 'no_call' }
    end

    call.state = 'active'
    call.answeredAt = os.time()
    nextChannel = (nextChannel % 90000) + 1
    call.channel = 10000 + nextChannel

    setVoiceChannel(call.callerSrc, call.channel)
    setVoiceChannel(call.calleeSrc, call.channel)

    local payload = { phase = 'active', callId = call.id }
    pushState(call.callerSrc, payload)
    pushState(call.calleeSrc, payload)
    return { ok = true }
end)

PhoneCallback('XS-Phone:calls:decline', function(src, data)
    local call = calls[tonumber(data and data.callId) or 0]
    if not call or call.calleeSrc ~= src or call.state ~= 'ringing' then
        return { ok = false, error = 'no_call' }
    end
    endCall(call, 'declined', 'declined')
    return { ok = true }
end)

PhoneCallback('XS-Phone:calls:hangup', function(src, data)
    local call = calls[tonumber(data and data.callId) or 0]
    if not call or (call.callerSrc ~= src and call.calleeSrc ~= src) then
        return { ok = false, error = 'no_call' }
    end
    if call.state == 'ringing' then
        TriggerClientEvent('XS-Phone:client:pushNotify', call.calleeSrc, {
            app = 'phone', title = 'Missed call',
            body = call.anonymous and 'Anonymous' or call.caller,
        })
        endCall(call, 'cancelled', 'missed')
    else
        endCall(call, 'hangup', 'completed')
    end
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

AddEventHandler('playerDropped', function()
    local src = source
    for _, call in pairs(calls) do
        if call.callerSrc == src or call.calleeSrc == src then
            if call.state == 'ringing' then
                endCall(call, 'no_answer', 'missed')
            else
                endCall(call, 'hangup', 'completed')
            end
            break
        end
    end
end)
