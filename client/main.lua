local phoneOpen = false
local phoneProp = 0

local ANIM = {
    dict = 'cellphone@',
    text = 'cellphone_text_read_base',
}

local function attachProp()
    if phoneProp ~= 0 then return end
    local model = `prop_amb_phone`
    if not (pcall(lib.requestModel, model, 2000) and HasModelLoaded(model)) then return end

    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    phoneProp = CreateObject(model, coords.x, coords.y, coords.z + 0.2, true, true, false)
    AttachEntityToEntity(phoneProp, ped, GetPedBoneIndex(ped, 28422),
        0.0, 0.0, 0.0, 0.0, 0.0, 0.0, true, true, false, true, 1, true)
    SetModelAsNoLongerNeeded(model)
end

local function removeProp()
    if phoneProp == 0 then return end
    DeleteEntity(phoneProp)
    phoneProp = 0
end

local function playTextAnim()
    if not (pcall(lib.requestAnimDict, ANIM.dict, 2000) and HasAnimDictLoaded(ANIM.dict)) then return end
    TaskPlayAnim(PlayerPedId(), ANIM.dict, ANIM.text, 8.0, -8.0, -1, 49, 0, false, false, false)
end

local function stopAnim()
    StopAnimTask(PlayerPedId(), ANIM.dict, ANIM.text, 1.0)
end

function PhoneCameraStance(on)
    if on then
        stopAnim()
        removeProp()
    elseif phoneOpen then
        attachProp()
        playTextAnim()
    end
end

function AwaitServer(name, ...)
    local args = { ... }
    local done, result = false, nil
    CreateThread(function()
        local ok, res = pcall(lib.callback.await, name, false, table.unpack(args))
        result = ok and res or nil
        done = true
    end)
    local deadline = GetGameTimer() + 8000
    while not done and GetGameTimer() < deadline do Wait(25) end
    if not done then
        print(('^1[XS-Phone]^0 no reply from %s — the server side of XS-Phone is not responding. Check the SERVER console for a startup error.'):format(name))
        return nil
    end
    return result
end

local function canOpen()
    if phoneOpen then return false end
    if IsPauseMenuActive() then return false end

    if not Config.Phone.AllowWhenDead and IsEntityDead(PlayerPedId()) then
        Framework.Notify('You can\'t use your phone right now', 'error')
        return false
    end

    if Config.Phone.Item.enabled then
        local res = AwaitServer('XS-Phone:hasPhone')
        if res == nil then
            Framework.Notify('Phone server not responding — check the server console', 'error')
            return false
        end
        if not res.ok or not res.has then
            Framework.Notify('You don\'t have a phone', 'error')
            return false
        end
    end

    return true
end

function OpenPhone()
    if not canOpen() then return end

    local res = AwaitServer('XS-Phone:getPhoneData')
    if res == nil then
        Framework.Notify('Phone server not responding — check the server console', 'error')
        return
    end
    if not res.ok then
        Framework.Notify('Your phone won\'t turn on', 'error')
        return
    end

    ClientSettings = res.data.settings

    phoneOpen = true
    attachProp()
    playTextAnim()
    SetNuiFocus(true, true)
    SetNuiFocusKeepInput(true)
    startControlThread()
    SendNUIMessage({ action = 'phone:open', data = res.data })
end

local DISABLED_CONTROLS = {
    1, 2, 14, 15, 16, 17, 24, 25, 37, 44, 45, 47, 58,
    140, 141, 142, 143, 199, 200, 257, 263, 264,
}

function startControlThread()
    CreateThread(function()
        while phoneOpen do
            for _, control in ipairs(DISABLED_CONTROLS) do
                if not (PhoneCameraActive and (control == 1 or control == 2)) then
                    DisableControlAction(0, control, true)
                end
            end
            Wait(0)
        end
    end)
end

function ClosePhone()
    if not phoneOpen then return end
    phoneOpen = false
    StopPhoneCamera()
    SetNuiFocusKeepInput(false)
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'phone:close' })
    stopAnim()
    removeProp()
end

function IsPhoneOpen()
    return phoneOpen
end
exports('IsPhoneOpen', IsPhoneOpen)

CreateThread(function()
    while true do
        if phoneOpen then
            local ped = PlayerPedId()
            if not Config.Phone.AllowWhenDead and IsEntityDead(ped) then
                ClosePhone()
            elseif not PhoneCameraActive and not IsEntityPlayingAnim(ped, ANIM.dict, ANIM.text, 3) and not IsPedRagdoll(ped) then
                playTextAnim()
            end
            Wait(400)
        else
            Wait(800)
        end
    end
end)

RegisterCommand(Config.Phone.Command, function()
    if phoneOpen then ClosePhone() else OpenPhone() end
end, false)
RegisterKeyMapping(Config.Phone.Command, 'Open phone', 'keyboard', Config.Phone.OpenKey)

RegisterNetEvent('XS-Phone:client:use', function()
    if phoneOpen then ClosePhone() else OpenPhone() end
end)

local function quietMode()
    return ClientSettings ~= nil and ClientSettings.dnd == true
end

RegisterNetEvent('XS-Phone:client:newMessage', function(payload)
    SendNUIMessage({ action = 'phone:newMessage', data = payload })
    if not phoneOpen and not quietMode() then
        local msg = payload.message or {}
        local who = payload.fromName or msg.sender or 'New message'
        local body = msg.body
        if not body or body == '' then
            body = msg.location and 'Shared a location' or (msg.media and 'Sent a photo' or 'New message')
        end
        if #body > 80 then body = body:sub(1, 77) .. '...' end
        Framework.Notify(who .. ': ' .. body, 'inform')
        PlaySoundFrontend(-1, 'Text_Arrive_Tone', 'Phone_SoundSet_Default', true)
    end
end)

RegisterNetEvent('XS-Phone:client:pushNotify', function(n)
    SendNUIMessage({ action = 'phone:notify', data = n })
    if not phoneOpen and not quietMode() then
        Framework.Notify(n.body and (n.title .. ': ' .. n.body) or n.title, 'inform')
    end
end)

RegisterNetEvent('XS-TaxiJob:client:rideStatus', function(status)
    SendNUIMessage({ action = 'phone:taxiStatus', data = status })
end)

RegisterNetEvent('XS-Phone:client:lineMessage', function(payload)
    SendNUIMessage({ action = 'phone:lineMessage', data = payload })
    if not phoneOpen and not quietMode() and not payload.reply then
        local msg = payload.message or {}
        local body = msg.body
        if not body or body == '' then body = msg.location and 'Shared a location' or 'New message' end
        if #body > 80 then body = body:sub(1, 77) .. '...' end
        Framework.Notify(('%s · %s: %s'):format(payload.label or payload.line, msg.sender or '?', body), 'inform')
        PlaySoundFrontend(-1, 'Text_Arrive_Tone', 'Phone_SoundSet_Default', true)
    end
end)

RegisterNetEvent('XS-Phone:client:homeChanged', function()
    SendNUIMessage({ action = 'phone:homeChanged' })
end)

RegisterNetEvent('XS-Phone:client:billsChanged', function()
    SendNUIMessage({ action = 'phone:billsChanged' })
end)

RegisterNetEvent('qb-phone:client:AcceptorDenyInvoice', function(_, _, job, _, amount)
    local n = { app = 'wallet', title = 'New bill', body = ('$%s from %s'):format(tonumber(amount) or 0, tostring(job or 'a business')) }
    SendNUIMessage({ action = 'phone:notify', data = n })
    SendNUIMessage({ action = 'phone:billsChanged' })
    if not phoneOpen and not quietMode() then Framework.Notify(n.title .. ': ' .. n.body, 'inform') end
end)

RegisterNetEvent('XS-Phone:client:darkchat', function(payload)
    SendNUIMessage({ action = 'phone:darkchat', data = payload })
end)

RegisterNetEvent('QBCore:Client:OnPlayerUnload', function()
    ClosePhone()
    ClientSettings = nil
end)

AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    StopPhoneCamera()
    SetNuiFocus(false, false)
    stopAnim()
    removeProp()
end)
