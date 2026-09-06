local MAX_PHOTOS = 3

local deckTokens = {}
local LastSwipe = {}

local function pair(a, b)
    if a < b then return a, b end
    return b, a
end

local function myProfile(number)
    local row = MySQL.single.await(
        'SELECT number, username, name, age, bio, photos, active FROM phone_match_profiles WHERE number = ?',
        { number })
    if not row then return nil end
    row.photos = json.decode(row.photos) or {}
    row.active = DbBool(row.active)
    return row
end

local function rebindMatch(old, new)
    for _, m in ipairs({
        { 'phone_match_profiles', 'number' },
        { 'phone_match_swipes', 'swiper' },
        { 'phone_match_swipes', 'target' },
        { 'phone_match_matches', 'a' },
        { 'phone_match_matches', 'b' },
    }) do
        pcall(MySQL.update.await,
            ('UPDATE `%s` SET `%s` = ? WHERE `%s` = ?'):format(m[1], m[2], m[2]),
            { new, old })
    end
    local flipped = MySQL.query.await(
        'SELECT a, b FROM phone_match_matches WHERE a > b') or {}
    for _, row in ipairs(flipped) do
        MySQL.update.await(
            'UPDATE phone_match_matches SET a = ?, b = ? WHERE a = ? AND b = ?',
            { row.b, row.a, row.a, row.b })
    end
end

local function detach(profile)
    return 'x:' .. (profile.username or profile.number)
end

local function matchedWith(me, other)
    local a, b = pair(me, other)
    return MySQL.scalar.await(
        'SELECT 1 FROM phone_match_matches WHERE a = ? AND b = ?', { a, b }) ~= nil
end

PhoneCallback('cipher-phone:match:me', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local p = myProfile(me)
    if p then p.number = nil end -- own card doesn't need it either
    return { ok = true, data = p }
end)

PhoneCallback('cipher-phone:match:saveProfile', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'matchWrite') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local name = tostring(data.name or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, 30)
    if name == '' then return { ok = false, error = 'no_name' } end

    local birthdate = Framework.GetBirthdate(src)
    local year = birthdate and tostring(birthdate):match('(%d%d%d%d)')
    local age = year and (tonumber(os.date('%Y')) - tonumber(year)) or 21
    if age < 18 then age = 18 end
    if age > 99 then age = 99 end

    local bio = tostring(data.bio or ''):sub(1, 200)

    local photos = {}
    if type(data.photos) == 'table' then
        for i, url in ipairs(data.photos) do
            if i > MAX_PHOTOS then break end
            url = tostring(url)
            if OwnsPhoto(me, url) then photos[#photos + 1] = url end
        end
    end
    if #photos == 0 then return { ok = false, error = 'no_photos' } end

    local active = data.active ~= false

    local existing = myProfile(me)
    if not existing then
        local username = tostring(data.username or ''):lower()
        if #username < 3 or #username > 15 or not username:match('^[a-z0-9_]+$') then
            return { ok = false, error = 'bad_username' }
        end
        local password = CleanPassword(data.password)
        if not password then return { ok = false, error = 'bad_password' } end

        local ok = pcall(MySQL.insert.await, [[
            INSERT INTO phone_match_profiles (number, username, password, name, age, bio, photos, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ]], { me, username, password, name, age, bio ~= '' and bio or nil,
            json.encode(photos), active and 1 or 0 })
        if not ok then return { ok = false, error = 'taken' } end
        return { ok = true }
    end

    MySQL.update.await([[
        UPDATE phone_match_profiles SET name = ?, age = ?, bio = ?, photos = ?, active = ?
        WHERE number = ?
    ]], { name, age, bio ~= '' and bio or nil, json.encode(photos), active and 1 or 0, me })

    return { ok = true }
end)

PhoneCallback('cipher-phone:match:login', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'accountAuth') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local username = tostring(data.username or ''):lower()
    local row = MySQL.single.await(
        'SELECT number, password FROM phone_match_profiles WHERE username = ?', { username })
    if not row or not row.password or row.password ~= tostring(data.password or '') then
        return { ok = false, error = 'bad_login' }
    end

    if row.number ~= me then
        local current = myProfile(me)
        if current then rebindMatch(me, detach(current)) end
        rebindMatch(row.number, me)
    end
    deckTokens[src] = nil
    LastSwipe[src] = nil
    return { ok = true }
end)

PhoneCallback('cipher-phone:match:logout', function(src)
    if not RateOK(src, 'accountAuth') then return { ok = false, error = 'rate_limited' } end
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local current = myProfile(me)
    if current then rebindMatch(me, detach(current)) end
    deckTokens[src] = nil
    LastSwipe[src] = nil
    return { ok = true }
end)

PhoneCallback('cipher-phone:match:deck', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    if not myProfile(me) then return { ok = false, error = 'no_profile' } end

    local rows = MySQL.query.await([[
        SELECT p.number, p.name, p.age, p.bio, p.photos
        FROM phone_match_profiles p
        WHERE p.active = 1 AND p.number != ? AND p.number NOT LIKE 'x:%'
          AND NOT EXISTS (SELECT 1 FROM phone_match_swipes s
                          WHERE s.swiper = ? AND s.target = p.number)
        ORDER BY RAND() LIMIT 10
    ]], { me, me })

    local deck, tokens = {}, {}
    for i, r in ipairs(rows) do
        local token = ('%d-%d'):format(i, math.random(100000, 999999))
        tokens[token] = r.number
        deck[#deck + 1] = {
            token = token, name = r.name, age = r.age, bio = r.bio,
            photos = json.decode(r.photos) or {},
            online = GetSourceByNumber(r.number) ~= nil,
        }
    end
    deckTokens[src] = tokens
    return { ok = true, data = deck }
end)

PhoneCallback('cipher-phone:match:swipe', function(src, data)
    if not RateOK(src, 'matchSwipe') then return { ok = false, error = 'rate_limited' } end
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local tokens = deckTokens[src]
    local token = tostring(data and data.token or '')
    local target = tokens and tokens[token]
    if not target then return { ok = false, error = 'stale_deck' } end
    tokens[token] = nil

    local liked = data.liked == true
    local super = data.super == true
    pcall(MySQL.insert.await,
        'INSERT INTO phone_match_swipes (swiper, target, liked) VALUES (?, ?, ?)',
        { me, target, liked and 1 or 0 })

    if not liked then
        LastSwipe[src] = { token = token, target = target }
        return { ok = true, matched = false }
    end

    local reciprocal = MySQL.scalar.await(
        'SELECT 1 FROM phone_match_swipes WHERE swiper = ? AND target = ? AND liked = 1',
        { target, me })
    if not reciprocal then
        LastSwipe[src] = { token = token, target = target }
        if super then
            local tgt = GetSourceByNumber(target)
            if tgt then
                TriggerClientEvent('cipher-phone:client:pushNotify', tgt, {
                    app = 'match', title = Config.Phone.AppNames.match,
                    body = 'Someone Super Liked you. Keep swiping to find them ⭐',
                })
            end
        end
        return { ok = true, matched = false }
    end

    LastSwipe[src] = nil

    local a, b = pair(me, target)
    pcall(MySQL.insert.await,
        'INSERT INTO phone_match_matches (a, b) VALUES (?, ?)', { a, b })

    local mine = myProfile(me)
    local theirs = myProfile(target)
    local tgt = GetSourceByNumber(target)
    if tgt then
        TriggerClientEvent('cipher-phone:client:pushNotify', tgt, {
            app = 'match', title = Config.Phone.AppNames.match,
            body = ('It\'s a match — you and %s liked each other!'):format(mine and mine.name or 'someone'),
        })
    end

    return { ok = true, matched = true, data = {
        name = theirs and theirs.name, photo = theirs and theirs.photos[1],
        number = target,
    } }
end)

PhoneCallback('cipher-phone:match:unswipe', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local last = LastSwipe[src]
    if not last then return { ok = false, error = 'nothing' } end
    LastSwipe[src] = nil

    MySQL.update.await(
        'DELETE FROM phone_match_swipes WHERE swiper = ? AND target = ?', { me, last.target })
    deckTokens[src] = deckTokens[src] or {}
    deckTokens[src][last.token] = last.target
    return { ok = true }
end)

PhoneCallback('cipher-phone:match:matches', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local rows = MySQL.query.await([[
        SELECT m.a, m.b, UNIX_TIMESTAMP(m.created_at) * 1000 AS at,
               p.name, p.age, p.photos
        FROM phone_match_matches m
        JOIN phone_match_profiles p ON p.number = IF(m.a = ?, m.b, m.a)
        WHERE m.a = ? OR m.b = ?
        ORDER BY m.created_at DESC
    ]], { me, me, me })

    local out = {}
    for _, r in ipairs(rows) do
        local other = r.a == me and r.b or r.a
        out[#out + 1] = {
            number = other,
            name = r.name, age = r.age,
            photo = (json.decode(r.photos) or {})[1],
            at = r.at,
        }
    end
    return { ok = true, data = out }
end)

PhoneCallback('cipher-phone:match:unmatch', function(src, data)
    if not RateOK(src, 'matchWrite') then return { ok = false, error = 'rate_limited' } end
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local other = NormalizeNumber(tostring(data and data.number or ''))
    if not other or not matchedWith(me, other) then return { ok = false, error = 'gone' } end

    local a, b = pair(me, other)
    MySQL.update.await('DELETE FROM phone_match_matches WHERE a = ? AND b = ?', { a, b })
    MySQL.update.await(
        'DELETE FROM phone_match_swipes WHERE (swiper = ? AND target = ?) OR (swiper = ? AND target = ?)',
        { me, other, other, me })
    return { ok = true }
end)

AddEventHandler('playerDropped', function()
    deckTokens[source] = nil
    LastSwipe[source] = nil
end)
