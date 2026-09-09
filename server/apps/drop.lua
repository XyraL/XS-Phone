local pending = {}

local function dropRange()
    return Config.Phone.Drop.range or 10.0
end

local function distanceBetween(a, b)
    local pedA, pedB = GetPlayerPed(a), GetPlayerPed(b)
    if not pedA or not pedB or pedA == 0 or pedB == 0 then return math.huge end
    return #(GetEntityCoords(pedA) - GetEntityCoords(pedB))
end

PhoneCallback('XS-Phone:drop:scan', function(src, data)
    if not Config.Phone.Drop.enabled then return { ok = false, error = 'disabled' } end
    if type(data) ~= 'table' or type(data.ids) ~= 'table' then
        return { ok = false, error = 'bad_payload' }
    end

    local out = {}
    for i, id in ipairs(data.ids) do
        if i > 20 then break end
        id = tonumber(id)
        if id and id ~= src then
            local dist = distanceBetween(src, id)
            if dist <= dropRange() + 2.0 then
                local entry = EnsurePhone(id)
                if entry and entry.settings.dropEnabled then
                    out[#out + 1] = {
                        id = id,
                        name = Framework.GetName(id) or 'Unknown',
                        dist = math.floor(dist + 0.5),
                    }
                end
            end
        end
    end
    table.sort(out, function(a, b) return a.dist < b.dist end)
    return { ok = true, data = out }
end)

PhoneCallback('XS-Phone:drop:send', function(src, data)
    if not Config.Phone.Drop.enabled then return { ok = false, error = 'disabled' } end
    if not RateOK(src, 'dropSend') then return { ok = false, error = 'rate_limited' } end

    local me = EnsurePhone(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local target = tonumber(data and data.targetId)
    if not target or target == src then return { ok = false, error = 'bad_target' } end

    local entry = EnsurePhone(target)
    if not entry or not entry.settings.dropEnabled then return { ok = false, error = 'unavailable' } end
    if distanceBetween(src, target) > dropRange() + 2.0 then return { ok = false, error = 'too_far' } end
    if pending[target] then return { ok = false, error = 'busy' } end

    pending[target] = {
        from = src,
        number = me.number,
        name = Framework.GetName(src) or 'Unknown',
        expires = os.time() + (Config.Phone.Drop.offerTimeout or 30),
    }
    TriggerClientEvent('XS-Phone:client:dropOffer', target, { name = pending[target].name })
    return { ok = true }
end)

RegisterNetEvent('XS-Phone:drop:respond', function(accept)
    local src = source
    local offer = pending[src]
    pending[src] = nil
    if not offer or os.time() > offer.expires then return end

    local sender = offer.from
    if not accept then
        if GetPlayerPed(sender) ~= 0 then
            TriggerClientEvent('XS-Phone:client:pushNotify', sender, {
                app = 'contacts', title = 'Drop', body = 'Your card was declined.',
            })
        end
        return
    end

    local me = EnsurePhone(src)
    if not me then return end

    pcall(MySQL.insert.await,
        'INSERT INTO phone_contacts (owner_number, saved_number, name) VALUES (?, ?, ?)',
        { me.number, offer.number, offer.name })

    TriggerClientEvent('XS-Phone:client:pushNotify', src, {
        app = 'contacts', title = 'Contact added',
        body = ('%s · %s'):format(offer.name, offer.number),
    })
    TriggerClientEvent('XS-Phone:client:contactsChanged', src)

    if GetPlayerPed(sender) ~= 0 then
        TriggerClientEvent('XS-Phone:client:pushNotify', sender, {
            app = 'contacts', title = 'Drop',
            body = ('%s saved your card.'):format(Framework.GetName(src) or 'Someone'),
        })
    end
end)

CreateThread(function()
    while true do
        Wait(15000)
        local now = os.time()
        for target, offer in pairs(pending) do
            if now > offer.expires then pending[target] = nil end
        end
    end
end)

AddEventHandler('playerDropped', function()
    pending[source] = nil
end)
