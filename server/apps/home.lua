local rings = {}
local RING_KEEP = 8
local LET_IN_WINDOW = 300

local function decode(raw)
    if type(raw) ~= 'string' or raw == '' then return {} end
    local ok, v = pcall(json.decode, raw)
    return ok and type(v) == 'table' and v or {}
end

local function cids(raw)
    local out = {}
    for _, v in pairs(decode(raw)) do
        if type(v) == 'string' then out[#out + 1] = v end
    end
    return out
end

local function ring(homeId, label, residents, ringer)
    local cid = Framework.GetCitizenId(ringer)
    if cid and Housing.Contains(residents, cid) then return end
    local name = Framework.GetName(ringer) or 'Someone'
    local key = tostring(homeId)
    rings[key] = rings[key] or {}
    table.insert(rings[key], 1, { name = name, src = ringer, at = os.time() })
    while #rings[key] > RING_KEEP do table.remove(rings[key]) end

    for _, playerId in ipairs(GetPlayers()) do
        local s = tonumber(playerId)
        if s ~= ringer and Housing.Contains(residents, Framework.GetCitizenId(s)) then
            TriggerClientEvent('XS-Phone:client:pushNotify', s, {
                app = 'home', title = 'Doorbell', body = ('%s is at %s'):format(name, label or 'your door'),
            })
            TriggerClientEvent('XS-Phone:client:homeChanged', s)
        end
    end
end

RegisterNetEvent('qbx_properties:server:ringProperty', function(data)
    local src = source
    if Housing.Name() ~= 'qbx_properties' then return end
    local id = tonumber(type(data) == 'table' and data.id or data)
    if not id then return end
    local row = MySQL.single.await('SELECT property_name, owner, keyholders FROM properties WHERE id = ?', { id })
    if not row or not row.owner then return end
    local residents = cids(row.keyholders)
    residents[#residents + 1] = row.owner
    ring(id, row.property_name, residents, src)
end)

RegisterNetEvent('ps-housing:server:enterProperty', function(propertyId)
    local src = source
    if Housing.Name() ~= 'ps-housing' then return end
    local id = tonumber(propertyId)
    if not id then return end
    local row = MySQL.single.await(
        'SELECT owner_citizenid, has_access, street, apartment FROM properties WHERE property_id = ?', { id })
    if not row or not row.owner_citizenid then return end
    local residents = cids(row.has_access)
    residents[#residents + 1] = row.owner_citizenid
    ring(id, row.apartment or ((row.street or 'Property') .. ' ' .. id), residents, src)
end)

RegisterNetEvent('qb-houses:server:RingDoor', function(house)
    local src = source
    if Housing.Name() ~= 'qb-houses' or type(house) ~= 'string' then return end
    local row = MySQL.single.await('SELECT citizenid, keyholders FROM player_houses WHERE house = ?', { house })
    if not row then return end
    local label = MySQL.scalar.await('SELECT label FROM houselocations WHERE name = ?', { house })
    local residents = cids(row.keyholders)
    residents[#residents + 1] = row.citizenid
    ring(house, label or house, residents, src)
end)

RegisterNetEvent('qb-houses:server:lockHouse', function(locked, house)
    if type(house) == 'string' then Housing.TrackQbLock(house, locked) end
end)

local function view(src)
    local list = Housing.List(src)
    local holders = {}
    for _, h in ipairs(list) do
        if h.owner then
            for _, k in ipairs(h.keys or {}) do holders[#holders + 1] = k end
        end
    end
    local names = Housing.Names(holders)
    local now = os.time()
    for _, h in ipairs(list) do
        local keys = {}
        if h.owner then
            for _, k in ipairs(h.keys or {}) do keys[#keys + 1] = { cid = k, name = names[k] or 'Unknown' } end
        end
        h.keys = keys
        h.canKeys = h.owner and (h.canKeys or h.relayKeys) or false
        local list_ = {}
        for i, r in ipairs(rings[h.id] or {}) do
            list_[#list_ + 1] = {
                i = i, name = r.name, at = r.at * 1000,
                canLetIn = h.canLetIn == true and now - r.at < LET_IN_WINDOW and GetPlayerPed(r.src) ~= 0,
            }
        end
        h.rings = list_
        h.relayKeys = nil
        h.canLetIn = nil
        h.doors = nil
    end
    return list
end

PhoneCallback('XS-Phone:home:list', function(src)
    local name = Housing.Name()
    if not name then return { ok = false, error = 'no_housing' } end
    return { ok = true, data = { homes = view(src), housing = name } }
end)

PhoneCallback('XS-Phone:home:lock', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'homeWrite') then return { ok = false, error = 'rate_limited' } end
    local done, err = Housing.SetLock(src, data.id, data.locked == true)
    if not done then return { ok = false, error = err } end
    return { ok = true, data = { locked = data.locked == true } }
end)

local function ownedHome(src, id)
    local h = Housing.Find(src, id)
    if not h then return nil, 'gone' end
    if not h.owner then return nil, 'not_owner' end
    return h
end

PhoneCallback('XS-Phone:home:giveKey', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'homeWrite') then return { ok = false, error = 'rate_limited' } end
    local me = EnsurePhone(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local h, err = ownedHome(src, data.id)
    if not h then return { ok = false, error = err } end

    local to = NormalizeNumber(tostring(data.to or ''))
    if not to or to == me.number then return { ok = false, error = 'invalid_number' } end
    local cid = MySQL.scalar.await('SELECT citizenid FROM phone_phones WHERE number = ?', { to })
    if not cid then return { ok = false, error = 'invalid_number' } end
    if Housing.Contains(h.keys or {}, cid) then return { ok = false, error = 'already' } end

    if h.relayKeys then
        local target = GetSourceByNumber(to)
        if not target then return { ok = false, error = 'offline' } end
        return { ok = true, data = { relay = { event = 'qb-houses:server:giveHouseKey', args = { target, h.id } } } }
    end
    if #(h.keys or {}) >= ((Config.Phone.Home and Config.Phone.Home.maxKeys) or 10) then
        return { ok = false, error = 'full' }
    end
    local keys = {}
    for _, k in ipairs(h.keys or {}) do keys[#keys + 1] = k end
    keys[#keys + 1] = cid
    local done, why = Housing.SetKeys(src, h, keys, cid, nil)
    if not done then return { ok = false, error = why or 'failed' } end
    local target = GetSourceByNumber(to)
    if target then
        TriggerClientEvent('XS-Phone:client:pushNotify', target, {
            app = 'home', title = 'New key', body = ('You have a key to %s'):format(h.label),
        })
    end
    return { ok = true }
end)

PhoneCallback('XS-Phone:home:removeKey', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'homeWrite') then return { ok = false, error = 'rate_limited' } end
    local h, err = ownedHome(src, data.id)
    if not h then return { ok = false, error = err } end
    local cid = tostring(data.cid or '')
    if not Housing.Contains(h.keys or {}, cid) then return { ok = false, error = 'gone' } end

    if h.relayKeys then
        local name = Housing.Names({ cid })[cid] or ''
        local first, last = name:match('^(%S+)%s*(.*)$')
        return { ok = true, data = { relay = { event = 'qb-houses:server:removeHouseKey',
            args = { h.id, { citizenid = cid, firstname = first or '', lastname = last or '' } } } } }
    end
    local keys = {}
    for _, k in ipairs(h.keys or {}) do
        if k ~= cid then keys[#keys + 1] = k end
    end
    local done, why = Housing.SetKeys(src, h, keys, nil, cid)
    if not done then return { ok = false, error = why or 'failed' } end
    return { ok = true }
end)

PhoneCallback('XS-Phone:home:letIn', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'homeWrite') then return { ok = false, error = 'rate_limited' } end
    local h = Housing.Find(src, data.id)
    if not h or not h.canLetIn then return { ok = false, error = 'unsupported' } end
    local r = (rings[h.id] or {})[tonumber(data.ring) or 0]
    if not r or os.time() - r.at >= LET_IN_WINDOW or GetPlayerPed(r.src) == 0 then
        return { ok = false, error = 'gone' }
    end
    return { ok = true, data = { relay = { event = 'qb-houses:server:OpenDoor', args = { r.src, h.id } } } }
end)
