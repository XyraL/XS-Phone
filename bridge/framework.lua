if not IsDuplicityVersion() then
    if type(RegisterNUICallback) == 'function' then
        local _registerNUI = RegisterNUICallback

        RegisterNUICallback = function(name, handler)
            return _registerNUI(name, function(data, cb)
                CreateThread(function()
                    handler(data, function(payload, ...)
                        if payload == nil then payload = false end
                        cb(payload, ...)
                    end)
                end)
            end)
        end
    else
        print('^1[XS-Phone]^0 RegisterNUICallback unavailable when the bridge loaded — NUI wrapper skipped.')
    end
end

Framework = { name = nil, core = nil }

if GetResourceState('qbx_core') == 'started' then
    Framework.name = 'qbox'
elseif GetResourceState('qb-core') == 'started' then
    Framework.name = 'qbcore'
    Framework.core = exports['qb-core']:GetCoreObject()
else
    print('^1[XS-Phone]^0 No supported framework found. Start qbx_core or qb-core before XS-Phone.')
end

local IS_SERVER = IsDuplicityVersion()

if IS_SERVER then
    function Framework.GetPlayer(src)
        if Framework.name == 'qbox' then
            return exports.qbx_core:GetPlayer(src)
        elseif Framework.name == 'qbcore' then
            return Framework.core.Functions.GetPlayer(src)
        end
        return nil
    end

    function Framework.GetCitizenId(src)
        local player = Framework.GetPlayer(src)
        return player and player.PlayerData.citizenid or nil
    end

    function Framework.GetName(src)
        local player = Framework.GetPlayer(src)
        if not player then return nil end
        local ci = player.PlayerData.charinfo
        return ('%s %s'):format(ci.firstname, ci.lastname)
    end

    function Framework.GetCharinfoNumber(src)
        local player = Framework.GetPlayer(src)
        if not player then return nil end
        local ci = player.PlayerData.charinfo
        return ci and ci.phone or nil
    end

    function Framework.GetJobName(src)
        local player = Framework.GetPlayer(src)
        if not player then return nil end
        local job = player.PlayerData.job
        return job and job.name or nil
    end

    function Framework.GetBirthdate(src)
        local player = Framework.GetPlayer(src)
        if not player then return nil end
        local ci = player.PlayerData.charinfo
        return ci and ci.birthdate or nil
    end

    function Framework.GetJobInfo(src)
        local player = Framework.GetPlayer(src)
        if not player then return nil end
        local job = player.PlayerData.job
        if not job then return nil end
        return {
            name = job.name,
            onduty = job.onduty == true,
            isboss = job.isboss == true,
        }
    end

    function Framework.HasItem(src, item)
        if GetResourceState('ox_inventory') == 'started' then
            local count = exports.ox_inventory:Search(src, 'count', item)
            return (count or 0) > 0
        end
        local player = Framework.GetPlayer(src)
        if not player then return false end
        local found = player.Functions.GetItemByName(item)
        return found ~= nil and (found.amount or found.count or 0) > 0
    end

    function Framework.CreateUseableItem(item, cb)
        if Framework.name == 'qbox' then
            exports.qbx_core:CreateUseableItem(item, cb)
        elseif Framework.name == 'qbcore' then
            Framework.core.Functions.CreateUseableItem(item, cb)
        end
    end

    function Framework.AddMoney(src, account, amount, reason)
        local player = Framework.GetPlayer(src)
        if not player then return false end
        return player.Functions.AddMoney(account, amount, reason or 'XS-Phone')
    end

    function Framework.RemoveMoney(src, account, amount, reason)
        local player = Framework.GetPlayer(src)
        if not player then return false end
        return player.Functions.RemoveMoney(account, amount, reason or 'XS-Phone')
    end

    function Framework.GetMoney(src, account)
        local player = Framework.GetPlayer(src)
        if not player then return 0 end
        return player.PlayerData.money[account] or 0
    end

    function Framework.Notify(src, msg, type)
        TriggerClientEvent('ox_lib:notify', src, { description = msg, type = type or 'inform' })
    end

    function Framework.OnPlayerLoaded(cb)
        AddEventHandler('QBCore:Server:OnPlayerLoaded', function(arg)
            local src = arg
            if type(arg) == 'table' then
                src = arg.PlayerData and arg.PlayerData.source
            end
            if type(src) ~= 'number' then src = source end
            if type(src) == 'number' and src > 0 then cb(src) end
        end)
    end
else
    function Framework.GetPlayerData()
        if Framework.name == 'qbox' then
            return exports.qbx_core:GetPlayerData()
        elseif Framework.name == 'qbcore' then
            return Framework.core.Functions.GetPlayerData()
        end
        return nil
    end

    function Framework.Notify(msg, type)
        lib.notify({ description = msg, type = type or 'inform' })
    end
end

if Config and Config.Debug then
    print(('^2[XS-Phone]^0 bridge loaded (%s) on %s'):format(
        Framework.name or 'none', IS_SERVER and 'server' or 'client'))
end
