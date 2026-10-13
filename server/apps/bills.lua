local busy = {}

local function cfg()
    return Config.Phone.Bills or {}
end

local function issuerJobs()
    if cfg().issuers then return cfg().issuers end
    local jobs = {}
    for _, biz in ipairs(Config.Phone.Businesses or {}) do jobs[#jobs + 1] = biz.job end
    return jobs
end

local function issuingJob(src)
    local job = Framework.GetJobInfo(src)
    if not job or not job.onduty then return nil end
    for _, name in ipairs(issuerJobs()) do
        if name == job.name then return job.name end
    end
    return nil
end

local function remember(cid, source, ref, result, status)
    MySQL.insert.await(
        'INSERT INTO phone_bills (citizenid, source, ref, label, payee, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        { cid, source, tostring(ref), result.label and tostring(result.label):sub(1, 120) or nil,
            result.payee and tostring(result.payee):sub(1, 60) or nil, result.amount or 0, status })
end

function BillCount(cid)
    if not cid then return 0 end
    local ok, list = pcall(Billing.List, cid)
    return ok and #list or 0
end

PhoneCallback('XS-Phone:bills:list', function(src)
    local cid = Framework.GetCitizenId(src)
    if not cid then return { ok = false, error = 'no_character' } end
    local job = issuingJob(src)
    return { ok = true, data = {
        bills = Billing.List(cid),
        history = MySQL.query.await([[
            SELECT source, label, payee, amount, status, UNIX_TIMESTAMP(created_at) * 1000 AS at
            FROM phone_bills WHERE citizenid = ? ORDER BY id DESC LIMIT 15
        ]], { cid }) or {},
        issuer = job and Billing.JobLabel(job) or nil,
        cash = Framework.GetMoney(src, cfg().account or 'bank'),
    } }
end)

local function settle(src, data, fn, status)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'billPay') then return { ok = false, error = 'rate_limited' } end
    local cid = Framework.GetCitizenId(src)
    if not cid then return { ok = false, error = 'no_character' } end
    local id = tonumber(data.id)
    if not id then return { ok = false, error = 'bad_payload' } end
    if busy[cid] then return { ok = false, error = 'rate_limited' } end
    busy[cid] = true
    local ok, done, result = pcall(fn, src, cid, tostring(data.source or ''), id)
    busy[cid] = nil
    if not ok then error(done) end
    if not done then return { ok = false, error = result } end
    remember(cid, data.source, id, result, status)
    return { ok = true, data = result }
end

PhoneCallback('XS-Phone:bills:pay', function(src, data)
    return settle(src, data, Billing.Pay, 'paid')
end)

PhoneCallback('XS-Phone:bills:decline', function(src, data)
    return settle(src, data, Billing.Decline, 'declined')
end)

PhoneCallback('XS-Phone:bills:send', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'billSend') then return { ok = false, error = 'rate_limited' } end
    local me = EnsurePhone(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local job = issuingJob(src)
    if not job then return { ok = false, error = 'not_allowed' } end

    local to = NormalizeNumber(tostring(data.to or ''))
    if not to or to == me.number then return { ok = false, error = 'invalid_number' } end
    local targetCid = MySQL.scalar.await('SELECT citizenid FROM phone_phones WHERE number = ?', { to })
    if not targetCid then return { ok = false, error = 'invalid_number' } end

    local amount = math.floor(tonumber(data.amount) or 0)
    if amount < 1 or amount > (cfg().maxAmount or 100000) then return { ok = false, error = 'bad_amount' } end
    local reason = tostring(data.reason or ''):gsub('%c', ' '):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, 120)
    if reason == '' then return { ok = false, error = 'no_reason' } end

    local id = Billing.Create(targetCid, amount, job, reason, Framework.GetName(src) or me.number, me.citizenid, true)
    if not id then return { ok = false, error = 'unavailable' } end

    local targetSrc = GetSourceByNumber(to)
    if targetSrc then
        local fine = false
        for _, f in ipairs(cfg().fineJobs or {}) do if f == job then fine = true end end
        TriggerClientEvent('XS-Phone:client:pushNotify', targetSrc, {
            app = 'wallet', title = fine and 'New fine' or 'New bill',
            body = ('$%s from %s · %s'):format(amount, Billing.JobLabel(job), reason),
        })
        TriggerClientEvent('XS-Phone:client:billsChanged', targetSrc)
    end
    return { ok = true, data = { id = id } }
end)

exports('CreateBill', function(target, amount, society, reason, canDecline)
    local cid = type(target) == 'number' and Framework.GetCitizenId(target) or target
    amount = math.floor(tonumber(amount) or 0)
    if type(cid) ~= 'string' or amount < 1 or type(society) ~= 'string' then return false end
    local id = Billing.Create(cid, amount, society, reason and tostring(reason):sub(1, 120) or nil,
        Billing.JobLabel(society), nil, canDecline ~= false)
    if not id then return false end
    for _, playerId in ipairs(GetPlayers()) do
        local s = tonumber(playerId)
        if Framework.GetCitizenId(s) == cid then
            TriggerClientEvent('XS-Phone:client:pushNotify', s, {
                app = 'wallet', title = 'New bill', body = ('$%s from %s'):format(amount, Billing.JobLabel(society)),
            })
            TriggerClientEvent('XS-Phone:client:billsChanged', s)
            break
        end
    end
    return id
end)

CreateThread(function()
    AwaitDB()
    Billing.Init()
end)

AddEventHandler('playerDropped', function()
    local cid = Framework.GetCitizenId(source)
    if cid then busy[cid] = nil end
end)
