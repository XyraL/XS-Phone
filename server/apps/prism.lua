local CAPTION_MAX = 200
local COMMENT_MAX = 300

local function myProfile(number)
    return MySQL.single.await(
        'SELECT number, handle, display, avatar_url AS avatar, verified FROM phone_social_profiles WHERE number = ?',
        { number })
end

local function queryPosts(me, extraWhere, params, limit)
    local sql = ([[
        SELECT p.id, p.image_url AS image, p.caption,
               UNIX_TIMESTAMP(p.created_at) * 1000 AS at,
               pr.handle, pr.display, pr.avatar_url AS avatar, pr.verified,
               (p.author_number = ?) AS mine,
               (SELECT COUNT(*) FROM phone_prism_likes l WHERE l.post_id = p.id) AS likes,
               EXISTS(SELECT 1 FROM phone_prism_likes l WHERE l.post_id = p.id AND l.number = ?) AS liked,
               (SELECT COUNT(*) FROM phone_prism_comments c WHERE c.post_id = p.id) AS comments
        FROM phone_prism_posts p
        JOIN phone_social_profiles pr ON pr.number = p.author_number
        WHERE %s
        ORDER BY p.id DESC LIMIT %d
    ]]):format(extraWhere, limit or 30)

    local rows = MySQL.query.await(sql, params)
    for _, r in ipairs(rows) do
        r.mine = r.mine == 1
        r.liked = r.liked == 1
        r.verified = r.verified == 1
    end
    return rows
end

local function notifyAuthor(postId, exceptNumber, body)
    local author = MySQL.scalar.await(
        'SELECT author_number FROM phone_prism_posts WHERE id = ?', { postId })
    if not author or author == exceptNumber then return end
    local tgt = GetSourceByNumber(author)
    if tgt then
        TriggerClientEvent('cipher-phone:client:pushNotify', tgt, {
            app = 'prism', title = Config.Phone.AppNames.prism, body = body,
        })
    end
end

PhoneCallback('cipher-phone:prism:feed', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local before = tonumber(data and data.before)
    if data and data.scope == 'following' then
        return { ok = true, data = queryPosts(me, [[
            (p.author_number = ? OR p.author_number IN
                (SELECT followed FROM phone_social_follows WHERE follower = ?))
            AND (? IS NULL OR p.id < ?)
        ]], { me, me, me, me, before, before }) }
    end
    return { ok = true, data = queryPosts(me,
        '(? IS NULL OR p.id < ?)', { me, me, before, before }) }
end)

PhoneCallback('cipher-phone:prism:post', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'prismPost') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    if not myProfile(me) then return { ok = false, error = 'no_profile' } end

    local image = tostring(data.imageUrl or '')
    if not OwnsPhoto(me, image) then return { ok = false, error = 'bad_media' } end

    local caption = tostring(data.caption or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, CAPTION_MAX)

    local id = MySQL.insert.await(
        'INSERT INTO phone_prism_posts (author_number, image_url, caption) VALUES (?, ?, ?)',
        { me, image, caption ~= '' and caption or nil })
    return { ok = true, data = { id = id } }
end)

PhoneCallback('cipher-phone:prism:like', function(src, data)
    if not RateOK(src, 'prismWrite') then return { ok = false, error = 'rate_limited' } end
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local profile = myProfile(me)
    if not profile then return { ok = false, error = 'no_profile' } end

    local postId = tonumber(data and data.postId) or 0
    local existing = MySQL.scalar.await(
        'SELECT 1 FROM phone_prism_likes WHERE post_id = ? AND number = ?', { postId, me })
    if existing then
        MySQL.update.await(
            'DELETE FROM phone_prism_likes WHERE post_id = ? AND number = ?', { postId, me })
        return { ok = true, liked = false }
    end

    if not MySQL.scalar.await('SELECT 1 FROM phone_prism_posts WHERE id = ?', { postId }) then
        return { ok = false, error = 'gone' }
    end
    MySQL.insert.await(
        'INSERT INTO phone_prism_likes (post_id, number) VALUES (?, ?)', { postId, me })
    notifyAuthor(postId, me, ('@%s liked your photo'):format(profile.handle))
    return { ok = true, liked = true }
end)

PhoneCallback('cipher-phone:prism:comments', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local postId = tonumber(data and data.postId) or 0

    local rows = MySQL.query.await([[
        SELECT c.id, c.body, UNIX_TIMESTAMP(c.created_at) * 1000 AS at,
               pr.handle, pr.display, pr.avatar_url AS avatar,
               (c.author_number = ?) AS mine
        FROM phone_prism_comments c
        JOIN phone_social_profiles pr ON pr.number = c.author_number
        WHERE c.post_id = ?
        ORDER BY c.id ASC LIMIT 100
    ]], { me, postId })
    for _, r in ipairs(rows) do r.mine = r.mine == 1 end
    return { ok = true, data = rows }
end)

PhoneCallback('cipher-phone:prism:comment', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'prismWrite') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local profile = myProfile(me)
    if not profile then return { ok = false, error = 'no_profile' } end

    local postId = tonumber(data.postId) or 0
    if not MySQL.scalar.await('SELECT 1 FROM phone_prism_posts WHERE id = ?', { postId }) then
        return { ok = false, error = 'gone' }
    end
    local body = tostring(data.body or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, COMMENT_MAX)
    if body == '' then return { ok = false, error = 'empty' } end

    local id = MySQL.insert.await(
        'INSERT INTO phone_prism_comments (post_id, author_number, body) VALUES (?, ?, ?)',
        { postId, me, body })
    notifyAuthor(postId, me, ('@%s commented: %s'):format(profile.handle, body:sub(1, 80)))
    return { ok = true, data = { id = id, body = body, handle = profile.handle,
        display = profile.display, avatar = profile.avatar, mine = true, at = os.time() * 1000 } }
end)

PhoneCallback('cipher-phone:prism:delete', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local postId = tonumber(data and data.postId) or 0
    local deleted = MySQL.update.await(
        'DELETE FROM phone_prism_posts WHERE id = ? AND author_number = ?', { postId, me })
    if deleted and deleted > 0 then
        MySQL.update.await('DELETE FROM phone_prism_likes WHERE post_id = ?', { postId })
        MySQL.update.await('DELETE FROM phone_prism_comments WHERE post_id = ?', { postId })
    end
    return { ok = true }
end)

PhoneCallback('cipher-phone:prism:profile', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local handle = tostring(data and data.handle or ''):lower()
    local row = MySQL.single.await(
        'SELECT number, handle, display, bio, avatar_url AS avatar, verified FROM phone_social_profiles WHERE handle = ?',
        { handle })
    if not row then return { ok = false, error = 'gone' } end

    local following = MySQL.scalar.await(
        'SELECT 1 FROM phone_social_follows WHERE follower = ? AND followed = ?',
        { me, row.number }) ~= nil
    local followers = MySQL.scalar.await(
        'SELECT COUNT(*) FROM phone_social_follows WHERE followed = ?', { row.number }) or 0
    local followingCount = MySQL.scalar.await(
        'SELECT COUNT(*) FROM phone_social_follows WHERE follower = ?', { row.number }) or 0

    local posts = queryPosts(me, 'p.author_number = ?', { me, me, row.number }, 60)

    return { ok = true, data = {
        profile = {
            handle = row.handle, display = row.display, bio = row.bio,
            avatar = row.avatar, verified = row.verified == 1,
            isMe = row.number == me, following = following,
            followers = followers, followingCount = followingCount,
            posts = #posts,
        },
        posts = posts,
    } }
end)
