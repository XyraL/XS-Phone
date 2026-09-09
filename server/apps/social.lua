local BODY_MAX = 280
local HANDLE_PATTERN = '^[a-z0-9_]+$'

function CleanPassword(input)
    local pw = tostring(input or '')
    if #pw < 4 or #pw > 32 then return nil end
    return pw
end

function RebindSocial(old, new)
    for _, m in ipairs({
        { 'phone_social_profiles', 'number' },
        { 'phone_social_posts', 'author_number' },
        { 'phone_social_likes', 'number' },
        { 'phone_social_follows', 'follower' },
        { 'phone_social_follows', 'followed' },
        { 'phone_prism_posts', 'author_number' },
        { 'phone_prism_likes', 'number' },
        { 'phone_prism_comments', 'author_number' },
    }) do
        pcall(MySQL.update.await,
            ('UPDATE `%s` SET `%s` = ? WHERE `%s` = ?'):format(m[1], m[2], m[2]),
            { new, old })
    end
end

local function myProfile(number)
    return MySQL.single.await(
        'SELECT number, handle, display, bio, avatar_url AS avatar, banner_url AS banner, verified FROM phone_social_profiles WHERE number = ?',
        { number })
end

local function publicProfile(row)
    if not row then return nil end
    return {
        handle = row.handle, display = row.display, bio = row.bio,
        avatar = row.avatar, banner = row.banner, verified = DbBool(row.verified),
    }
end

local function queryPosts(me, extraWhere, params, limit)
    local sql = ([[
        SELECT p.id, p.body, p.image_url AS image, p.reply_to AS replyTo,
               UNIX_TIMESTAMP(p.created_at) * 1000 AS at,
               pr.handle, pr.display, pr.avatar_url AS avatar, pr.verified,
               (p.author_number = ?) AS mine,
               (SELECT COUNT(*) FROM phone_social_likes l WHERE l.post_id = p.id) AS likes,
               EXISTS(SELECT 1 FROM phone_social_likes l WHERE l.post_id = p.id AND l.number = ?) AS liked,
               (SELECT COUNT(*) FROM phone_social_posts r WHERE r.reply_to = p.id) AS replies
        FROM phone_social_posts p
        JOIN phone_social_profiles pr ON pr.number = p.author_number
        WHERE %s
        ORDER BY p.id DESC LIMIT %d
    ]]):format(extraWhere, limit or 30)

    local rows = MySQL.query.await(sql, params)
    for _, r in ipairs(rows) do
        r.mine = r.mine == 1
        r.liked = r.liked == 1
        r.verified = DbBool(r.verified)
    end
    return rows
end

local function notifyAuthor(postId, exceptNumber, title, body)
    local author = MySQL.scalar.await(
        'SELECT author_number FROM phone_social_posts WHERE id = ?', { postId })
    if not author or author == exceptNumber then return end
    local tgt = GetSourceByNumber(author)
    if tgt then
        TriggerClientEvent('XS-Phone:client:pushNotify', tgt, {
            app = 'social', title = title, body = body,
        })
    end
end

PhoneCallback('XS-Phone:social:me', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    return { ok = true, data = publicProfile(myProfile(me)) }
end)

PhoneCallback('XS-Phone:social:createProfile', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'socialWrite') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    if myProfile(me) then return { ok = false, error = 'exists' } end

    local handle = tostring(data.handle or ''):lower()
    if #handle < 3 or #handle > 15 or not handle:match(HANDLE_PATTERN) then
        return { ok = false, error = 'bad_handle' }
    end
    local password = CleanPassword(data.password)
    if not password then return { ok = false, error = 'bad_password' } end
    local display = tostring(data.display or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, 30)
    if display == '' then display = handle end
    local bio = tostring(data.bio or ''):sub(1, 160)

    local ok = pcall(MySQL.insert.await,
        'INSERT INTO phone_social_profiles (number, handle, display, bio, password) VALUES (?, ?, ?, ?, ?)',
        { me, handle, display, bio, password })
    if not ok then return { ok = false, error = 'taken' } end

    return { ok = true, data = { handle = handle, display = display, bio = bio, verified = false } }
end)

PhoneCallback('XS-Phone:social:login', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'accountAuth') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local handle = tostring(data.handle or ''):lower()
    local row = MySQL.single.await(
        'SELECT number, password FROM phone_social_profiles WHERE handle = ?', { handle })
    if not row or not row.password or row.password ~= tostring(data.password or '') then
        return { ok = false, error = 'bad_login' }
    end
    if row.number == me then return { ok = true, data = publicProfile(myProfile(me)) } end

    local current = myProfile(me)
    if current then RebindSocial(me, 'x:' .. current.handle) end
    RebindSocial(row.number, me)

    return { ok = true, data = publicProfile(myProfile(me)) }
end)

PhoneCallback('XS-Phone:social:logout', function(src)
    if not RateOK(src, 'accountAuth') then return { ok = false, error = 'rate_limited' } end
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local current = myProfile(me)
    if current then RebindSocial(me, 'x:' .. current.handle) end
    return { ok = true }
end)

PhoneCallback('XS-Phone:social:updateProfile', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'socialWrite') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me or not myProfile(me) then return { ok = false, error = 'no_profile' } end

    local display = tostring(data.display or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, 30)
    local bio = tostring(data.bio or ''):sub(1, 160)

    local function cleanImage(url)
        if url == nil or url == '' then return nil, true end
        url = tostring(url)
        if not OwnsPhoto(me, url) then return nil, false end
        return url, true
    end

    local avatar, avatarOk = cleanImage(data.avatarUrl)
    if not avatarOk then return { ok = false, error = 'bad_media' } end
    local banner, bannerOk = cleanImage(data.bannerUrl)
    if not bannerOk then return { ok = false, error = 'bad_media' } end

    MySQL.update.await(
        'UPDATE phone_social_profiles SET display = ?, bio = ?, avatar_url = ?, banner_url = ? WHERE number = ?',
        { display, bio, avatar, banner, me })
    return { ok = true }
end)

PhoneCallback('XS-Phone:social:feed', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local before = tonumber(data and data.before)
    local scope = data and data.scope or 'global'

    if scope == 'following' then
        return { ok = true, data = queryPosts(me, [[
            p.reply_to IS NULL
            AND (p.author_number = ? OR p.author_number IN
                (SELECT followed FROM phone_social_follows WHERE follower = ?))
            AND (? IS NULL OR p.id < ?)
        ]], { me, me, me, me, before, before }) }
    end
    return { ok = true, data = queryPosts(me,
        'p.reply_to IS NULL AND (? IS NULL OR p.id < ?)',
        { me, me, before, before }) }
end)

PhoneCallback('XS-Phone:social:post', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'socialPost') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local profile = myProfile(me)
    if not profile then return { ok = false, error = 'no_profile' } end

    local body = tostring(data.body or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, BODY_MAX)
    local image = nil
    if data.imageUrl ~= nil then
        image = tostring(data.imageUrl)
        if not OwnsPhoto(me, image) then return { ok = false, error = 'bad_media' } end
    end
    if body == '' and not image then return { ok = false, error = 'empty' } end

    local replyTo = tonumber(data.replyTo)
    if replyTo then
        local parent = MySQL.scalar.await(
            'SELECT 1 FROM phone_social_posts WHERE id = ?', { replyTo })
        if not parent then return { ok = false, error = 'gone' } end
    end

    local id = MySQL.insert.await(
        'INSERT INTO phone_social_posts (author_number, body, image_url, reply_to) VALUES (?, ?, ?, ?)',
        { me, body, image, replyTo })

    if replyTo then
        notifyAuthor(replyTo, me, Config.Phone.AppNames.social,
            ('@%s replied: %s'):format(profile.handle, body:sub(1, 80)))
    end

    return { ok = true, data = { id = id } }
end)

PhoneCallback('XS-Phone:social:like', function(src, data)
    if not RateOK(src, 'socialWrite') then return { ok = false, error = 'rate_limited' } end
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local profile = myProfile(me)
    if not profile then return { ok = false, error = 'no_profile' } end

    local postId = tonumber(data and data.postId) or 0
    local existing = MySQL.scalar.await(
        'SELECT 1 FROM phone_social_likes WHERE post_id = ? AND number = ?', { postId, me })
    if existing then
        MySQL.update.await(
            'DELETE FROM phone_social_likes WHERE post_id = ? AND number = ?', { postId, me })
        return { ok = true, liked = false }
    end

    local exists = MySQL.scalar.await('SELECT 1 FROM phone_social_posts WHERE id = ?', { postId })
    if not exists then return { ok = false, error = 'gone' } end

    MySQL.insert.await(
        'INSERT INTO phone_social_likes (post_id, number) VALUES (?, ?)', { postId, me })
    notifyAuthor(postId, me, Config.Phone.AppNames.social,
        ('@%s liked your post'):format(profile.handle))
    return { ok = true, liked = true }
end)

PhoneCallback('XS-Phone:social:delete', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local postId = tonumber(data and data.postId) or 0
    MySQL.update.await(
        'DELETE FROM phone_social_posts WHERE id = ? AND author_number = ?', { postId, me })
    MySQL.update.await('DELETE FROM phone_social_likes WHERE post_id = ?', { postId })
    return { ok = true }
end)

PhoneCallback('XS-Phone:social:thread', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local postId = tonumber(data and data.postId) or 0

    local root = queryPosts(me, 'p.id = ?', { me, me, postId }, 1)[1]
    if not root then return { ok = false, error = 'gone' } end
    local replies = queryPosts(me, 'p.reply_to = ?', { me, me, postId }, 100)
    local flipped = {}
    for i = #replies, 1, -1 do flipped[#flipped + 1] = replies[i] end

    return { ok = true, data = { post = root, replies = flipped } }
end)

PhoneCallback('XS-Phone:social:profile', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local handle = tostring(data and data.handle or ''):lower()
    local row = MySQL.single.await(
        'SELECT number, handle, display, bio, avatar_url AS avatar, banner_url AS banner, verified FROM phone_social_profiles WHERE handle = ?',
        { handle })
    if not row then return { ok = false, error = 'gone' } end

    local following = MySQL.scalar.await(
        'SELECT 1 FROM phone_social_follows WHERE follower = ? AND followed = ?',
        { me, row.number }) ~= nil
    local followers = MySQL.scalar.await(
        'SELECT COUNT(*) FROM phone_social_follows WHERE followed = ?', { row.number }) or 0
    local followingCount = MySQL.scalar.await(
        'SELECT COUNT(*) FROM phone_social_follows WHERE follower = ?', { row.number }) or 0
    local postCount = MySQL.scalar.await(
        'SELECT COUNT(*) FROM phone_social_posts WHERE author_number = ? AND reply_to IS NULL',
        { row.number }) or 0

    local posts = queryPosts(me, 'p.author_number = ? AND p.reply_to IS NULL',
        { me, me, row.number }, 30)

    local profile = publicProfile(row)
    profile.isMe = row.number == me
    profile.following = following
    profile.followers = followers
    profile.followingCount = followingCount
    profile.posts = postCount

    return { ok = true, data = { profile = profile, posts = posts } }
end)

PhoneCallback('XS-Phone:social:follow', function(src, data)
    if not RateOK(src, 'socialWrite') then return { ok = false, error = 'rate_limited' } end
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local profile = myProfile(me)
    if not profile then return { ok = false, error = 'no_profile' } end

    local handle = tostring(data and data.handle or ''):lower()
    local target = MySQL.scalar.await(
        'SELECT number FROM phone_social_profiles WHERE handle = ?', { handle })
    if not target or target == me then return { ok = false, error = 'gone' } end

    local existing = MySQL.scalar.await(
        'SELECT 1 FROM phone_social_follows WHERE follower = ? AND followed = ?', { me, target })
    if existing then
        MySQL.update.await(
            'DELETE FROM phone_social_follows WHERE follower = ? AND followed = ?', { me, target })
        return { ok = true, following = false }
    end

    MySQL.insert.await(
        'INSERT INTO phone_social_follows (follower, followed) VALUES (?, ?)', { me, target })
    local tgt = GetSourceByNumber(target)
    if tgt then
        TriggerClientEvent('XS-Phone:client:pushNotify', tgt, {
            app = 'social', title = Config.Phone.AppNames.social,
            body = ('@%s followed you'):format(profile.handle),
        })
    end
    return { ok = true, following = true }
end)
