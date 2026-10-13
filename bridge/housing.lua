Housing = {}

local SUPPORTED = { 'qbx_properties', 'ps-housing', 'qb-houses', 'bcs_housing' }
local qbLocks = {}

function Housing.Name()
    local forced = Config.Phone.Home and Config.Phone.Home.housing or 'auto'
    if forced == 'none' then return nil end
    if forced ~= 'auto' then return GetResourceState(forced) == 'started' and forced or nil end
    for _, resource in ipairs(SUPPORTED) do
        if GetResourceState(resource) == 'started' then return resource end
    end
    return nil
end

local function decode(raw, fallback)
    if type(raw) == 'table' then return raw end
    if type(raw) ~= 'string' or raw == '' then return fallback end
    local ok, value = pcall(json.decode, raw)
    if ok and value ~= nil then return value end
    return fallback
end

local function cidList(raw)
    local list = {}
    local decoded = decode(raw, {})
    if type(decoded) ~= 'table' then return list end
    for _, v in pairs(decoded) do
        if type(v) == 'string' then list[#list + 1] = v end
    end
    return list
end

local function contains(list, value)
    for _, v in ipairs(list) do
        if v == value then return true end
    end
    return false
end

function Housing.Names(cids)
    local out = {}
    if #cids == 0 then return out end
    local marks = {}
    for i = 1, #cids do marks[i] = '?' end
    local rows = MySQL.query.await(
        ('SELECT citizenid, charinfo FROM players WHERE citizenid IN (%s)'):format(table.concat(marks, ',')), cids) or {}
    for _, r in ipairs(rows) do
        local ci = decode(r.charinfo, {})
        out[r.citizenid] = ((ci.firstname or '') .. ' ' .. (ci.lastname or '')):gsub('^%s+', ''):gsub('%s+$', '')
    end
    return out
end

local function home(id, label, owner, x, y, extra)
    local h = { id = tostring(id), label = label or ('Property ' .. tostring(id)), owner = owner == true, x = x, y = y }
    for k, v in pairs(extra or {}) do h[k] = v end
    return h
end

local adapters = {}

adapters['qbx_properties'] = {
    list = function(cid)
        local rows = MySQL.query.await([[
            SELECT id, property_name, coords, owner, keyholders FROM properties
            WHERE owner = ? OR JSON_CONTAINS(keyholders, JSON_QUOTE(?))
        ]], { cid, cid }) or {}
        local out = {}
        for _, r in ipairs(rows) do
            local c = decode(r.coords, {})
            out[#out + 1] = home(r.id, r.property_name, r.owner == cid, tonumber(c.x), tonumber(c.y),
                { canLock = false, canKeys = r.owner == cid, keys = cidList(r.keyholders) })
        end
        return out
    end,
    setKeys = function(_, id, cid, keys)
        local owner = MySQL.scalar.await('SELECT owner FROM properties WHERE id = ?', { tonumber(id) })
        if owner ~= cid then return false, 'not_owner' end
        MySQL.update.await('UPDATE properties SET keyholders = ? WHERE id = ?', { json.encode(keys), tonumber(id) })
        return true
    end,
}

adapters['ps-housing'] = {
    list = function(cid)
        local rows = MySQL.query.await([[
            SELECT property_id, owner_citizenid, street, apartment, has_access, door_data, shell FROM properties
            WHERE owner_citizenid = ? OR JSON_CONTAINS(has_access, JSON_QUOTE(?))
        ]], { cid, cid }) or {}
        local out = {}
        for _, r in ipairs(rows) do
            local door = decode(r.door_data, {})
            local x, y = tonumber(door.x), tonumber(door.y)
            if not x and r.shell == 'mlo' then
                local ok, main = pcall(function() return exports['ps-housing']:getMainDoor(r.property_id, 1) end)
                if ok and main then
                    local c = main.coords or main
                    x, y = tonumber(c.x), tonumber(c.y)
                end
            end
            local label = r.apartment or ((r.street or 'Property') .. ' ' .. r.property_id)
            local mlo = r.shell == 'mlo' and GetResourceState('ox_doorlock') == 'started'
            out[#out + 1] = home(r.property_id, label, r.owner_citizenid == cid, x, y, {
                canLock = mlo, canKeys = r.owner_citizenid == cid, keys = cidList(r.has_access),
                doors = mlo and (tonumber(door.count) or 1) or nil,
            })
        end
        return out
    end,
    setKeys = function(_, id, cid, keys, added, removed)
        local row = MySQL.single.await('SELECT owner_citizenid, shell FROM properties WHERE property_id = ?', { tonumber(id) })
        if not row or row.owner_citizenid ~= cid then return false, 'not_owner' end
        TriggerEvent('ps-housing:server:updateProperty', 'UpdateHas_access', tonumber(id), keys)
        if row.shell == 'mlo' then
            if added then TriggerEvent('ps-housing:server:updateProperty', 'addMloDoorsAccess', tonumber(id), added) end
            if removed then TriggerEvent('ps-housing:server:updateProperty', 'removeMloDoorsAccess', tonumber(id), removed) end
        end
        return true
    end,
    lockState = function(h)
        local door = exports.ox_doorlock:getDoorFromName(('ps_mloproperty%s_1'):format(h.id))
        if not door then return nil end
        return door.state == 1
    end,
    setLock = function(_, h, locked)
        local any = false
        for n = 1, h.doors or 1 do
            local door = exports.ox_doorlock:getDoorFromName(('ps_mloproperty%s_%d'):format(h.id, n))
            if door then
                exports.ox_doorlock:setDoorState(door.id, locked and 1 or 0)
                any = true
            end
        end
        return any
    end,
}

adapters['qb-houses'] = {
    list = function(cid)
        local rows = MySQL.query.await([[
            SELECT house, citizenid, keyholders FROM player_houses
            WHERE citizenid = ? OR keyholders LIKE ?
        ]], { cid, '%"' .. cid .. '"%' }) or {}
        local out = {}
        if #rows == 0 then return out end
        local names = {}
        for _, r in ipairs(rows) do names[#names + 1] = r.house end
        local marks = {}
        for i = 1, #names do marks[i] = '?' end
        local locations = {}
        for _, l in ipairs(MySQL.query.await(
            ('SELECT name, label, coords FROM houselocations WHERE name IN (%s)'):format(table.concat(marks, ',')), names) or {}) do
            locations[l.name] = l
        end
        for _, r in ipairs(rows) do
            local loc = locations[r.house] or {}
            local c = decode(loc.coords, {})
            local enter = c.enter or {}
            local keys = {}
            for _, k in ipairs(cidList(r.keyholders)) do
                if k ~= r.citizenid then keys[#keys + 1] = k end
            end
            out[#out + 1] = home(r.house, loc.label or r.house, r.citizenid == cid, tonumber(enter.x), tonumber(enter.y), {
                canLock = true, canKeys = r.citizenid == cid, keys = keys, relayKeys = true, canLetIn = true,
            })
        end
        return out
    end,
    lockState = function(h)
        if qbLocks[h.id] == nil then return true end
        return qbLocks[h.id]
    end,
    setLock = function(_, h, locked)
        qbLocks[h.id] = locked
        TriggerEvent('qb-houses:server:lockHouse', locked, h.id)
        return true
    end,
}

adapters['bcs_housing'] = {
    list = function(_, src)
        local ok, homes = pcall(function() return exports.bcs_housing:GetOwnedHomeKeys(src) end)
        local out = {}
        if not ok or type(homes) ~= 'table' then return out end
        local cid = Framework.GetCitizenId(src)
        for key, hm in pairs(homes) do
            if type(hm) == 'table' then
                local id = hm.identifier or hm.id or key
                local entry = hm.entry or hm.coords or {}
                out[#out + 1] = home(id, hm.name or hm.label, hm.owner == cid or hm.isOwner == true,
                    tonumber(entry.x), tonumber(entry.y), { canLock = true, canKeys = false, keys = {} })
            end
        end
        return out
    end,
    lockState = function(h)
        local ok, locked = pcall(function() return exports.bcs_housing:isLocked(h.id) end)
        if not ok then return nil end
        return locked == true
    end,
    setLock = function(_, h, locked)
        local now = adapters['bcs_housing'].lockState(h)
        if now == locked then return true end
        local ok = pcall(function() exports.bcs_housing:LockHome(h.id) end)
        return ok
    end,
}

function Housing.Adapter()
    local name = Housing.Name()
    return name and adapters[name] or nil, name
end

function Housing.List(src)
    local adapter = Housing.Adapter()
    local cid = Framework.GetCitizenId(src)
    if not adapter or not cid then return {} end
    local ok, list = pcall(adapter.list, cid, src)
    if not ok then
        print(('^3[XS-Phone]^0 reading homes failed: %s'):format(list))
        return {}
    end
    for _, h in ipairs(list) do
        if h.canLock and adapter.lockState then
            local okState, state = pcall(adapter.lockState, h)
            if okState and state ~= nil then
                h.locked = state == true
            else
                h.canLock = false
            end
        end
    end
    return list
end

function Housing.Find(src, id)
    for _, h in ipairs(Housing.List(src)) do
        if h.id == tostring(id) then return h end
    end
    return nil
end

function Housing.SetLock(src, id, locked)
    local adapter = Housing.Adapter()
    local h = Housing.Find(src, id)
    if not adapter or not h then return false, 'gone' end
    if not h.canLock or not adapter.setLock then return false, 'unsupported' end
    local ok, done = pcall(adapter.setLock, src, h, locked)
    if not ok or not done then return false, 'failed' end
    return true
end

function Housing.SetKeys(src, h, keys, added, removed)
    local adapter = Housing.Adapter()
    if not adapter or not adapter.setKeys then return false, 'unsupported' end
    local ok, done, err = pcall(adapter.setKeys, src, h.id, Framework.GetCitizenId(src), keys, added, removed)
    if not ok then return false, 'failed' end
    return done, err
end

function Housing.TrackQbLock(house, locked)
    qbLocks[tostring(house)] = locked == true
end

function Housing.Contains(list, value)
    return contains(list, value)
end
