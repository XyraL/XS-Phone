local function expiryCutoff()
    return os.time() - (Config.Phone.Market.expiryDays or 14) * 86400
end

PhoneCallback('XS-Phone:market:list', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    MySQL.update.await('DELETE FROM phone_market WHERE created_at < FROM_UNIXTIME(?)',
        { expiryCutoff() })

    local rows = MySQL.query.await([[
        SELECT id, seller_number AS seller, title, body, price,
               image_url AS image, UNIX_TIMESTAMP(created_at) * 1000 AS at
        FROM phone_market ORDER BY id DESC LIMIT 50
    ]])
    for _, r in ipairs(rows) do
        r.mine = r.seller == me
    end
    return { ok = true, data = rows }
end)

PhoneCallback('XS-Phone:market:post', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'marketPost') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local title = tostring(data.title or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, 60)
    local body = tostring(data.body or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, 500)
    if title == '' or body == '' then return { ok = false, error = 'empty' } end

    local price = math.floor(tonumber(data.price) or 0)
    if price < 0 or price > 10000000 then return { ok = false, error = 'bad_price' } end

    local image = nil
    if data.imageUrl ~= nil then
        image = tostring(data.imageUrl)
        if not OwnsPhoto(me, image) then return { ok = false, error = 'bad_media' } end
    end

    local active = MySQL.scalar.await(
        'SELECT COUNT(*) FROM phone_market WHERE seller_number = ?', { me }) or 0
    if active >= (Config.Phone.Market.maxListings or 5) then
        return { ok = false, error = 'full' }
    end

    local id = MySQL.insert.await(
        'INSERT INTO phone_market (seller_number, title, body, price, image_url) VALUES (?, ?, ?, ?, ?)',
        { me, title, body, price, image })
    return { ok = true, data = { id = id } }
end)

PhoneCallback('XS-Phone:market:delete', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    MySQL.update.await('DELETE FROM phone_market WHERE id = ? AND seller_number = ?',
        { tonumber(data and data.id) or 0, me })
    return { ok = true }
end)
