function PhoneCallback(name, handler)
    lib.callback.register(name, function(source, ...)
        local ok, result = pcall(handler, source, ...)
        if not ok then
            print(('^1[cipher-phone]^0 callback %s failed for %s: %s'):format(name, source, result))
            return { ok = false, error = 'internal' }
        end
        return result
    end)
end

local buckets = {}

function RateOK(src, action)
    local limit = Config.Phone.RateLimits[action]
    if not limit then return true end

    local now = os.time()
    buckets[src] = buckets[src] or {}
    local hits = buckets[src][action] or {}

    local kept = {}
    for _, t in ipairs(hits) do
        if now - t < 60 then kept[#kept + 1] = t end
    end

    if #kept >= limit then
        buckets[src][action] = kept
        return false
    end

    kept[#kept + 1] = now
    buckets[src][action] = kept
    return true
end

local bySrc = {}
local byNumber = {}

function GetPhoneNumber(src)
    local entry = bySrc[src] or EnsurePhone(src)
    return entry and entry.number or nil
end

function GetSourceByNumber(number)
    return byNumber[number]
end

function GetSettingsByNumber(number)
    local src = byNumber[number]
    return src and bySrc[src] and bySrc[src].settings or nil
end

AddEventHandler('playerDropped', function()
    local entry = bySrc[source]
    if entry then byNumber[entry.number] = nil end
    bySrc[source] = nil
    buckets[source] = nil
end)

local function generateNumber()
    local fmt = Config.Phone.Numbers.format
    for _ = 1, 100 do
        local candidate = fmt:gsub('#', function()
            return tostring(math.random(0, 9))
        end)
        local taken = MySQL.scalar.await('SELECT 1 FROM phone_phones WHERE number = ?', { candidate })
        if not taken then return candidate end
    end
    error(('number format %s is exhausted — add digits'):format(fmt))
end

local function withDefaults(settings)
    local merged = settings or {}
    for k, v in pairs(Config.Phone.DefaultSettings) do
        if merged[k] == nil then merged[k] = v end
    end
    return merged
end

function EnsurePhone(src)
    local cached = bySrc[src]
    if cached then return cached end

    AwaitDB()
    local citizenid = Framework.GetCitizenId(src)
    if not citizenid then return nil end

    local row = MySQL.single.await(
        'SELECT number, pin, settings, installed_apps FROM phone_phones WHERE citizenid = ?', { citizenid })

    local entry
    if row then
        entry = {
            number = row.number,
            hasPin = row.pin ~= nil,
            settings = withDefaults(row.settings and json.decode(row.settings) or nil),
            installedApps = row.installed_apps and json.decode(row.installed_apps)
                or Config.Phone.Store.DefaultInstalled,
        }
    else
        local number
        if Config.Phone.Numbers.mode == 'framework' then
            number = Framework.GetCharinfoNumber(src)
            if number then
                local taken = MySQL.scalar.await('SELECT 1 FROM phone_phones WHERE number = ?', { number })
                if taken then number = nil end
            end
        end
        number = number or generateNumber()

        local settings = withDefaults(nil)
        MySQL.insert.await(
            'INSERT INTO phone_phones (citizenid, number, settings, installed_apps) VALUES (?, ?, ?, ?)',
            { citizenid, number, json.encode(settings), json.encode(Config.Phone.Store.DefaultInstalled) })

        if Config.Debug then
            print(('^2[cipher-phone]^0 assigned %s to %s'):format(number, citizenid))
        end
        entry = { number = number, hasPin = false, settings = settings,
            installedApps = Config.Phone.Store.DefaultInstalled }
    end

    entry.citizenid = citizenid
    bySrc[src] = entry
    byNumber[entry.number] = src
    return entry
end

Framework.OnPlayerLoaded(function(src)
    CreateThread(function()
        local stale = bySrc[src]
        if stale then
            local cid = Framework.GetCitizenId(src)
            if cid == nil or stale.citizenid == cid then return end
            byNumber[stale.number] = nil
            bySrc[src] = nil
        end
        EnsurePhone(src)
    end)
end)

PhoneCallback('cipher-phone:hasPhone', function(src)
    if not Config.Phone.Item.enabled then return { ok = true, has = true } end
    return { ok = true, has = Framework.HasItem(src, Config.Phone.Item.name) }
end)

local function phonePayload(src)
    local phone = EnsurePhone(src)
    if not phone then return nil end

    local unread = MySQL.scalar.await([[
        SELECT COUNT(*) FROM phone_messages m
        JOIN phone_thread_members tm ON tm.thread_id = m.thread_id AND tm.number = ?
        WHERE m.id > tm.last_read AND m.sender_number != tm.number
    ]], { phone.number }) or 0

    local unreadMail = MySQL.scalar.await([[
        SELECT COUNT(*) FROM phone_emails e
        JOIN phone_mail_accounts a ON a.address = e.owner_address
        WHERE a.number = ? AND e.folder = 'inbox' AND e.is_read = 0
    ]], { phone.number }) or 0

    return {
        number = phone.number,
        hasPin = phone.hasPin,
        settings = phone.settings,
        os = Config.Phone.Branding.osName,
        appNames = Config.Phone.AppNames,
        installedApps = phone.installedApps,
        version = GetResourceMetadata(GetCurrentResourceName(), 'version', 0) or '0.0.0',
        badges = { messages = unread, mail = unreadMail },
    }
end

PhoneCallback('cipher-phone:getPhoneData', function(src)
    local data = phonePayload(src)
    if not data then return { ok = false, error = 'no_character' } end
    return { ok = true, data = data }
end)

PhoneCallback('cipher-phone:phone:changeNumber', function(src)
    if not RateOK(src, 'numberChange') then return { ok = false, error = 'rate_limited' } end

    local entry = EnsurePhone(src)
    if not entry then return { ok = false, error = 'no_character' } end
    if numberInCall and numberInCall[entry.number] then return { ok = false, error = 'busy' } end

    local cost = Config.Phone.Numbers.changeCost or 0
    if cost > 0 then
        if Framework.GetMoney(src, 'bank') < cost then
            return { ok = false, error = 'insufficient' }
        end
        if not Framework.RemoveMoney(src, 'bank', cost, 'phone number change') then
            return { ok = false, error = 'insufficient' }
        end
    end

    AwaitDB()
    local old = entry.number
    local new = generateNumber()

    MySQL.update.await('UPDATE phone_phones SET number = ? WHERE number = ?', { new, old })
    for _, migration in ipairs({
        { 'phone_contacts', 'owner_number' },
        { 'phone_photos', 'owner_number' },
        { 'phone_notes', 'owner_number' },
        { 'phone_alarms', 'owner_number' },
        { 'phone_music', 'owner_number' },
        { 'phone_mail', 'owner_number' },
        { 'phone_social_profiles', 'number' },
        { 'phone_social_likes', 'number' },
        { 'phone_social_follows', 'follower' },
        { 'phone_social_follows', 'followed' },
        { 'phone_prism_posts', 'author_number' },
        { 'phone_prism_likes', 'number' },
        { 'phone_prism_comments', 'author_number' },
        { 'phone_match_profiles', 'number' },
        { 'phone_match_swipes', 'swiper' },
        { 'phone_match_swipes', 'target' },
        { 'phone_match_matches', 'a' },
        { 'phone_match_matches', 'b' },
        { 'phone_darkchat_members', 'number' },
        { 'phone_mail_accounts', 'number' },
    }) do
        pcall(MySQL.update.await,
            ('UPDATE `%s` SET `%s` = ? WHERE `%s` = ?'):format(migration[1], migration[2], migration[2]),
            { new, old })
    end
    MySQL.update.await('DELETE FROM phone_market WHERE seller_number = ?', { new })

    local flipped = MySQL.query.await(
        'SELECT a, b FROM phone_match_matches WHERE a > b') or {}
    for _, row in ipairs(flipped) do
        MySQL.update.await(
            'UPDATE phone_match_matches SET a = ?, b = ? WHERE a = ? AND b = ?',
            { row.b, row.a, row.a, row.b })
    end

    byNumber[old] = nil
    entry.number = new
    byNumber[new] = src

    return { ok = true, data = phonePayload(src) }
end)

local function isStoreApp(id)
    for _, app in ipairs(Config.Phone.Store.Available) do
        if app == id then return true end
    end
    return false
end

local function saveInstalled(src, entry)
    AwaitDB()
    local citizenid = Framework.GetCitizenId(src)
    if not citizenid then return end
    MySQL.update.await('UPDATE phone_phones SET installed_apps = ? WHERE citizenid = ?',
        { json.encode(entry.installedApps), citizenid })
end

PhoneCallback('cipher-phone:store:install', function(src, data)
    if not RateOK(src, 'storeWrite') then return { ok = false, error = 'rate_limited' } end
    local entry = EnsurePhone(src)
    if not entry then return { ok = false, error = 'no_character' } end

    local id = tostring(data and data.id or '')
    if not isStoreApp(id) then return { ok = false, error = 'unknown_app' } end

    for _, app in ipairs(entry.installedApps) do
        if app == id then return { ok = true, data = { installed = entry.installedApps } } end
    end
    local installed = {}
    for _, app in ipairs(entry.installedApps) do installed[#installed + 1] = app end
    installed[#installed + 1] = id
    entry.installedApps = installed
    saveInstalled(src, entry)
    return { ok = true, data = { installed = entry.installedApps } }
end)

PhoneCallback('cipher-phone:store:uninstall', function(src, data)
    if not RateOK(src, 'storeWrite') then return { ok = false, error = 'rate_limited' } end
    local entry = EnsurePhone(src)
    if not entry then return { ok = false, error = 'no_character' } end

    local id = tostring(data and data.id or '')
    local installed = {}
    for _, app in ipairs(entry.installedApps) do
        if app ~= id then installed[#installed + 1] = app end
    end
    entry.installedApps = installed
    saveInstalled(src, entry)
    return { ok = true, data = { installed = entry.installedApps } }
end)

PhoneCallback('cipher-phone:saveSettings', function(src, incoming)
    if type(incoming) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'saveSettings') then return { ok = false, error = 'rate_limited' } end

    local phone = EnsurePhone(src)
    if not phone then return { ok = false, error = 'no_character' } end

    local clean = {}
    for key, default in pairs(Config.Phone.DefaultSettings) do
        local value = incoming[key]
        if value ~= nil and type(value) == type(default) then
            if type(value) == 'string' and #value > 300 then value = value:sub(1, 300) end
            clean[key] = value
        else
            clean[key] = default
        end
    end

    local citizenid = Framework.GetCitizenId(src)
    MySQL.update.await(
        'UPDATE phone_phones SET settings = ? WHERE citizenid = ?',
        { json.encode(clean), citizenid })

    phone.settings = clean
    return { ok = true }
end)

PhoneCallback('cipher-phone:pin:verify', function(src, data)
    if not RateOK(src, 'pinVerify') then return { ok = false, error = 'rate_limited' } end
    local phone = EnsurePhone(src)
    if not phone then return { ok = false, error = 'no_character' } end

    AwaitDB()
    local citizenid = Framework.GetCitizenId(src)
    local stored = MySQL.scalar.await(
        'SELECT pin FROM phone_phones WHERE citizenid = ?', { citizenid })
    local valid = stored == nil or stored == tostring(data and data.pin or '')
    return { ok = true, valid = valid }
end)

PhoneCallback('cipher-phone:pin:set', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'pinSet') then return { ok = false, error = 'rate_limited' } end
    local phone = EnsurePhone(src)
    if not phone then return { ok = false, error = 'no_character' } end

    AwaitDB()
    local citizenid = Framework.GetCitizenId(src)

    local stored = MySQL.scalar.await(
        'SELECT pin FROM phone_phones WHERE citizenid = ?', { citizenid })
    if stored ~= nil and stored ~= tostring(data.current or '') then
        return { ok = false, error = 'wrong_pin' }
    end

    local pin = data.pin
    if pin ~= nil then
        pin = tostring(pin)
        if not pin:match('^%d%d%d%d$') then return { ok = false, error = 'bad_pin' } end
    end

    MySQL.update.await('UPDATE phone_phones SET pin = ? WHERE citizenid = ?', { pin, citizenid })
    phone.hasPin = pin ~= nil
    return { ok = true, hasPin = phone.hasPin }
end)

local function itemSource(src)
    return type(src) == 'table' and src.PlayerData.source or src
end

if Config.Phone.Item.enabled then
    CreateThread(function()
        Framework.CreateUseableItem(Config.Phone.Item.name, function(src)
            TriggerClientEvent('cipher-phone:client:use', itemSource(src))
        end)
    end)
end

exports('GetNumber', function(src)
    return GetPhoneNumber(src)
end)

exports('Notify', function(target, data)
    local src = type(target) == 'string' and GetSourceByNumber(target) or target
    if type(src) ~= 'number' or not bySrc[src] then return false end
    if type(data) ~= 'table' then return false end
    TriggerClientEvent('cipher-phone:client:pushNotify', src, {
        app = tostring(data.app or 'settings'),
        title = tostring(data.title or 'Notification'):sub(1, 60),
        body = tostring(data.body or ''):sub(1, 200),
    })
    return true
end)
