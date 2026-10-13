local MAX_LOOKUP = 60

local function shareMode(raw)
    local ok, s = pcall(json.decode, raw or '')
    if ok and type(s) == 'table' and s.photoShare == 'contacts' then return 'contacts' end
    return 'everyone'
end

function PhotosFor(viewer, numbers)
    local out = {}
    local list, seen = {}, {}
    for _, n in ipairs(numbers or {}) do
        n = tostring(n or '')
        if #list >= MAX_LOOKUP then break end
        if n ~= '' and n ~= viewer and not seen[n] then
            seen[n] = true
            list[#list + 1] = n
        end
    end
    if #list == 0 then return out end

    local marks = {}
    for i = 1, #list do marks[i] = '?' end
    local rows = MySQL.query.await(
        ('SELECT number, photo, settings FROM phone_phones WHERE photo IS NOT NULL AND number IN (%s)')
            :format(table.concat(marks, ',')), list) or {}

    local guarded, photoOf = {}, {}
    for _, r in ipairs(rows) do
        if shareMode(r.settings) == 'contacts' then
            guarded[#guarded + 1] = r.number
            photoOf[r.number] = r.photo
        else
            out[r.number] = r.photo
        end
    end

    if #guarded > 0 and viewer then
        local m2, args = {}, { viewer }
        for i, n in ipairs(guarded) do
            m2[i] = '?'
            args[#args + 1] = n
        end
        local saved = MySQL.query.await(
            ('SELECT owner_number FROM phone_contacts WHERE saved_number = ? AND owner_number IN (%s)')
                :format(table.concat(m2, ',')), args) or {}
        for _, s in ipairs(saved) do out[s.owner_number] = photoOf[s.owner_number] end
    end
    return out
end

PhoneCallback('XS-Phone:profile:photos', function(src, data)
    local me = GetPhoneNumber(src)
    if not me then return { ok = false, error = 'no_phone' } end
    if type(data) ~= 'table' or type(data.numbers) ~= 'table' then return { ok = false, error = 'bad_payload' } end
    return { ok = true, data = PhotosFor(me, data.numbers) }
end)

PhoneCallback('XS-Phone:profile:setPhoto', function(src, data)
    if not RateOK(src, 'profileWrite') then return { ok = false, error = 'rate_limited' } end
    local entry = EnsurePhone(src)
    if not entry then return { ok = false, error = 'no_phone' } end

    local url = type(data) == 'table' and data.url or nil
    if url ~= nil and url ~= '' then
        url = tostring(url)
        if #url > 255 or not OwnsPhoto(entry.number, url) then return { ok = false, error = 'bad_media' } end
    else
        url = nil
    end

    MySQL.update.await('UPDATE phone_phones SET photo = ? WHERE number = ?', { url, entry.number })
    entry.photo = url
    return { ok = true, data = { photo = url } }
end)
