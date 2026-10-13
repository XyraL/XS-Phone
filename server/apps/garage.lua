local function cfg()
    return Config.Phone.Garage
end

local function trimPlate(p)
    return (tostring(p or ''):gsub('^%s+', ''):gsub('%s+$', ''))
end

local function normPlate(p)
    return trimPlate(p):upper()
end

local function modelOf(row)
    local name = tostring(row.vehicle or '')
    if name ~= '' and not name:find('[{%[]') then
        return name, nil
    end
    local hash = tonumber(row.hash)
    if not hash then
        local okd, props = pcall(json.decode, tostring(row.mods or ''))
        if okd and type(props) == 'table' then hash = tonumber(props.model) end
    end
    return nil, hash
end

local function parkingMode(row)
    local mode = cfg().stateFrom or 'auto'
    if mode ~= 'auto' then return mode end
    if row.in_garage ~= nil then return 'in_garage' end
    if row.stored ~= nil then return 'stored' end
    return 'state'
end

local function stateOf(row)
    if DbBool(row.impound) or DbBool(row.impounded) then return 2 end

    local mode = parkingMode(row)
    if mode == 'in_garage' then return DbBool(row.in_garage) and 1 or 0 end
    if mode == 'stored' then return DbBool(row.stored) and 1 or 0 end

    local s = row.state
    if s == true then return 1 end
    s = tonumber(s)
    if s == 1 or s == 2 then return s end
    return 0
end

local function setParked(citizenid, row, mode, parked)
    local sets, args = {}, {}
    if mode == 'in_garage' or mode == 'stored' then
        sets[#sets + 1] = ('`%s` = ?'):format(mode)
        args[#args + 1] = parked and 1 or 0
    end
    if row.state ~= nil then
        sets[#sets + 1] = '`state` = ?'
        args[#args + 1] = parked and 1 or 0
    end
    if #sets == 0 then return false end

    args[#args + 1] = citizenid
    args[#args + 1] = row.plate
    local ok = pcall(MySQL.update.await, ('UPDATE `%s` SET %s WHERE citizenid = ? AND plate = ?')
        :format(cfg().table, table.concat(sets, ', ')), args)
    return ok
end

local function ownedPlate(src, plate)
    local citizenid = Framework.GetCitizenId(src)
    if not citizenid then return nil end
    plate = tostring(plate or ''):sub(1, 12)
    local ok, row = pcall(MySQL.single.await, ([[
        SELECT * FROM `%s`
        WHERE citizenid = ? AND plate = ? LIMIT 1
    ]]):format(cfg().table), { citizenid, plate })
    if not ok then return nil end
    return row
end

local function findVehicle(plate)
    local wanted = normPlate(plate)
    if wanted == '' then return nil end
    for _, veh in ipairs(GetAllVehicles()) do
        if DoesEntityExist(veh) and normPlate(GetVehicleNumberPlateText(veh)) == wanted then return veh end
    end
    return nil
end

local function sharedKey(cid, plate)
    return MySQL.single.await([[
        SELECT * FROM phone_car_keys
        WHERE holder_cid = ? AND plate = ? AND revoked = 0 AND (expires_at IS NULL OR expires_at > ?)
    ]], { cid, tostring(plate or ''):sub(1, 12), os.time() })
end

local function access(src, plate)
    local row = ownedPlate(src, plate)
    if row then return row.plate, 'owner', row end
    local cid = Framework.GetCitizenId(src)
    local key = cid and cfg().Keys and cfg().Keys.enabled ~= false and sharedKey(cid, plate)
    if key then return key.plate, 'holder', key end
    return nil
end

local function entityFromNet(netId)
    local veh = 0
    for _ = 1, 30 do
        veh = NetworkGetEntityFromNetworkId(tonumber(netId) or 0)
        if veh ~= 0 and DoesEntityExist(veh) then return veh end
        Wait(100)
    end
    return nil
end

local KEYS = {
    {
        res = 'qbx_vehiclekeys',
        give = function(src, _, veh) if veh then exports.qbx_vehiclekeys:GiveKeys(src, veh, true) return true end end,
        remove = function(src, _, veh) if veh then exports.qbx_vehiclekeys:RemoveKeys(src, veh, true) return true end end,
        lock = function(veh, locked) exports.qbx_vehiclekeys:SetLockState(veh, locked and 'lock' or 'unlock') return true end,
    },
    {
        res = 'qb-vehiclekeys',
        give = function(src, plate) exports['qb-vehiclekeys']:GiveKeys(src, plate) return true end,
        remove = function(src, plate) exports['qb-vehiclekeys']:RemoveKeys(src, plate) return true end,
    },
    {
        res = 'Renewed-Vehiclekeys',
        give = function(src, plate) exports['Renewed-Vehiclekeys']:addKey(src, plate) return true end,
        remove = function(src, plate) exports['Renewed-Vehiclekeys']:removeKey(src, plate) return true end,
        lock = function(veh, locked) Entity(veh).state:set('vehicleLock', { lock = locked and 2 or 1, sound = true }, true) return true end,
    },
    {
        res = 'wasabi_carlock',
        give = function(src, plate) return exports.wasabi_carlock:GiveKey(src, plate) ~= false end,
        remove = function(src, plate) return exports.wasabi_carlock:RemoveKey(src, plate) ~= false end,
    },
    {
        res = 'mk_vehiclekeys',
        give = function(src, _, veh) if veh then exports.mk_vehiclekeys:AddKey(veh, src) return true end end,
        remove = function(src, _, veh) if veh then exports.mk_vehiclekeys:RemoveKey(veh, src) return true end end,
    },
    {
        res = 'vehicles_keys',
        give = function(src, plate) exports.vehicles_keys:giveVehicleKeysToPlayerId(src, plate, 'temporary') return true end,
        remove = function(src, plate) exports.vehicles_keys:removeKeysFromPlayerId(src, plate) return true end,
    },
    {
        res = 'cd_garage',
        give = function(src, plate) TriggerClientEvent('cd_garage:AddKeys', src, plate) return true end,
        remove = function(src, plate) TriggerClientEvent('cd_garage:RemoveKeys', src, plate) return true end,
    },
    {
        res = 'okokGarage',
        remove = function(src, plate) TriggerEvent('okokGarage:RemoveKeys', plate, src) return true end,
    },
}

local function keySystem(need)
    for _, k in ipairs(KEYS) do
        if GetResourceState(k.res) == 'started' and k[need] then return k end
    end
    return nil
end

local function giveKeys(src, plate, veh)
    plate = trimPlate(plate)
    if plate == '' then return end
    local k = keySystem('give')
    if k then
        local ok, done = pcall(k.give, src, plate, veh)
        if ok and done then return end
    end
    TriggerClientEvent('XS-Phone:client:valetKeys', src, plate)
end

local function removeKeys(src, plate, veh)
    plate = trimPlate(plate)
    if plate == '' or not src then return false end
    local k = keySystem('remove')
    if not k then return true end
    local ok, done = pcall(k.remove, src, plate, veh)
    return ok and done == true
end

local function setLock(veh, locked)
    local k = keySystem('lock')
    if k and pcall(k.lock, veh, locked) then return end
    SetVehicleDoorsLocked(veh, locked and 2 or 1)
end

local function sourceForCid(cid)
    for _, id in ipairs(GetPlayers()) do
        local s = tonumber(id)
        if Framework.GetCitizenId(s) == cid then return s end
    end
    return nil
end

local function liveOf(veh, src)
    local pos = GetEntityCoords(veh)
    local me = GetEntityCoords(GetPlayerPed(src))
    return {
        x = pos.x, y = pos.y,
        dist = math.floor(#(pos - me)),
        locked = (GetVehicleDoorLockStatus(veh) or 0) >= 2,
        engine = GetIsVehicleEngineRunning(veh) == true or GetIsVehicleEngineRunning(veh) == 1,
    }
end

PhoneCallback('XS-Phone:garage:list', function(src)
    if not cfg().enabled then return { ok = false, error = 'disabled' } end

    local citizenid = Framework.GetCitizenId(src)
    if not citizenid then return { ok = false, error = 'no_character' } end
    AwaitDB()

    local ok, rows = pcall(MySQL.query.await, ([[
        SELECT * FROM `%s` WHERE citizenid = ? ORDER BY plate ASC
    ]]):format(cfg().table), { citizenid })

    if not ok or type(rows) ~= 'table' then
        return { ok = false, error = 'no_table' }
    end

    local out = {}
    for _, v in ipairs(rows) do
        local name, hash = modelOf(v)
        local state = stateOf(v)
        local entry = {
            model = name,
            hash = hash,
            plate = v.plate,
            garage = v.garage or v.garage_id,
            state = state,
            fuel = math.floor(tonumber(v.fuel) or 0),
            engine = math.floor((tonumber(v.engine) or 1000) / 10),
            body = math.floor((tonumber(v.body) or 1000) / 10),
        }
        if state == 0 then
            local veh = findVehicle(v.plate)
            if veh then entry.live = liveOf(veh, src) end
        end
        out[#out + 1] = entry
    end
    return { ok = true, data = {
        vehicles = out,
        ping = { enabled = cfg().Ping.enabled },
        valet = {
            enabled = cfg().Valet.enabled,
            cost = cfg().Valet.cost or 250,
            drive = cfg().Valet.drive ~= false,
        },
        remote = { enabled = cfg().Remote and cfg().Remote.enabled ~= false, range = cfg().Remote and cfg().Remote.range or 150.0 },
        keys = { enabled = cfg().Keys and cfg().Keys.enabled ~= false },
        images = cfg().images or '',
    } }
end)

PhoneCallback('XS-Phone:garage:ping', function(src, data)
    if not cfg().Ping.enabled then return { ok = false, error = 'disabled' } end
    if not RateOK(src, 'garagePing') then return { ok = false, error = 'rate_limited' } end

    local plate = access(src, data and data.plate)
    if not plate then return { ok = false, error = 'not_yours' } end
    local veh = findVehicle(plate)
    if not veh then return { ok = false, error = 'not_found' } end
    local coords = GetEntityCoords(veh)
    return { ok = true, data = { x = coords.x, y = coords.y } }
end)

PhoneCallback('XS-Phone:garage:car', function(src, data)
    local plate, role = access(src, data and data.plate)
    if not plate then return { ok = false, error = 'not_yours' } end
    local veh = findVehicle(plate)
    local holders = {}
    if role == 'owner' and cfg().Keys and cfg().Keys.enabled ~= false then
        local rows = MySQL.query.await([[
            SELECT holder_cid, holder_number, expires_at FROM phone_car_keys
            WHERE plate = ? AND owner_cid = ? AND revoked = 0 AND (expires_at IS NULL OR expires_at > ?)
        ]], { plate, Framework.GetCitizenId(src), os.time() }) or {}
        for _, r in ipairs(rows) do
            holders[#holders + 1] = { cid = r.holder_cid, number = r.holder_number, expires = r.expires_at and r.expires_at * 1000 or nil }
        end
    end
    return { ok = true, data = { role = role, live = veh and liveOf(veh, src) or nil, holders = holders } }
end)

local REMOTE = { lock = true, unlock = true, honk = true, lights = true, engine_on = true, engine_off = true }

PhoneCallback('XS-Phone:garage:remote', function(src, data)
    local remote = cfg().Remote
    if not remote or remote.enabled == false then return { ok = false, error = 'disabled' } end
    if type(data) ~= 'table' or not REMOTE[data.action] then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'garageRemote') then return { ok = false, error = 'rate_limited' } end

    local plate, role = access(src, data.plate)
    if not plate then return { ok = false, error = 'not_yours' } end
    local veh = findVehicle(plate)
    if not veh then return { ok = false, error = 'not_found' } end

    local live = liveOf(veh, src)
    local range = tonumber(remote.range) or 150.0
    if range > 0 and live.dist > range then return { ok = false, error = 'too_far', dist = live.dist } end

    local action = data.action
    if action == 'lock' or action == 'unlock' then
        setLock(veh, action == 'lock')
        live.locked = action == 'lock'
    elseif action == 'engine_on' or action == 'engine_off' then
        live.engine = action == 'engine_on'
    end
    if role == 'holder' and (action == 'unlock' or action == 'engine_on') then
        giveKeys(src, plate, veh)
    end

    local netId = NetworkGetNetworkIdFromEntity(veh)
    if action == 'honk' then
        local pos = GetEntityCoords(veh)
        for _, id in ipairs(GetPlayers()) do
            local s = tonumber(id)
            local ped = GetPlayerPed(s)
            if ped ~= 0 and #(GetEntityCoords(ped) - pos) < 160.0 then
                TriggerClientEvent('XS-Phone:client:carRemote', s, netId, action)
            end
        end
        return { ok = true, data = live }
    end

    local owner = NetworkGetEntityOwner(veh)
    if owner and owner > 0 then
        TriggerClientEvent('XS-Phone:client:carRemote', owner, netId, action)
    elseif action ~= 'lock' and action ~= 'unlock' then
        return { ok = false, error = 'asleep' }
    end
    return { ok = true, data = live }
end)

PhoneCallback('XS-Phone:garage:keys', function(src)
    local cid = Framework.GetCitizenId(src)
    if not cid then return { ok = false, error = 'no_character' } end
    if not cfg().Keys or cfg().Keys.enabled == false then return { ok = true, data = { shared = {} } } end
    local rows = MySQL.query.await([[
        SELECT k.plate, k.model, k.hash, k.owner_cid, k.expires_at, p.charinfo
        FROM phone_car_keys k LEFT JOIN players p ON p.citizenid = k.owner_cid
        WHERE k.holder_cid = ? AND k.revoked = 0 AND (k.expires_at IS NULL OR k.expires_at > ?)
    ]], { cid, os.time() }) or {}
    local shared = {}
    for _, r in ipairs(rows) do
        local ok, ci = pcall(json.decode, r.charinfo or '')
        local owner = ok and type(ci) == 'table' and ((ci.firstname or '') .. ' ' .. (ci.lastname or '')) or 'Owner'
        shared[#shared + 1] = {
            plate = r.plate, model = r.model, hash = tonumber(r.hash),
            owner = owner:gsub('^%s+', ''):gsub('%s+$', ''),
            expires = r.expires_at and r.expires_at * 1000 or nil,
        }
    end
    return { ok = true, data = { shared = shared } }
end)

local DURATIONS = { [0] = true, [1] = true, [6] = true, [24] = true, [72] = true }

PhoneCallback('XS-Phone:garage:shareKey', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not cfg().Keys or cfg().Keys.enabled == false then return { ok = false, error = 'disabled' } end
    if not RateOK(src, 'garageKeys') then return { ok = false, error = 'rate_limited' } end
    local me = EnsurePhone(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local row = ownedPlate(src, data.plate)
    if not row then return { ok = false, error = 'not_yours' } end

    local to = NormalizeNumber(tostring(data.to or ''))
    if not to or to == me.number then return { ok = false, error = 'invalid_number' } end
    local holder = MySQL.scalar.await('SELECT citizenid FROM phone_phones WHERE number = ?', { to })
    if not holder then return { ok = false, error = 'invalid_number' } end
    if holder == me.citizenid then return { ok = false, error = 'invalid_number' } end

    local hours = math.floor(tonumber(data.hours) or 0)
    if not DURATIONS[hours] then return { ok = false, error = 'bad_duration' } end

    local count = MySQL.scalar.await([[
        SELECT COUNT(*) FROM phone_car_keys WHERE plate = ? AND holder_cid != ? AND revoked = 0 AND (expires_at IS NULL OR expires_at > ?)
    ]], { row.plate, holder, os.time() }) or 0
    if count >= (cfg().Keys.maxPerCar or 5) then return { ok = false, error = 'full' } end

    local name, hash = modelOf(row)
    MySQL.query.await([[
        INSERT INTO phone_car_keys (plate, owner_cid, holder_cid, holder_number, model, hash, expires_at, revoked)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE owner_cid = VALUES(owner_cid), holder_number = VALUES(holder_number),
            model = VALUES(model), hash = VALUES(hash), expires_at = VALUES(expires_at), revoked = 0
    ]], { row.plate, me.citizenid, holder, to, name, hash, hours > 0 and os.time() + hours * 3600 or nil })

    local target = GetSourceByNumber(to)
    if target then
        TriggerClientEvent('XS-Phone:client:pushNotify', target, {
            app = 'wallet', title = 'Car key received',
            body = ('%s shared a key to %s with you'):format(Framework.GetName(src) or me.number, trimPlate(row.plate)),
        })
    end
    return { ok = true }
end)

local function revoke(plate, holderCid)
    local holderSrc = sourceForCid(holderCid)
    if not holderSrc then
        MySQL.update.await('UPDATE phone_car_keys SET revoked = 1 WHERE plate = ? AND holder_cid = ?', { plate, holderCid })
        return
    end
    local veh = findVehicle(plate)
    if veh then
        local owner = NetworkGetEntityOwner(veh)
        local driver = GetPedInVehicleSeat(veh, -1)
        if owner and owner > 0 and driver ~= 0 and driver == GetPlayerPed(holderSrc) then
            TriggerClientEvent('XS-Phone:client:carRemote', owner, NetworkGetNetworkIdFromEntity(veh), 'engine_off')
        end
    end
    removeKeys(holderSrc, plate, veh)
    MySQL.update.await('DELETE FROM phone_car_keys WHERE plate = ? AND holder_cid = ?', { plate, holderCid })
    TriggerClientEvent('XS-Phone:client:pushNotify', holderSrc, {
        app = 'wallet', title = 'Car key removed', body = ('Your key to %s no longer works'):format(trimPlate(plate)),
    })
end

Framework.OnPlayerLoaded(function(src)
    CreateThread(function()
        Wait(4000)
        local cid = Framework.GetCitizenId(src)
        if not cid then return end
        local rows = MySQL.query.await(
            'SELECT plate FROM phone_car_keys WHERE holder_cid = ? AND revoked = 1', { cid }) or {}
        for _, r in ipairs(rows) do revoke(r.plate, cid) end
    end)
end)

PhoneCallback('XS-Phone:garage:revokeKey', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'garageKeys') then return { ok = false, error = 'rate_limited' } end
    local row = ownedPlate(src, data.plate)
    if not row then return { ok = false, error = 'not_yours' } end
    local exists = MySQL.scalar.await('SELECT 1 FROM phone_car_keys WHERE plate = ? AND holder_cid = ?',
        { row.plate, tostring(data.cid or '') })
    if not exists then return { ok = false, error = 'gone' } end
    revoke(row.plate, tostring(data.cid))
    return { ok = true }
end)

local pendingValet = {}

PhoneCallback('XS-Phone:garage:valet', function(src, data)
    local valet = cfg().Valet
    if not valet.enabled then return { ok = false, error = 'disabled' } end
    if not RateOK(src, 'valet') then return { ok = false, error = 'rate_limited' } end
    if pendingValet[src] and os.time() < pendingValet[src].expires then return { ok = false, error = 'busy' } end

    local row = ownedPlate(src, data and data.plate)
    if not row then return { ok = false, error = 'not_yours' } end
    if stateOf(row) ~= 1 then return { ok = false, error = 'not_garaged' } end

    local name, hash = modelOf(row)
    if not name and not hash then return { ok = false, error = 'no_model' } end

    local cost = valet.cost or 250
    if Framework.GetMoney(src, valet.account or 'bank') < cost then
        return { ok = false, error = 'insufficient' }
    end
    if not Framework.RemoveMoney(src, valet.account or 'bank', cost, 'phone valet') then
        return { ok = false, error = 'insufficient' }
    end

    local mode = parkingMode(row)
    if not setParked(Framework.GetCitizenId(src), row, mode, false) then
        Framework.AddMoney(src, valet.account or 'bank', cost, 'phone valet refund')
        return { ok = false, error = 'failed' }
    end

    local drive = valet.drive ~= false
    pendingValet[src] = { row = row, mode = mode, cost = cost, expires = os.time() + (drive and 600 or 120) }

    SetTimeout((valet.delay or 5) * 1000, function()
        if GetPlayerPed(src) == 0 then return end
        TriggerClientEvent('XS-Phone:client:valetDrive', src, {
            model = name or hash,
            plate = row.plate,
            mods = row.mods,
            drive = drive,
            driver = valet.driver or 's_m_y_valet_01',
            speed = valet.speed or 18.0,
            style = valet.drivingStyle or 786603,
            distance = valet.spawnDistance or 260.0,
            timeout = valet.maxDrive or 240,
        })
    end)

    return { ok = true, data = { cost = cost, delay = valet.delay or 5, drive = drive } }
end)

RegisterNetEvent('XS-Phone:valetOk', function(netId)
    local src = source
    local pending = pendingValet[src]
    if not pending or os.time() > pending.expires or pending.keyed then return end
    pending.keyed = true
    giveKeys(src, pending.row.plate, entityFromNet(netId))
end)

RegisterNetEvent('XS-Phone:valetDone', function()
    pendingValet[source] = nil
end)

RegisterNetEvent('XS-Phone:valetFailed', function()
    local src = source
    local pending = pendingValet[src]
    pendingValet[src] = nil
    if not pending or os.time() > pending.expires or pending.keyed then return end

    local citizenid = Framework.GetCitizenId(src)
    if not citizenid then return end
    setParked(citizenid, pending.row, pending.mode, true)
    Framework.AddMoney(src, cfg().Valet.account or 'bank', pending.cost, 'phone valet refund')
    Framework.Notify(src, 'The valet couldn\'t bring your car out — you were refunded.', 'error')
end)

AddEventHandler('playerDropped', function()
    pendingValet[source] = nil
end)

CreateThread(function()
    AwaitDB()
    while true do
        Wait(60000)
        if cfg().Keys and cfg().Keys.enabled ~= false then
            local expired = MySQL.query.await(
                'SELECT plate, holder_cid FROM phone_car_keys WHERE revoked = 0 AND expires_at IS NOT NULL AND expires_at <= ?',
                { os.time() }) or {}
            for _, r in ipairs(expired) do revoke(r.plate, r.holder_cid) end
        end
    end
end)
