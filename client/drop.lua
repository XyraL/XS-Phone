function GetNearbyPlayerIds()
    local myPed = PlayerPedId()
    local myCoords = GetEntityCoords(myPed)
    local ids = {}
    for _, player in ipairs(GetActivePlayers()) do
        local ped = GetPlayerPed(player)
        if ped ~= myPed then
            local dist = #(GetEntityCoords(ped) - myCoords)
            if dist <= (Config.Phone.Drop.range or 10.0) then
                ids[#ids + 1] = GetPlayerServerId(player)
            end
        end
    end
    return ids
end

RegisterNetEvent('XS-Phone:client:dropOffer', function(offer)
    if IsPhoneOpen() then
        SendNUIMessage({ action = 'phone:dropOffer', data = offer })
        return
    end
    CreateThread(function()
        local result = lib.alertDialog({
            header = 'Contact Drop',
            content = ('**%s** wants to share their number with you.'):format(offer.name or 'Someone'),
            centered = true,
            cancel = true,
            labels = { confirm = 'Accept', cancel = 'Decline' },
        })
        TriggerServerEvent('XS-Phone:drop:respond', result == 'confirm')
    end)
end)

RegisterNetEvent('XS-Phone:client:contactsChanged', function()
    SendNUIMessage({ action = 'phone:contactsChanged' })
end)
