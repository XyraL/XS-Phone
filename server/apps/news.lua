local TITLE_MAX = 90
local BODY_MAX = 4000
local lastBreaking = {}

local function cfg()
    return Config.Phone.News or {}
end

local function isReporter(src)
    local job = Framework.GetJobInfo(src)
    if not job then return false, false end
    for _, name in ipairs(cfg().jobs or {}) do
        if job.name == name then return true, job.isboss end
    end
    return false, false
end

local function validCategory(raw)
    for _, c in ipairs(cfg().categories or {}) do
        if c == raw then return c end
    end
    return (cfg().categories or { 'City' })[1]
end

local function trim(s, max)
    return (tostring(s or ''):gsub('^%s+', ''):gsub('%s+$', '')):sub(1, max)
end

PhoneCallback('XS-Phone:news:list', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local cid = Framework.GetCitizenId(src)
    local writer, boss = isReporter(src)

    local rows = MySQL.query.await([[
        SELECT id, author_cid, author_name AS author, title, LEFT(body, 160) AS excerpt, image_url AS image,
               category, breaking, UNIX_TIMESTAMP(created_at) * 1000 AS at
        FROM phone_news ORDER BY id DESC LIMIT 40
    ]]) or {}

    for _, r in ipairs(rows) do
        r.breaking = DbBool(r.breaking)
        r.mine = r.author_cid == cid
        r.canDelete = r.mine or boss
        r.author_cid = nil
    end

    return { ok = true, data = {
        stories = rows,
        canWrite = writer,
        categories = cfg().categories or {},
    } }
end)

PhoneCallback('XS-Phone:news:get', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local row = MySQL.single.await([[
        SELECT id, author_cid, author_name AS author, title, body, image_url AS image,
               category, breaking, UNIX_TIMESTAMP(created_at) * 1000 AS at
        FROM phone_news WHERE id = ?
    ]], { tonumber(data and data.id) or 0 })
    if not row then return { ok = false, error = 'gone' } end
    local _, boss = isReporter(src)
    row.breaking = DbBool(row.breaking)
    row.canDelete = row.author_cid == Framework.GetCitizenId(src) or boss
    row.author_cid = nil
    return { ok = true, data = row }
end)

PhoneCallback('XS-Phone:news:post', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'newsPost') then return { ok = false, error = 'rate_limited' } end
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    if not isReporter(src) then return { ok = false, error = 'not_reporter' } end

    local title = trim(data.title, TITLE_MAX)
    local body = trim(data.body, BODY_MAX)
    if title == '' or body == '' then return { ok = false, error = 'empty' } end

    local image = nil
    if data.imageUrl ~= nil and data.imageUrl ~= '' then
        image = tostring(data.imageUrl)
        if not OwnsPhoto(me, image) then return { ok = false, error = 'bad_media' } end
    end

    local cid = Framework.GetCitizenId(src)
    local breaking = data.breaking == true
    if breaking then
        local wait = (cfg().breakingCooldown or 300) - (os.time() - (lastBreaking[cid] or 0))
        if wait > 0 then return { ok = false, error = 'breaking_cooldown', wait = wait } end
        lastBreaking[cid] = os.time()
    end

    local id = MySQL.insert.await([[
        INSERT INTO phone_news (author_cid, author_name, author_number, title, body, image_url, category, breaking)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ]], { cid, Framework.GetName(src) or 'Staff Reporter', me, title, body, image,
        validCategory(data.category), breaking and 1 or 0 })

    if breaking then
        for _, playerId in ipairs(GetPlayers()) do
            local target = tonumber(playerId)
            local entry = target ~= src and EnsurePhone(target) or nil
            if entry and not entry.settings.airplane
                and (not Config.Phone.Item.enabled or Framework.HasItem(target, Config.Phone.Item.name)) then
                TriggerClientEvent('XS-Phone:client:pushNotify', target, {
                    app = 'news', title = 'Breaking News', body = title,
                })
            end
        end
    end

    return { ok = true, data = { id = id } }
end)

PhoneCallback('XS-Phone:news:delete', function(src, data)
    if not RateOK(src, 'newsPost') then return { ok = false, error = 'rate_limited' } end
    local id = tonumber(data and data.id) or 0
    local _, boss = isReporter(src)
    if boss then
        MySQL.update.await('DELETE FROM phone_news WHERE id = ?', { id })
    else
        MySQL.update.await('DELETE FROM phone_news WHERE id = ? AND author_cid = ?',
            { id, Framework.GetCitizenId(src) })
    end
    return { ok = true }
end)
