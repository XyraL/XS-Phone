local valet = nil

local function vehicleName(model)
    local display = GetDisplayNameFromVehicleModel(model)
    if display and display ~= 'CARNOTFOUND' then
        local label = GetLabelText(display)
        if label and label ~= 'NULL' then return label end
        return display
    end
    return 'Your car'
end

local function nuiValet(data)
    SendNUIMessage({ action = 'phone:valet', data = data })
end

local function tell(title, body)
    SendNUIMessage({ action = 'phone:notify', data = { app = 'garage', title = title, body = body } })
    if not IsPhoneOpen() and not (ClientSettings and ClientSettings.dnd == true) then
        Framework.Notify(body, 'inform')
        PlaySoundFrontend(-1, 'Text_Arrive_Tone', 'Phone_SoundSet_Default', true)
    end
end

local function loadModel(model)
    if not IsModelInCdimage(model) then return false end
    return pcall(lib.requestModel, model, 10000)
end

local function spawnPoint(me, distance)
    for _ = 1, 12 do
        local angle = math.random() * math.pi * 2
        local probe = vector3(me.x + math.cos(angle) * distance, me.y + math.sin(angle) * distance, me.z)
        local found, node, heading = GetClosestVehicleNodeWithHeading(probe.x, probe.y, probe.z, 1, 3.0, 0)
        if found and #(node - me) > distance * 0.55 then return node, heading end
    end
    return nil
end

local function besideMe(ped)
    local me = GetEntityCoords(ped)
    local found, node, heading = GetClosestVehicleNodeWithHeading(me.x, me.y, me.z, 1, 3.0, 0)
    if found and #(node - me) < 60.0 then return node, heading end
    local pos = me + GetEntityForwardVector(ped) * 5.0
    local okZ, groundZ = GetGroundZFor_3dCoord(pos.x, pos.y, pos.z + 5.0, false)
    return vector3(pos.x, pos.y, okZ and groundZ or pos.z), GetEntityHeading(ped)
end

local function roadDistance(a, b)
    local d = CalculateTravelDistanceBetweenPoints(a.x, a.y, a.z, b.x, b.y, b.z)
    if not d or d <= 0 or d > 50000 then d = #(a - b) * 1.35 end
    return d
end

local function clearValet(keepCar)
    if not valet then return end
    if valet.driver and DoesEntityExist(valet.driver) then
        local driver = valet.driver
        if keepCar then
            SetTimeout(20000, function() if DoesEntityExist(driver) then DeleteEntity(driver) end end)
        else
            DeleteEntity(driver)
        end
    end
    if valet.blip and DoesBlipExist(valet.blip) then
        local blip = valet.blip
        SetBlipFlashes(blip, true)
        SetTimeout(20000, function() if DoesBlipExist(blip) then RemoveBlip(blip) end end)
    end
    valet = nil
end

local ARRIVED = {
    here = 'Your %s is here.',
    nearby = 'Your %s is parked nearby.',
    beside = 'Your %s is parked beside you.',
}

local function arrived(how)
    local v = valet
    if not v then return end
    SetVehicleDoorsLocked(v.veh, 1)
    if v.driver and DoesEntityExist(v.driver) and how ~= 'beside' then
        TaskVehicleTempAction(v.driver, v.veh, 27, 2500)
        Wait(1600)
        if how == 'nearby' then StartVehicleHorn(v.veh, 350, GetHashKey('HELDDOWN'), false) end
        TaskLeaveVehicle(v.driver, v.veh, 0)
        Wait(2200)
        TaskWanderStandard(v.driver, 10.0, 10)
        SetPedKeepTask(v.driver, true)
        SetVehicleEngineOn(v.veh, true, true, false)
    end
    nuiValet({ phase = 'arrived', plate = v.plate, label = v.label })
    tell('Valet', (ARRIVED[how] or ARRIVED.here):format(v.label))
    TriggerServerEvent('XS-Phone:valetDone')
    clearValet(true)
end

local function placeBeside()
    local v = valet
    if not v then return end
    if v.driver and DoesEntityExist(v.driver) then DeleteEntity(v.driver) end
    v.driver = nil
    local pos, heading = besideMe(PlayerPedId())
    SetEntityCoords(v.veh, pos.x, pos.y, pos.z + 0.5, false, false, false, false)
    SetEntityHeading(v.veh, heading)
    SetVehicleOnGroundProperly(v.veh)
    SetVehicleEngineOn(v.veh, false, true, false)
    arrived('beside')
end

local TASK_DRIVE = joaat('SCRIPT_TASK_VEHICLE_DRIVE_TO_COORD_LONGRANGE')

local function jammed(veh)
    return IsVehicleStuckTimerUp(veh, 0, 4000) or IsVehicleStuckTimerUp(veh, 1, 4000)
        or IsVehicleStuckTimerUp(veh, 2, 8000) or IsVehicleStuckTimerUp(veh, 3, 12000)
end

local function giveUp(v)
    local dist = #(GetEntityCoords(v.veh) - GetEntityCoords(PlayerPedId()))
    if dist < 90.0 or (dist < 220.0 and IsEntityOnScreen(v.veh)) then
        if IsEntityUpsidedown(v.veh) or not IsVehicleOnAllWheels(v.veh) then SetVehicleOnGroundProperly(v.veh) end
        arrived('nearby')
    else
        placeBeside()
    end
end

local function drive(data)
    local v = valet
    local speed = (tonumber(data.speed) or 18.0) + 0.0
    local style = tonumber(data.style) or 786603
    local timeout = (tonumber(data.timeout) or 240) * 1000
    local started = GetGameTimer()
    local target = GetEntityCoords(PlayerPedId())
    local lastPos = GetEntityCoords(v.veh)
    local still, running = 0, false

    TaskVehicleDriveToCoordLongrange(v.driver, v.veh, target.x, target.y, target.z, speed, style, 8.0)

    while valet == v do
        Wait(1000)
        if not DoesEntityExist(v.veh) then
            nuiValet({ phase = 'cancelled', plate = v.plate })
            clearValet(false)
            TriggerServerEvent('XS-Phone:valetDone')
            return
        end
        local ped = PlayerPedId()
        local me = GetEntityCoords(ped)
        local pos = GetEntityCoords(v.veh)
        local dist = #(pos - me)

        if dist < 14.0 then arrived('here') return end

        if not DoesEntityExist(v.driver) or IsPedDeadOrDying(v.driver, true) or GetPedInVehicleSeat(v.veh, -1) ~= v.driver then
            giveUp(v)
            return
        end

        local moving = #(pos - lastPos) >= 1.5
        local atLights = IsVehicleStoppedAtTrafficLights(v.veh)
        lastPos = pos
        if moving or atLights then still = 0 else still += 1 end

        local status = GetScriptTaskStatus(v.driver, TASK_DRIVE)
        if status ~= 7 then running = true end
        local finished = running and status == 7 and not moving

        if #(me - target) > 30.0 or (finished and #(me - target) > 12.0) then
            target = me
            running = false
            TaskVehicleDriveToCoordLongrange(v.driver, v.veh, target.x, target.y, target.z, speed, style, 8.0)
        elseif finished then
            if dist < 90.0 then arrived('nearby') else giveUp(v) end
            return
        end

        if (not atLights and jammed(v.veh)) or still >= 40 or GetGameTimer() - started > timeout then
            giveUp(v)
            return
        end

        local road = roadDistance(pos, me)
        nuiValet({
            phase = 'coming', plate = v.plate, label = v.label,
            eta = math.max(5, math.floor(road / (speed * 0.62))),
            dist = math.floor(road), x = pos.x, y = pos.y,
        })
    end
end

RegisterNetEvent('XS-Phone:client:valetDrive', function(data)
    if valet then return end
    local ped = PlayerPedId()
    local me = GetEntityCoords(ped)

    local model = type(data.model) == 'number' and data.model or joaat(tostring(data.model))
    if not IsModelInCdimage(model) or not IsModelAVehicle(model) or not loadModel(model) then
        TriggerServerEvent('XS-Phone:valetFailed')
        return
    end

    local driverModel = joaat(tostring(data.driver or 's_m_y_valet_01'))
    local driving = data.drive ~= false and loadModel(driverModel)
    local start, heading
    if driving then start, heading = spawnPoint(me, tonumber(data.distance) or 260.0) end
    if not start then
        driving = false
        start, heading = besideMe(ped)
    end

    local veh = CreateVehicle(model, start.x, start.y, start.z + 0.5, heading, true, false)
    SetModelAsNoLongerNeeded(model)
    if veh == 0 then
        TriggerServerEvent('XS-Phone:valetFailed')
        return
    end

    SetEntityAsMissionEntity(veh, true, true)
    SetVehicleOnGroundProperly(veh)
    SetVehicleNumberPlateText(veh, data.plate)
    if data.mods and data.mods ~= '' then
        local props = json.decode(data.mods)
        if props then pcall(lib.setVehicleProperties, veh, props) end
    end
    SetVehicleDoorsLocked(veh, 1)
    TriggerServerEvent('XS-Phone:valetOk', NetworkGetNetworkIdFromEntity(veh))

    local blip = AddBlipForEntity(veh)
    SetBlipSprite(blip, 225)
    SetBlipColour(blip, 3)
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentSubstringPlayerName('Valet')
    EndTextCommandSetBlipName(blip)

    valet = { veh = veh, blip = blip, plate = data.plate, label = vehicleName(model) }

    if not driving then
        SetVehicleEngineOn(veh, false, true, false)
        arrived('beside')
        return
    end

    local driver = CreatePedInsideVehicle(veh, 26, driverModel, -1, true, false)
    SetModelAsNoLongerNeeded(driverModel)
    if driver == 0 then
        placeBeside()
        return
    end
    valet.driver = driver
    SetBlockingOfNonTemporaryEvents(driver, true)
    SetPedKeepTask(driver, true)
    SetDriverAbility(driver, 1.0)
    SetDriverAggressiveness(driver, 0.0)
    SetEntityInvincible(driver, true)
    SetPedCanBeDraggedOut(driver, false)
    SetVehicleEngineOn(veh, true, true, false)

    nuiValet({ phase = 'coming', plate = data.plate, label = valet.label,
        eta = math.floor(roadDistance(start, me) / ((tonumber(data.speed) or 18.0) * 0.62)),
        x = start.x, y = start.y })
    tell('Valet', ('A valet is driving your %s over.'):format(valet.label))
    drive(data)
end)

local function flash(veh, times)
    CreateThread(function()
        for _ = 1, times do
            SetVehicleLights(veh, 2)
            SetVehicleIndicatorLights(veh, 0, true)
            SetVehicleIndicatorLights(veh, 1, true)
            Wait(220)
            SetVehicleLights(veh, 0)
            SetVehicleIndicatorLights(veh, 0, false)
            SetVehicleIndicatorLights(veh, 1, false)
            Wait(180)
        end
    end)
end

RegisterNetEvent('XS-Phone:client:carRemote', function(netId, action)
    local veh = NetworkGetEntityFromNetworkId(tonumber(netId) or 0)
    if veh == 0 or not DoesEntityExist(veh) then return end
    if action == 'honk' then
        StartVehicleHorn(veh, 1400, GetHashKey('HELDDOWN'), false)
        flash(veh, 3)
    elseif action == 'lights' then
        flash(veh, 4)
    elseif action == 'engine_on' then
        SetVehicleEngineOn(veh, true, true, false)
        flash(veh, 1)
    elseif action == 'engine_off' then
        SetVehicleEngineOn(veh, false, true, true)
    elseif action == 'lock' then
        PlayVehicleDoorCloseSound(veh, 1)
        flash(veh, 2)
    elseif action == 'unlock' then
        PlayVehicleDoorOpenSound(veh, 0)
        flash(veh, 1)
    end
end)

RegisterNetEvent('XS-Phone:client:valetKeys', function(plate)
    pcall(function() TriggerEvent('vehiclekeys:client:SetOwner', plate) end)
end)

AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() or not valet then return end
    if valet.driver and DoesEntityExist(valet.driver) then DeleteEntity(valet.driver) end
    if valet.blip and DoesBlipExist(valet.blip) then RemoveBlip(valet.blip) end
end)
