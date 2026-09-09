local function fullAddress(local_)
    return local_ .. '@' .. Config.Phone.Mail.domain
end

local function cleanAddress(input)
    local s = tostring(input or ''):lower():gsub('%s', '')
    if not s:find('@') then s = fullAddress(s) end
    local local_, domain = s:match('^([a-z0-9_%.]+)@([a-z0-9_%.]+)$')
    if not local_ or #local_ < 3 or #local_ > 30 then return nil end
    return local_ .. '@' .. domain
end

function GetMailAccount(number)
    return MySQL.single.await(
        'SELECT address FROM phone_mail_accounts WHERE number = ?', { number })
end

local function deliver(owner, folder, fromAddr, toAddr, subject, body, image, read)
    return MySQL.insert.await([[
        INSERT INTO phone_emails (owner_address, folder, from_address, to_address, subject, body, image_url, is_read)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ]], { owner, folder, fromAddr, toAddr, subject, body, image, read and 1 or 0 })
end

local function notifyAddress(address, fromAddr, subject)
    local acct = MySQL.single.await(
        'SELECT number FROM phone_mail_accounts WHERE address = ?', { address })
    if not acct or not acct.number then return end
    local tgt = GetSourceByNumber(acct.number)
    if tgt then
        TriggerClientEvent('XS-Phone:client:pushNotify', tgt, {
            app = 'mail', title = fromAddr, body = subject,
        })
    end
end

PhoneCallback('XS-Phone:mail:me', function(src)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    AwaitDB()
    local acct = GetMailAccount(me)
    return { ok = true, data = acct and { address = acct.address, domain = Config.Phone.Mail.domain }
        or { address = nil, domain = Config.Phone.Mail.domain } }
end)

PhoneCallback('XS-Phone:mail:signup', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'accountAuth') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    if GetMailAccount(me) then return { ok = false, error = 'already' } end

    local local_ = tostring(data.username or ''):lower():gsub('%s', '')
    if #local_ < 3 or #local_ > 30 or not local_:match('^[a-z0-9_%.]+$') then
        return { ok = false, error = 'bad_username' }
    end
    local password = CleanPassword(data.password)
    if not password then return { ok = false, error = 'bad_password' } end

    local address = fullAddress(local_)
    local ok = pcall(MySQL.insert.await,
        'INSERT INTO phone_mail_accounts (address, password, number) VALUES (?, ?, ?)',
        { address, password, me })
    if not ok then return { ok = false, error = 'taken' } end

    deliver(address, 'inbox', 'welcome@' .. Config.Phone.Mail.domain, address,
        'Welcome to your inbox',
        'This is your new address:\n\n' .. address .. '\n\nAnyone in the city can write to you here.',
        nil, false)

    return { ok = true, data = { address = address } }
end)

PhoneCallback('XS-Phone:mail:login', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'accountAuth') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end

    local address = cleanAddress(data.username)
    if not address then return { ok = false, error = 'bad_login' } end

    local row = MySQL.single.await(
        'SELECT address, password FROM phone_mail_accounts WHERE address = ?', { address })
    if not row or row.password ~= tostring(data.password or '') then
        return { ok = false, error = 'bad_login' }
    end

    MySQL.update.await('UPDATE phone_mail_accounts SET number = NULL WHERE number = ?', { me })
    MySQL.update.await('UPDATE phone_mail_accounts SET number = ? WHERE address = ?', { me, address })
    return { ok = true, data = { address = address } }
end)

PhoneCallback('XS-Phone:mail:logout', function(src)
    if not RateOK(src, 'accountAuth') then return { ok = false, error = 'rate_limited' } end
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    MySQL.update.await('UPDATE phone_mail_accounts SET number = NULL WHERE number = ?', { me })
    return { ok = true }
end)

PhoneCallback('XS-Phone:mail:list', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local acct = GetMailAccount(me)
    if not acct then return { ok = false, error = 'no_account' } end

    local folder = (data and data.folder) == 'sent' and 'sent' or 'inbox'
    local rows = MySQL.query.await([[
        SELECT id, from_address AS fromAddress, to_address AS toAddress,
               subject, body, image_url AS image, is_read AS isRead,
               UNIX_TIMESTAMP(created_at) * 1000 AS at
        FROM phone_emails WHERE owner_address = ? AND folder = ?
        ORDER BY id DESC LIMIT 100
    ]], { acct.address, folder })
    for _, r in ipairs(rows) do r.isRead = DbBool(r.isRead) end
    return { ok = true, data = rows }
end)

PhoneCallback('XS-Phone:mail:send', function(src, data)
    if type(data) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    if not RateOK(src, 'mailSend') then return { ok = false, error = 'rate_limited' } end

    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local acct = GetMailAccount(me)
    if not acct then return { ok = false, error = 'no_account' } end

    local to = cleanAddress(data.to)
    if not to then return { ok = false, error = 'invalid_address' } end
    local exists = MySQL.scalar.await(
        'SELECT 1 FROM phone_mail_accounts WHERE address = ?', { to })
    if not exists then return { ok = false, error = 'invalid_address' } end

    local subject = tostring(data.subject or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, 80)
    local body = tostring(data.body or ''):sub(1, Config.Phone.Mail.maxBody)
    if subject == '' or body == '' then return { ok = false, error = 'empty' } end

    local image = nil
    if data.imageUrl ~= nil then
        image = tostring(data.imageUrl)
        if not OwnsPhoto(me, image) then return { ok = false, error = 'bad_media' } end
    end

    deliver(to, 'inbox', acct.address, to, subject, body, image, false)
    deliver(acct.address, 'sent', acct.address, to, subject, body, image, true)
    notifyAddress(to, acct.address, subject)
    return { ok = true }
end)

PhoneCallback('XS-Phone:mail:read', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local acct = GetMailAccount(me)
    if not acct then return { ok = false, error = 'no_account' } end
    MySQL.update.await(
        'UPDATE phone_emails SET is_read = 1 WHERE id = ? AND owner_address = ?',
        { tonumber(data and data.id) or 0, acct.address })
    return { ok = true }
end)

PhoneCallback('XS-Phone:mail:delete', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    local acct = GetMailAccount(me)
    if not acct then return { ok = false, error = 'no_account' } end
    MySQL.update.await(
        'DELETE FROM phone_emails WHERE id = ? AND owner_address = ?',
        { tonumber(data and data.id) or 0, acct.address })
    return { ok = true }
end)

exports('SendMail', function(number, mail)
    if type(mail) ~= 'table' then return false end
    AwaitDB()

    number = NormalizeNumber(tostring(number or '')) or number
    local acct = GetMailAccount(number)
    if not acct then return false end

    local fromAddr = tostring(mail.from or ('city@' .. Config.Phone.Mail.domain)):sub(1, 60)
    local subject = tostring(mail.subject or ''):sub(1, 80)
    local body = tostring(mail.body or ''):sub(1, Config.Phone.Mail.maxBody)
    if subject == '' or body == '' then return false end

    local image = nil
    if mail.image and IsAllowedMediaUrl(tostring(mail.image)) then
        image = tostring(mail.image)
    end

    deliver(acct.address, 'inbox', fromAddr, acct.address, subject, body, image, false)
    notifyAddress(acct.address, fromAddr, subject)
    return true
end)
