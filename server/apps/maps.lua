local LABEL_MAX = 40
local ICONS = { pin = true, home = true, work = true, star = true, car = true, food = true }

local function coord(v, lo, hi)
    v = tonumber(v)
    if not v or v ~= v or v < lo or v > hi then return nil end
    return math.floor(v * 10 + 0.5) / 10
end

function MapPoint(raw)
    if type(raw) ~= 'table' then return nil end
    local x = coord(raw.x, -4500.0, 5000.0)
    local y = coord(raw.y, -5000.0, 8500.0)
    if not x or not y then return nil end
    return x, y
end

function MapLabel(raw, max)
    local s = tostring(raw or ''):gsub('%c', ' '):gsub('^%s+', ''):gsub('%s+$', '')
    return s:sub(1, max or LABEL_MAX)
end

function DecodeLocation(raw)
    if type(raw) ~= 'string' or raw == '' then return nil end
    local ok, loc = pcall(json.decode, raw)
    if not ok or type(loc) ~= 'table' then return nil end
    return loc
end

local function cityPlaces()
    local out = {}
    for _, p in ipairs((Config.Phone.Maps and Config.Phone.Maps.Places) or {}) do
        local x, y = MapPoint(p)
        if x then
            out[#out + 1] = { label = tostring(p.label or 'Place'), icon = tostring(p.icon or 'pin'), x = x, y = y }
        end
    end
    return out
end

PhoneCallback('XS-Phone:maps:list', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local places = MySQL.query.await(
        'SELECT id, label, icon, x, y FROM phone_places WHERE owner_number = ? ORDER BY id', { me }) or {}

    local rows = MySQL.query.await([[
        SELECT m.id, m.sender_number AS sender, m.location, UNIX_TIMESTAMP(m.sent_at) * 1000 AS at
        FROM phone_messages m
        JOIN phone_thread_members tm ON tm.thread_id = m.thread_id AND tm.number = ?
        WHERE m.location IS NOT NULL AND m.sender_number != ?
        ORDER BY m.id DESC LIMIT 12
    ]], { me, me }) or {}

    local shared = {}
    for _, r in ipairs(rows) do
        local loc = DecodeLocation(r.location)
        if loc and tonumber(loc.x) and tonumber(loc.y) then
            shared[#shared + 1] = {
                id = r.id, sender = r.sender, at = r.at,
                x = tonumber(loc.x), y = tonumber(loc.y),
                label = loc.label, live = loc.live == true,
            }
        end
    end

    return { ok = true, data = { places = places, city = cityPlaces(), shared = shared } }
end)

PhoneCallback('XS-Phone:maps:save', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'mapsWrite') then return { ok = false, error = 'rate_limited' } end
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local x, y = MapPoint(data)
    if not x then return { ok = false, error = 'bad_point' } end
    local label = MapLabel(data.label)
    if label == '' then return { ok = false, error = 'bad_label' } end
    local icon = ICONS[data.icon] and data.icon or 'pin'

    local count = MySQL.scalar.await('SELECT COUNT(*) FROM phone_places WHERE owner_number = ?', { me }) or 0
    if count >= ((Config.Phone.Maps and Config.Phone.Maps.maxPlaces) or 50) then
        return { ok = false, error = 'full' }
    end

    local id = MySQL.insert.await(
        'INSERT INTO phone_places (owner_number, label, icon, x, y) VALUES (?, ?, ?, ?, ?)',
        { me, label, icon, x, y })
    return { ok = true, data = { id = id, label = label, icon = icon, x = x, y = y } }
end)

PhoneCallback('XS-Phone:maps:delete', function(src, data)
    if not RateOK(src, 'mapsWrite') then return { ok = false, error = 'rate_limited' } end
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    MySQL.update.await('DELETE FROM phone_places WHERE id = ? AND owner_number = ?',
        { tonumber(data and data.id) or 0, me })
    return { ok = true }
end)
