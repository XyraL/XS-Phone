Banking = { name = nil }

local SUPPORTED = {
    'Renewed-Banking', 'qb-banking', 'okokBanking', 'tgg-banking', 'wasabi_banking', 'fd_banking', 'qb-management',
}

local function detect()
    if Banking.checked then return Banking.name end
    Banking.checked = true
    local forced = Config.Phone.Bills and Config.Phone.Bills.banking or 'auto'
    if forced == 'none' then return nil end
    if forced ~= 'auto' then
        Banking.name = forced
        return forced
    end
    for _, resource in ipairs(SUPPORTED) do
        if GetResourceState(resource) == 'started' then
            Banking.name = resource
            break
        end
    end
    return Banking.name
end

local function ensure(name)
    if Banking.name == 'Renewed-Banking' then
        if exports['Renewed-Banking']:getAccountMoney(name) == false then
            exports['Renewed-Banking']:CreateJobAccount({ name = name, label = name }, 0)
        end
    elseif Banking.name == 'qb-banking' then
        if not exports['qb-banking']:GetAccount(name) then
            exports['qb-banking']:CreateJobAccount(name, 0)
        end
    elseif Banking.name == 'tgg-banking' then
        if exports['tgg-banking']:GetSocietyAccountMoney(name) == nil then
            exports['tgg-banking']:CreateBusinessAccount(name, 0, name)
        end
    end
end

function Banking.Deposit(name, amount, note)
    amount = math.floor(tonumber(amount) or 0)
    if amount <= 0 or not detect() or not name or name == '' then return false end
    local ok, result = pcall(function()
        ensure(name)
        if Banking.name == 'Renewed-Banking' then
            return exports['Renewed-Banking']:addAccountMoney(name, amount)
        elseif Banking.name == 'qb-banking' then
            return exports['qb-banking']:AddMoney(name, amount, note)
        elseif Banking.name == 'okokBanking' then
            return exports.okokBanking:AddMoney(name, amount)
        elseif Banking.name == 'tgg-banking' then
            return exports['tgg-banking']:AddSocietyMoney(name, amount)
        elseif Banking.name == 'wasabi_banking' then
            return exports.wasabi_banking:AddMoney('society', name, amount)
        elseif Banking.name == 'fd_banking' then
            return exports.fd_banking:AddMoney(name, amount)
        elseif Banking.name == 'qb-management' then
            return exports['qb-management']:AddMoney(name, amount)
        end
    end)
    if not ok or result == false then
        print(('^3[XS-Phone]^0 %s did not take $%d into "%s".'):format(Banking.name, amount, name))
        return false
    end
    return true
end
