local API = {
    ['contacts:list']        = 'XS-Phone:contacts:list',
    ['contacts:add']         = 'XS-Phone:contacts:add',
    ['contacts:update']      = 'XS-Phone:contacts:update',
    ['contacts:delete']      = 'XS-Phone:contacts:delete',
    ['contacts:favorite']    = 'XS-Phone:contacts:favorite',
    ['contacts:block']       = 'XS-Phone:contacts:block',

    ['messages:threads']     = 'XS-Phone:messages:threads',
    ['messages:getThread']   = 'XS-Phone:messages:getThread',
    ['messages:markRead']    = 'XS-Phone:messages:markRead',
    ['messages:send']        = 'XS-Phone:messages:send',
    ['messages:createGroup'] = 'XS-Phone:messages:createGroup',
    ['messages:toggleMute']  = 'XS-Phone:messages:toggleMute',
    ['messages:leave']       = 'XS-Phone:messages:leave',

    ['drop:send']            = 'XS-Phone:drop:send',

    ['calls:start']          = 'XS-Phone:calls:start',
    ['calls:answer']         = 'XS-Phone:calls:answer',
    ['calls:decline']        = 'XS-Phone:calls:decline',
    ['calls:hangup']         = 'XS-Phone:calls:hangup',
    ['calls:history']        = 'XS-Phone:calls:history',

    ['pin:verify']           = 'XS-Phone:pin:verify',
    ['pin:set']              = 'XS-Phone:pin:set',

    ['gallery:list']         = 'XS-Phone:gallery:list',
    ['gallery:save']         = 'XS-Phone:gallery:save',
    ['gallery:delete']       = 'XS-Phone:gallery:delete',

    ['wallet:summary']       = 'XS-Phone:wallet:summary',
    ['wallet:transfer']      = 'XS-Phone:wallet:transfer',

    ['notes:list']           = 'XS-Phone:notes:list',
    ['notes:save']           = 'XS-Phone:notes:save',
    ['notes:delete']         = 'XS-Phone:notes:delete',

    ['alarms:list']          = 'XS-Phone:alarms:list',
    ['alarms:save']          = 'XS-Phone:alarms:save',
    ['alarms:toggle']        = 'XS-Phone:alarms:toggle',
    ['alarms:delete']        = 'XS-Phone:alarms:delete',

    ['social:me']            = 'XS-Phone:social:me',
    ['social:createProfile'] = 'XS-Phone:social:createProfile',
    ['social:updateProfile'] = 'XS-Phone:social:updateProfile',
    ['social:feed']          = 'XS-Phone:social:feed',
    ['social:post']          = 'XS-Phone:social:post',
    ['social:like']          = 'XS-Phone:social:like',
    ['social:delete']        = 'XS-Phone:social:delete',
    ['social:thread']        = 'XS-Phone:social:thread',
    ['social:profile']       = 'XS-Phone:social:profile',
    ['social:follow']        = 'XS-Phone:social:follow',

    ['mail:me']              = 'XS-Phone:mail:me',
    ['mail:signup']          = 'XS-Phone:mail:signup',
    ['mail:login']           = 'XS-Phone:mail:login',
    ['mail:logout']          = 'XS-Phone:mail:logout',
    ['mail:list']            = 'XS-Phone:mail:list',
    ['mail:send']            = 'XS-Phone:mail:send',
    ['mail:read']            = 'XS-Phone:mail:read',
    ['mail:delete']          = 'XS-Phone:mail:delete',

    ['social:login']         = 'XS-Phone:social:login',
    ['social:logout']        = 'XS-Phone:social:logout',
    ['match:login']          = 'XS-Phone:match:login',
    ['match:logout']         = 'XS-Phone:match:logout',

    ['market:list']          = 'XS-Phone:market:list',
    ['market:post']          = 'XS-Phone:market:post',
    ['market:delete']        = 'XS-Phone:market:delete',

    ['city:list']            = 'XS-Phone:city:list',
    ['city:setAnnouncement'] = 'XS-Phone:city:setAnnouncement',

    ['phone:changeNumber']   = 'XS-Phone:phone:changeNumber',

    ['darkchat:rooms']       = 'XS-Phone:darkchat:rooms',
    ['darkchat:create']      = 'XS-Phone:darkchat:create',
    ['darkchat:join']        = 'XS-Phone:darkchat:join',
    ['darkchat:messages']    = 'XS-Phone:darkchat:messages',
    ['darkchat:send']        = 'XS-Phone:darkchat:send',
    ['darkchat:leave']       = 'XS-Phone:darkchat:leave',

    ['prism:feed']           = 'XS-Phone:prism:feed',
    ['prism:post']           = 'XS-Phone:prism:post',
    ['prism:like']           = 'XS-Phone:prism:like',
    ['prism:comments']       = 'XS-Phone:prism:comments',
    ['prism:comment']        = 'XS-Phone:prism:comment',
    ['prism:delete']         = 'XS-Phone:prism:delete',
    ['prism:profile']        = 'XS-Phone:prism:profile',

    ['garage:list']          = 'XS-Phone:garage:list',
    ['garage:ping']          = 'XS-Phone:garage:ping',
    ['garage:valet']         = 'XS-Phone:garage:valet',

    ['gallery:importUrl']    = 'XS-Phone:gallery:importUrl',

    ['store:install']        = 'XS-Phone:store:install',
    ['store:uninstall']      = 'XS-Phone:store:uninstall',

    ['match:me']             = 'XS-Phone:match:me',
    ['match:saveProfile']    = 'XS-Phone:match:saveProfile',
    ['match:deck']           = 'XS-Phone:match:deck',
    ['match:swipe']          = 'XS-Phone:match:swipe',
    ['match:matches']        = 'XS-Phone:match:matches',
    ['match:unmatch']        = 'XS-Phone:match:unmatch',
    ['match:unswipe']        = 'XS-Phone:match:unswipe',

    ['music:list']           = 'XS-Phone:music:list',
    ['music:add']            = 'XS-Phone:music:add',
    ['music:delete']         = 'XS-Phone:music:delete',
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
    cb(lib.callback.await('XS-Phone:drop:scan', false, { ids = GetNearbyPlayerIds() }))
end)

RegisterNUICallback('dropRespond', function(data, cb)
    TriggerServerEvent('XS-Phone:drop:respond', data and data.accept == true)
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

local MUSIC_ID = 'XS-Phone-music'

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
    local res = lib.callback.await('XS-Phone:saveSettings', false, data)
    if res and res.ok and type(data) == 'table' then
        ClientSettings = data
    end
    cb(res)
end)

local torchOn = false

RegisterNUICallback('torch', function(data, cb)
    local want = data and data.on == true
    if want == torchOn then
        cb({ ok = true })
        return
    end
    torchOn = want

    if torchOn then
        CreateThread(function()
            while torchOn do
                local ped = PlayerPedId()
                local pos = GetEntityCoords(ped)
                local fwd = GetEntityForwardVector(ped)
                local from = pos + fwd * 0.35 + vector3(0.0, 0.0, 0.55)
                DrawSpotLight(
                    from.x, from.y, from.z,
                    fwd.x, fwd.y, fwd.z - 0.12,
                    255, 250, 235,
                    22.0, 2.0, 0.0, 11.0, 1.2
                )
                Wait(0)
            end
        end)
    end

    cb({ ok = true })
end)

AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() then torchOn = false end
end)
