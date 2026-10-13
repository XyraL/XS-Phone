RegisterNetEvent('XS-Phone:client:callState', function(data)
    SendNUIMessage({ action = 'phone:callState', data = data })
    if data.phase == 'incoming' and not IsPhoneOpen() then
        if data.line then
            Framework.Notify(('Incoming %s call from %s — open your phone to answer'):format(data.line, data.number), 'inform')
        else
            Framework.Notify(('Incoming call from %s — open your phone to answer'):format(data.number), 'inform')
        end
    end
end)
