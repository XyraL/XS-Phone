local coins = {}
local order = {}
local busy = {}

local function cfg()
    return Config.Phone.Crypto or {}
end

local function account()
    return cfg().account or 'bank'
end

local function gaussian()
    local u1 = math.max(math.random(), 1e-9)
    local u2 = math.random()
    return math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
end

local function round(v, places)
    local m = 10 ^ (places or 2)
    return math.floor(v * m + 0.5) / m
end

local function priceDecimals(price)
    if price >= 100 then return 2 end
    if price >= 1 then return 3 end
    return 5
end

local function step(coin)
    local base = coin.base
    local drift = (math.log(base) - math.log(coin.price)) * 0.004
    local moved = coin.price * math.exp(drift + gaussian() * coin.volatility)
    moved = math.max(base * 0.05, math.min(base * 20, moved))
    coin.price = round(moved, priceDecimals(moved))
    local now = os.time()
    coin.history[#coin.history + 1] = { now, coin.price }
    local keep = cfg().history or 1440
    while #coin.history > keep do table.remove(coin.history, 1) end
    return now
end

local function seed()
    for _, def in ipairs(cfg().Coins or {}) do
        local id = tostring(def.id):lower():gsub('[^%w]', '')
        coins[id] = {
            id = id,
            name = def.name or id:upper(),
            symbol = (def.symbol or id):upper(),
            color = def.color or '#888888',
            base = tonumber(def.price) or 1.0,
            price = tonumber(def.price) or 1.0,
            volatility = tonumber(def.volatility) or 0.02,
            history = {},
        }
        order[#order + 1] = id
    end

    local since = os.time() - (cfg().history or 1440) * (cfg().tick or 60)
    local rows = MySQL.query.await(
        'SELECT coin, price, UNIX_TIMESTAMP(at) AS at FROM phone_crypto_prices WHERE at >= FROM_UNIXTIME(?) ORDER BY at',
        { since }) or {}
    for _, r in ipairs(rows) do
        local coin = coins[r.coin]
        if coin then
            coin.history[#coin.history + 1] = { r.at, r.price }
            coin.price = r.price
        end
    end

    for _, id in ipairs(order) do
        local coin = coins[id]
        if #coin.history == 0 then
            local p = coin.base
            local points = math.min(cfg().history or 1440, 1440)
            local start = os.time() - points * (cfg().tick or 60)
            local values = {}
            for i = 1, points do
                p = p * math.exp((math.log(coin.base) - math.log(p)) * 0.004 + gaussian() * coin.volatility)
                p = round(p, priceDecimals(p))
                local at = start + i * (cfg().tick or 60)
                coin.history[#coin.history + 1] = { at, p }
                values[#values + 1] = ("('%s', %s, FROM_UNIXTIME(%d))"):format(id, p, at)
            end
            coin.price = p
            for i = 1, #values, 300 do
                MySQL.query.await('INSERT INTO phone_crypto_prices (coin, price, at) VALUES '
                    .. table.concat(values, ',', i, math.min(#values, i + 299)))
            end
        end
    end
end

local function priceAgo(coin, seconds)
    local target = os.time() - seconds
    for i = #coin.history, 1, -1 do
        if coin.history[i][1] <= target then return coin.history[i][2] end
    end
    return coin.history[1] and coin.history[1][2] or coin.price
end

local function sample(coin, seconds, points)
    local since = os.time() - seconds
    local slice = {}
    for _, h in ipairs(coin.history) do
        if h[1] >= since then slice[#slice + 1] = h end
    end
    if #slice <= points then
        local out = {}
        for i, h in ipairs(slice) do out[i] = h[2] end
        return out
    end
    local out = {}
    local stride = #slice / points
    for i = 1, points do
        out[i] = slice[math.min(#slice, math.floor((i - 1) * stride) + 1)][2]
    end
    out[#out] = slice[#slice][2]
    return out
end

local function holdingsOf(cid)
    local rows = MySQL.query.await('SELECT coin, amount FROM phone_crypto_holdings WHERE citizenid = ?', { cid }) or {}
    local out = {}
    for _, r in ipairs(rows) do
        if r.amount and r.amount > 0 then out[r.coin] = r.amount end
    end
    return out
end

local function setHolding(cid, coin, amount)
    if amount <= 1e-9 then
        MySQL.update.await('DELETE FROM phone_crypto_holdings WHERE citizenid = ? AND coin = ?', { cid, coin })
    else
        MySQL.update.await([[
            INSERT INTO phone_crypto_holdings (citizenid, coin, amount) VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE amount = VALUES(amount)
        ]], { cid, coin, amount })
    end
end

local function logTx(cid, coin, side, amount, price, usd, other)
    MySQL.insert.await(
        'INSERT INTO phone_crypto_tx (citizenid, coin, side, amount, price, usd, other) VALUES (?, ?, ?, ?, ?, ?, ?)',
        { cid, coin, side, amount, price, usd, other })
end

local function coinView(coin)
    local dayAgo = priceAgo(coin, 86400)
    return {
        id = coin.id, name = coin.name, symbol = coin.symbol, color = coin.color,
        price = coin.price,
        change = dayAgo > 0 and round((coin.price - dayAgo) / dayAgo * 100, 2) or 0,
        spark = sample(coin, 86400, 48),
    }
end

PhoneCallback('XS-Phone:crypto:market', function(src)
    local cid = Framework.GetCitizenId(src)
    if not cid then return { ok = false, error = 'no_character' } end
    local list = {}
    for _, id in ipairs(order) do list[#list + 1] = coinView(coins[id]) end
    return { ok = true, data = {
        coins = list,
        holdings = holdingsOf(cid),
        cash = Framework.GetMoney(src, account()),
        fee = cfg().fee or 0,
        tick = cfg().tick or 60,
    } }
end)

local RANGES = { ['1H'] = 3600, ['6H'] = 21600, ['24H'] = 86400 }

PhoneCallback('XS-Phone:crypto:coin', function(src, data)
    local cid = Framework.GetCitizenId(src)
    if not cid then return { ok = false, error = 'no_character' } end
    local coin = coins[tostring(data and data.coin or '')]
    if not coin then return { ok = false, error = 'unknown_coin' } end
    local seconds = RANGES[data.range] or 86400
    local view = coinView(coin)
    view.chart = sample(coin, seconds, 90)
    view.rangeChange = (function()
        local from = priceAgo(coin, seconds)
        return from > 0 and round((coin.price - from) / from * 100, 2) or 0
    end)()
    view.holding = holdingsOf(cid)[coin.id] or 0
    view.activity = MySQL.query.await([[
        SELECT side, amount, price, usd, other, UNIX_TIMESTAMP(created_at) * 1000 AS at
        FROM phone_crypto_tx WHERE citizenid = ? AND coin = ? ORDER BY id DESC LIMIT 15
    ]], { cid, coin.id }) or {}
    return { ok = true, data = view }
end)

PhoneCallback('XS-Phone:crypto:trade', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'cryptoTrade') then return { ok = false, error = 'rate_limited' } end
    local cid = Framework.GetCitizenId(src)
    if not cid then return { ok = false, error = 'no_character' } end
    local coin = coins[tostring(data.coin or '')]
    if not coin then return { ok = false, error = 'unknown_coin' } end
    if busy[cid] then return { ok = false, error = 'rate_limited' } end
    busy[cid] = true

    local ok, result = pcall(function()
        local fee = cfg().fee or 0
        local held = holdingsOf(cid)[coin.id] or 0
        local price = coin.price

        if data.side == 'buy' then
            local usd = math.floor(tonumber(data.usd) or 0)
            if usd < 1 or usd > (cfg().maxTrade or 1000000) then return { ok = false, error = 'bad_amount' } end
            if Framework.GetMoney(src, account()) < usd then return { ok = false, error = 'insufficient' } end
            if not Framework.RemoveMoney(src, account(), usd, 'crypto buy ' .. coin.symbol) then
                return { ok = false, error = 'insufficient' }
            end
            local amount = usd * (1 - fee) / price
            setHolding(cid, coin.id, held + amount)
            logTx(cid, coin.id, 'buy', amount, price, usd)
            return { ok = true, data = { amount = amount, usd = usd, price = price } }
        elseif data.side == 'sell' then
            local amount
            if data.all then
                amount = held
            else
                amount = (tonumber(data.usd) or 0) / price
            end
            if amount <= 0 then return { ok = false, error = 'bad_amount' } end
            if amount > held + 1e-9 then return { ok = false, error = 'not_enough_coin' } end
            amount = math.min(amount, held)
            local usd = math.floor(amount * price * (1 - fee))
            if usd < 1 then return { ok = false, error = 'bad_amount' } end
            setHolding(cid, coin.id, held - amount)
            if not Framework.AddMoney(src, account(), usd, 'crypto sell ' .. coin.symbol) then
                setHolding(cid, coin.id, held)
                return { ok = false, error = 'failed' }
            end
            logTx(cid, coin.id, 'sell', amount, price, usd)
            return { ok = true, data = { amount = amount, usd = usd, price = price } }
        end
        return { ok = false, error = 'bad_side' }
    end)
    busy[cid] = nil
    if not ok then error(result) end
    return result
end)

PhoneCallback('XS-Phone:crypto:send', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'cryptoTrade') then return { ok = false, error = 'rate_limited' } end
    local me = EnsurePhone(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local cid = me.citizenid
    local coin = coins[tostring(data.coin or '')]
    if not coin then return { ok = false, error = 'unknown_coin' } end

    local to = NormalizeNumber(tostring(data.to or ''))
    if not to or to == me.number then return { ok = false, error = 'invalid_number' } end
    local targetCid = MySQL.scalar.await('SELECT citizenid FROM phone_phones WHERE number = ?', { to })
    if not targetCid then return { ok = false, error = 'invalid_number' } end

    local amount = tonumber(data.amount) or 0
    if amount <= 0 or amount ~= amount then return { ok = false, error = 'bad_amount' } end
    if busy[cid] then return { ok = false, error = 'rate_limited' } end
    busy[cid] = true

    local ok, result = pcall(function()
        local held = holdingsOf(cid)[coin.id] or 0
        if amount > held + 1e-9 then return { ok = false, error = 'not_enough_coin' } end
        amount = math.min(amount, held)
        setHolding(cid, coin.id, held - amount)
        local theirs = holdingsOf(targetCid)[coin.id] or 0
        setHolding(targetCid, coin.id, theirs + amount)
        logTx(cid, coin.id, 'send', amount, coin.price, 0, to)
        logTx(targetCid, coin.id, 'receive', amount, coin.price, 0, me.number)

        local targetSrc = GetSourceByNumber(to)
        if targetSrc then
            TriggerClientEvent('XS-Phone:client:pushNotify', targetSrc, {
                app = 'crypto', title = 'Crypto received',
                body = ('%s %s from %s'):format(round(amount, 6), coin.symbol, me.number),
            })
        end
        return { ok = true, data = { amount = amount } }
    end)
    busy[cid] = nil
    if not ok then error(result) end
    return result
end)

CreateThread(function()
    AwaitDB()
    math.randomseed(os.time())
    seed()
    while true do
        Wait((cfg().tick or 60) * 1000)
        local rows = {}
        local now
        for _, id in ipairs(order) do
            now = step(coins[id])
            rows[#rows + 1] = { id, coins[id].price, now }
        end
        for _, r in ipairs(rows) do
            MySQL.insert.await('INSERT INTO phone_crypto_prices (coin, price, at) VALUES (?, ?, FROM_UNIXTIME(?))', r)
        end
        local keepSeconds = (cfg().history or 1440) * (cfg().tick or 60)
        MySQL.update.await('DELETE FROM phone_crypto_prices WHERE at < FROM_UNIXTIME(?)', { os.time() - keepSeconds })
    end
end)

AddEventHandler('playerDropped', function()
    local cid = Framework.GetCitizenId(source)
    if cid then busy[cid] = nil end
end)
