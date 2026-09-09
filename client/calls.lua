RegisterNetEvent('XS-Phone:client:callState', function(data)
    SendNUIMessage({ action = 'phone:callState', data = data })
    if data.phase == 'incoming' and not IsPhoneOpen() then
        Framework.Notify(('Incoming call from %s — open your phone to answer'):format(data.number), 'inform')
    end
end)
