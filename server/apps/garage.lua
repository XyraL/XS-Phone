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

PhoneCallback('cipher-phone:garage:list', function(src)
    if not Config.Phone.Garage.enabled then return { ok = false, error = 'disabled' } end

    local citizenid = Framework.GetCitizenId(src)
    if not citizenid then return { ok = false, error = 'no_character' } end
    AwaitDB()

    local ok, rows = pcall(MySQL.query.await, ([[
        SELECT * FROM `%s` WHERE citizenid = ? ORDER BY plate ASC
    ]]):format(Config.Phone.Garage.table), { citizenid })

    if not ok or type(rows) ~= 'table' then
        return { ok = false, error = 'no_table' }
    end

    local out = {}
    for _, v in ipairs(rows) do
        local name, hash = modelOf(v)
        out[#out + 1] = {
            model = name,
            hash = hash,
            plate = v.plate,
            garage = v.garage,
            state = tonumber(v.state) or 0,
            fuel = math.floor(tonumber(v.fuel) or 0),
            engine = math.floor((tonumber(v.engine) or 1000) / 10),
            body = math.floor((tonumber(v.body) or 1000) / 10),
        }
    end
    return { ok = true, data = {
        vehicles = out,
        ping = { enabled = Config.Phone.Garage.Ping.enabled },
        valet = {
            enabled = Config.Phone.Garage.Valet.enabled,
            cost = Config.Phone.Garage.Valet.cost or 250,
        },
    } }
end)

local function ownedPlate(src, plate)
    local citizenid = Framework.GetCitizenId(src)
    if not citizenid then return nil end
    plate = tostring(plate or ''):sub(1, 12)
    local ok, row = pcall(MySQL.single.await, ([[
        SELECT * FROM `%s`
        WHERE citizenid = ? AND plate = ? LIMIT 1
    ]]):format(Config.Phone.Garage.table), { citizenid, plate })
    if not ok then return nil end
    return row
end

local pendingValet = {}

PhoneCallback('cipher-phone:garage:ping', function(src, data)
    if not Config.Phone.Garage.Ping.enabled then return { ok = false, error = 'disabled' } end
    if not RateOK(src, 'garagePing') then return { ok = false, error = 'rate_limited' } end

    local row = ownedPlate(src, data and data.plate)
    if not row then return { ok = false, error = 'not_yours' } end

    local function normPlate(p)
        return tostring(p or ''):gsub('^%s+', ''):gsub('%s+$', ''):upper()
    end
    local wanted = normPlate(row.plate)
    for _, veh in ipairs(GetAllVehicles()) do
        local plate = GetVehicleNumberPlateText(veh)
        if plate and normPlate(plate) == wanted then
            local coords = GetEntityCoords(veh)
            return { ok = true, data = { x = coords.x, y = coords.y } }
        end
    end
    return { ok = false, error = 'not_found' }
end)

PhoneCallback('cipher-phone:garage:valet', function(src, data)
    local valet = Config.Phone.Garage.Valet
    if not valet.enabled then return { ok = false, error = 'disabled' } end
    if not RateOK(src, 'valet') then return { ok = false, error = 'rate_limited' } end

    local row = ownedPlate(src, data and data.plate)
    if not row then return { ok = false, error = 'not_yours' } end
    if tonumber(row.state) ~= 1 then return { ok = false, error = 'not_garaged' } end

    local name, hash = modelOf(row)
    if not name and not hash then return { ok = false, error = 'no_model' } end

    local cost = valet.cost or 250
    if Framework.GetMoney(src, valet.account or 'bank') < cost then
        return { ok = false, error = 'insufficient' }
    end
    if not Framework.RemoveMoney(src, valet.account or 'bank', cost, 'phone valet') then
        return { ok = false, error = 'insufficient' }
    end

    local ok = pcall(MySQL.update.await, ([[
        UPDATE `%s` SET state = 0 WHERE citizenid = ? AND plate = ?
    ]]):format(Config.Phone.Garage.table), { Framework.GetCitizenId(src), row.plate })
    if not ok then
        Framework.AddMoney(src, valet.account or 'bank', cost, 'phone valet refund')
        return { ok = false, error = 'failed' }
    end

    pendingValet[src] = { plate = row.plate, cost = cost, expires = os.time() + 120 }

    SetTimeout((valet.delay or 12) * 1000, function()
        if GetPlayerPed(src) == 0 then return end
        TriggerClientEvent('cipher-phone:client:valetSpawn', src, {
            model = name or hash,
            plate = row.plate,
            mods = row.mods,
        })
        TriggerClientEvent('cipher-phone:client:pushNotify', src, {
            app = 'garage', title = 'Valet',
            body = 'Your car has arrived outside.',
        })
    end)

    return { ok = true, data = { cost = cost, delay = valet.delay or 12 } }
end)

RegisterNetEvent('cipher-phone:valetOk', function()
    pendingValet[source] = nil
end)

RegisterNetEvent('cipher-phone:valetFailed', function()
    local src = source
    local pending = pendingValet[src]
    pendingValet[src] = nil
    if not pending or os.time() > pending.expires then return end

    local citizenid = Framework.GetCitizenId(src)
    if not citizenid then return end
    pcall(MySQL.update.await, ([[
        UPDATE `%s` SET state = 1 WHERE citizenid = ? AND plate = ?
    ]]):format(Config.Phone.Garage.table), { citizenid, pending.plate })
    Framework.AddMoney(src, Config.Phone.Garage.Valet.account or 'bank',
        pending.cost, 'phone valet refund')
    Framework.Notify(src, 'The valet couldn\'t bring your car out — you were refunded.', 'error')
end)

AddEventHandler('playerDropped', function()
    pendingValet[source] = nil
end)
