CustomApps = { list = {} }

local function url(value, owner)
    if type(value) ~= 'string' or value == '' then return nil end
    if value:find('^https?://') or value:find('^nui://') then return value end
    local first = value:match('^([%w_%-]+)/')
    if first and GetResourceState(first) == 'started' then return 'https://cfx-nui-' .. value end
    return ('https://cfx-nui-%s/%s'):format(owner, (value:gsub('^/', '')))
end

function CustomApps.List()
    local out = {}
    for _, app in pairs(CustomApps.list) do
        out[#out + 1] = { id = app.id, name = app.name, icon = app.icon, ui = app.ui, colour = app.colour }
    end
    table.sort(out, function(a, b) return a.name < b.name end)
    return out
end

local function sync()
    SendNUIMessage({ action = 'phone:customApps', data = CustomApps.List() })
end

exports('AddCustomApp', function(def)
    if type(def) ~= 'table' then return false end
    local owner = GetInvokingResource() or GetCurrentResourceName()
    local id = tostring(def.id or def.identifier or ''):gsub('[^%w_%-]', ''):sub(1, 32)
    local ui = url(def.ui, owner)
    if id == '' or not ui then return false end
    local colour = type(def.colour) == 'string' and def.colour:match('^#%x%x%x%x?%x?%x?$') or nil
    CustomApps.list[id] = {
        id = id, owner = owner, ui = ui, icon = url(def.icon, owner), colour = colour,
        name = tostring(def.name or def.label or id):sub(1, 24),
    }
    sync()
    return true
end)

exports('RemoveCustomApp', function(id)
    if not CustomApps.list[id] then return false end
    CustomApps.list[id] = nil
    sync()
    return true
end)

exports('SendCustomAppMessage', function(id, data)
    if not CustomApps.list[id] then return false end
    SendNUIMessage({ action = 'phone:customAppMessage', data = { id = id, data = data } })
    return true
end)

exports('Close', function()
    ClosePhone()
end)

AddEventHandler('onResourceStop', function(resource)
    local changed = false
    for id, app in pairs(CustomApps.list) do
        if app.owner == resource then
            CustomApps.list[id] = nil
            changed = true
        end
    end
    if changed then sync() end
end)
