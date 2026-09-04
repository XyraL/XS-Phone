local API = {
    ['contacts:list']        = 'cipher-phone:contacts:list',
    ['contacts:add']         = 'cipher-phone:contacts:add',
    ['contacts:update']      = 'cipher-phone:contacts:update',
    ['contacts:delete']      = 'cipher-phone:contacts:delete',
    ['contacts:favorite']    = 'cipher-phone:contacts:favorite',
    ['contacts:block']       = 'cipher-phone:contacts:block',

    ['messages:threads']     = 'cipher-phone:messages:threads',
    ['messages:getThread']   = 'cipher-phone:messages:getThread',
    ['messages:markRead']    = 'cipher-phone:messages:markRead',
    ['messages:send']        = 'cipher-phone:messages:send',
    ['messages:createGroup'] = 'cipher-phone:messages:createGroup',
    ['messages:toggleMute']  = 'cipher-phone:messages:toggleMute',
    ['messages:leave']       = 'cipher-phone:messages:leave',

    ['drop:send']            = 'cipher-phone:drop:send',

    ['calls:start']          = 'cipher-phone:calls:start',
    ['calls:answer']         = 'cipher-phone:calls:answer',
    ['calls:decline']        = 'cipher-phone:calls:decline',
    ['calls:hangup']         = 'cipher-phone:calls:hangup',
    ['calls:history']        = 'cipher-phone:calls:history',

    ['pin:verify']           = 'cipher-phone:pin:verify',
    ['pin:set']              = 'cipher-phone:pin:set',

    ['gallery:list']         = 'cipher-phone:gallery:list',
    ['gallery:save']         = 'cipher-phone:gallery:save',
    ['gallery:delete']       = 'cipher-phone:gallery:delete',

    ['wallet:summary']       = 'cipher-phone:wallet:summary',
    ['wallet:transfer']      = 'cipher-phone:wallet:transfer',

    ['notes:list']           = 'cipher-phone:notes:list',
    ['notes:save']           = 'cipher-phone:notes:save',
    ['notes:delete']         = 'cipher-phone:notes:delete',

    ['alarms:list']          = 'cipher-phone:alarms:list',
    ['alarms:save']          = 'cipher-phone:alarms:save',
    ['alarms:toggle']        = 'cipher-phone:alarms:toggle',
    ['alarms:delete']        = 'cipher-phone:alarms:delete',

    ['social:me']            = 'cipher-phone:social:me',
    ['social:createProfile'] = 'cipher-phone:social:createProfile',
    ['social:updateProfile'] = 'cipher-phone:social:updateProfile',
    ['social:feed']          = 'cipher-phone:social:feed',
    ['social:post']          = 'cipher-phone:social:post',
    ['social:like']          = 'cipher-phone:social:like',
    ['social:delete']        = 'cipher-phone:social:delete',
    ['social:thread']        = 'cipher-phone:social:thread',
    ['social:profile']       = 'cipher-phone:social:profile',
    ['social:follow']        = 'cipher-phone:social:follow',

    ['mail:me']              = 'cipher-phone:mail:me',
    ['mail:signup']          = 'cipher-phone:mail:signup',
    ['mail:login']           = 'cipher-phone:mail:login',
    ['mail:logout']          = 'cipher-phone:mail:logout',
    ['mail:list']            = 'cipher-phone:mail:list',
    ['mail:send']            = 'cipher-phone:mail:send',
    ['mail:read']            = 'cipher-phone:mail:read',
    ['mail:delete']          = 'cipher-phone:mail:delete',

    ['social:login']         = 'cipher-phone:social:login',
    ['social:logout']        = 'cipher-phone:social:logout',
    ['match:login']          = 'cipher-phone:match:login',
    ['match:logout']         = 'cipher-phone:match:logout',

    ['market:list']          = 'cipher-phone:market:list',
    ['market:post']          = 'cipher-phone:market:post',
    ['market:delete']        = 'cipher-phone:market:delete',

    ['city:list']            = 'cipher-phone:city:list',
    ['city:setAnnouncement'] = 'cipher-phone:city:setAnnouncement',

    ['phone:changeNumber']   = 'cipher-phone:phone:changeNumber',

    ['darkchat:rooms']       = 'cipher-phone:darkchat:rooms',
    ['darkchat:create']      = 'cipher-phone:darkchat:create',
    ['darkchat:join']        = 'cipher-phone:darkchat:join',
    ['darkchat:messages']    = 'cipher-phone:darkchat:messages',
    ['darkchat:send']        = 'cipher-phone:darkchat:send',
    ['darkchat:leave']       = 'cipher-phone:darkchat:leave',

    ['prism:feed']           = 'cipher-phone:prism:feed',
    ['prism:post']           = 'cipher-phone:prism:post',
    ['prism:like']           = 'cipher-phone:prism:like',
    ['prism:comments']       = 'cipher-phone:prism:comments',
    ['prism:comment']        = 'cipher-phone:prism:comment',
    ['prism:delete']         = 'cipher-phone:prism:delete',
    ['prism:profile']        = 'cipher-phone:prism:profile',

    ['garage:list']          = 'cipher-phone:garage:list',
    ['garage:ping']          = 'cipher-phone:garage:ping',
    ['garage:valet']         = 'cipher-phone:garage:valet',

    ['gallery:importUrl']    = 'cipher-phone:gallery:importUrl',

    ['store:install']        = 'cipher-phone:store:install',
    ['store:uninstall']      = 'cipher-phone:store:uninstall',

    ['match:me']             = 'cipher-phone:match:me',
    ['match:saveProfile']    = 'cipher-phone:match:saveProfile',
    ['match:deck']           = 'cipher-phone:match:deck',
    ['match:swipe']          = 'cipher-phone:match:swipe',
    ['match:matches']        = 'cipher-phone:match:matches',
    ['match:unmatch']        = 'cipher-phone:match:unmatch',
    ['match:unswipe']        = 'cipher-phone:match:unswipe',

    ['music:list']           = 'cipher-phone:music:list',
    ['music:add']            = 'cipher-phone:music:add',
    ['music:delete']         = 'cipher-phone:music:delete',
}

local function vehicleLabel(model, hash)
    hash = hash or (model and joaat(tostring(model)))
    if hash and IsModelInCdimage(hash) then
        local display = GetDisplayNameFromVehicleModel(hash)
        if display and display ~= 'NULL' and display ~= 'CARNOTFOUND' then
            local label = GetLabelText(display)
            if label and label ~= 'NULL' then return label end
            return display
        end
    end
    if type(model) == 'string' and model ~= '' then
        return model:sub(1, 1):upper() .. model:sub(2)
    end
    return 'Vehicle'
end

RegisterNUICallback('api', function(req, cb)
    local target = req and API[req.name]
    if not target then
        cb({ ok = false, error = 'unknown_api' })
        return
    end
    local res = AwaitServer(target, req.data)
    if req.name == 'garage:list' and res and res.ok and res.data and res.data.vehicles then
        for _, v in ipairs(res.data.vehicles) do
            v.label = vehicleLabel(v.model, v.hash)
        end
    end
    cb(res ~= nil and res or { ok = false, error = 'timeout' })
end)

RegisterNUICallback('dropScan', function(_, cb)
    cb(lib.callback.await('cipher-phone:drop:scan', false, { ids = GetNearbyPlayerIds() }))
end)

RegisterNUICallback('dropRespond', function(data, cb)
    TriggerServerEvent('cipher-phone:drop:respond', data and data.accept == true)
    cb({ ok = true })
end)

RegisterNUICallback('close', function(_, cb)
    ClosePhone()
    cb({ ok = true })
end)

RegisterNUICallback('keepInput', function(data, cb)
    if IsPhoneOpen() then
        SetNuiFocusKeepInput(data and data.keep ~= false)
    end
    cb({ ok = true })
end)

local MUSIC_ID = 'cipher-phone-music'

RegisterNUICallback('musicPlay', function(data, cb)
    if GetResourceState('xsound') ~= 'started' then
        cb({ ok = false, error = 'no_xsound' })
        return
    end
    local volume = math.min(100, math.max(0, tonumber(data and data.volume) or 30)) / 100
    local ok = pcall(function()
        exports.xsound:PlayUrl(MUSIC_ID, tostring(data.url), volume, false)
    end)
    cb({ ok = ok })
end)

RegisterNUICallback('musicStop', function(_, cb)
    pcall(function()
        if exports.xsound:soundExists(MUSIC_ID) then exports.xsound:Destroy(MUSIC_ID) end
    end)
    cb({ ok = true })
end)

RegisterNUICallback('musicVolume', function(data, cb)
    pcall(function()
        exports.xsound:setVolume(MUSIC_ID, math.min(100, math.max(0, tonumber(data and data.volume) or 30)) / 100)
    end)
    cb({ ok = true })
end)

RegisterNUICallback('callMute', function(data, cb)
    MumbleSetActive(not (data and data.muted == true))
    cb({ ok = true })
end)

RegisterNUICallback('setWaypoint', function(data, cb)
    local x, y = tonumber(data and data.x), tonumber(data and data.y)
    if x and y then SetNewWaypoint(x, y) end
    cb({ ok = x ~= nil })
end)

local WEATHER_NAMES = {
    [`EXTRASUNNY`] = 'EXTRASUNNY', [`CLEAR`] = 'CLEAR', [`NEUTRAL`] = 'NEUTRAL',
    [`SMOG`] = 'SMOG', [`FOGGY`] = 'FOGGY', [`CLOUDS`] = 'CLOUDS',
    [`OVERCAST`] = 'OVERCAST', [`CLEARING`] = 'CLEARING', [`RAIN`] = 'RAIN',
    [`THUNDER`] = 'THUNDER', [`SNOW`] = 'SNOW', [`SNOWLIGHT`] = 'SNOWLIGHT',
    [`BLIZZARD`] = 'BLIZZARD', [`XMAS`] = 'XMAS', [`HALLOWEEN`] = 'HALLOWEEN',
}

RegisterNUICallback('getWeather', function(_, cb)
    local prev, nxt, pct = GetWeatherTypeTransition()
    local hash = (pct or 0) >= 0.5 and nxt or prev
    cb({
        ok = true,
        weather = WEATHER_NAMES[hash] or 'CLEAR',
        hour = GetClockHours(),
        minute = GetClockMinutes(),
    })
end)

RegisterNUICallback('saveSettings', function(data, cb)
    local res = lib.callback.await('cipher-phone:saveSettings', false, data)
    if res and res.ok and type(data) == 'table' then
        ClientSettings = data
    end
    cb(res)
end)
