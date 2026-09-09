local ACCOUNT = function() return Config.Phone.Wallet.account or 'bank' end

PhoneCallback('XS-Phone:wallet:summary', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local rows = MySQL.query.await([[
        SELECT from_number, to_number, amount, note,
               UNIX_TIMESTAMP(created_at) * 1000 AS at
        FROM phone_transactions
        WHERE from_number = ? OR to_number = ?
        ORDER BY id DESC LIMIT 25
    ]], { me, me })

    local txs = {}
    for _, r in ipairs(rows) do
        txs[#txs + 1] = {
            other = r.from_number == me and r.to_number or r.from_number,
            direction = r.from_number == me and 'out' or 'in',
            amount = r.amount,
            note = r.note,
            at = r.at,
        }
    end

    return { ok = true, data = {
        balance = Framework.GetMoney(src, ACCOUNT()),
        transactions = txs,
    } }
end)

PhoneCallback('XS-Phone:wallet:transfer', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'walletTransfer') then return { ok = false, error = 'rate_limited' } end

    local me = EnsurePhone(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local to = NormalizeNumber(tostring(data.to or ''))
    if not to or to == me.number then return { ok = false, error = 'invalid_number' } end

    local amount = math.floor(tonumber(data.amount) or 0)
    if amount < 1 or amount > (Config.Phone.Wallet.maxTransfer or 50000) then
        return { ok = false, error = 'bad_amount' }
    end

    local targetSrc = GetSourceByNumber(to)
    if not targetSrc then return { ok = false, error = 'offline' } end

    if Framework.GetMoney(src, ACCOUNT()) < amount then
        return { ok = false, error = 'insufficient' }
    end

    local note = tostring(data.note or ''):sub(1, 80)

    if not Framework.RemoveMoney(src, ACCOUNT(), amount, 'phone transfer out') then
        return { ok = false, error = 'insufficient' }
    end
    if not Framework.AddMoney(targetSrc, ACCOUNT(), amount, 'phone transfer in') then
        Framework.AddMoney(src, ACCOUNT(), amount, 'phone transfer refund')
        return { ok = false, error = 'failed' }
    end

    MySQL.insert.await(
        'INSERT INTO phone_transactions (from_number, to_number, amount, note) VALUES (?, ?, ?, ?)',
        { me.number, to, amount, note ~= '' and note or nil })

    TriggerClientEvent('XS-Phone:client:pushNotify', targetSrc, {
        app = 'wallet', title = 'Money received',
        body = ('$%s from %s%s'):format(amount, me.number, note ~= '' and (' — ' .. note) or ''),
    })

    return { ok = true, data = { balance = Framework.GetMoney(src, ACCOUNT()) } }
end)
