local capturing = false
local camActive = false
PhoneCameraActive = false

local function providerConfig()
    local media = Config.Phone.Media
    local cfg = media.Providers[media.provider] or media.Providers.custom
    if media.provider == 'custom' then cfg = media.Providers.custom end
    return cfg, media.apiKey
end

local function digPath(tbl, path)
    local value = tbl
    for key in tostring(path):gmatch('[^%.]+') do
        if type(value) ~= 'table' then return nil end
        value = value[tonumber(key) or key]
    end
    return type(value) == 'string' and value or nil
end

local function setFrontCam(on)
    Citizen.InvokeNative(0x2491A93618B7D838, on)
end

local function startPhoneCam()
    if camActive then return end
    camActive = true
    PhoneCameraActive = true
    PhoneCameraStance(true)
    CreateMobilePhone(1)
    CellCamActivate(true, true)
    setFrontCam(false)
end

function StopPhoneCamera()
    if not camActive then return end
    camActive = false
    PhoneCameraActive = false
    DestroyMobilePhone()
    CellCamActivate(false, false)
    PhoneCameraStance(false)
end

RegisterNUICallback('cameraMode', function(data, cb)
    if data and data.active == true and IsPhoneOpen() then
        startPhoneCam()
    else
        StopPhoneCamera()
    end
    cb({ ok = true })
end)

RegisterNUICallback('cameraFlip', function(data, cb)
    if camActive then
        setFrontCam(data and data.selfie == true)
    end
    cb({ ok = true })
end)

RegisterNUICallback('cameraCapture', function(_, cb)
    if capturing then cb({ ok = false, error = 'busy' }) return end
    if GetResourceState('screenshot-basic') ~= 'started' then
        cb({ ok = false, error = 'no_screenshot_basic' })
        return
    end

    local cfg, apiKey = providerConfig()
    if not cfg or cfg.url == '' then
        cb({ ok = false, error = 'not_configured' })
        return
    end
    if apiKey == '' and Config.Phone.Media.provider ~= 'custom' then
        print('^1[XS-Phone]^0 Config.Phone.Media.apiKey is empty — add your fivemanage API key')
        cb({ ok = false, error = 'not_configured' })
        return
    end

    capturing = true
    SendNUIMessage({ action = 'phone:capturing', data = true })
    Wait(200)

    local function finish(payload)
        if not capturing then return end
        capturing = false
        SendNUIMessage({ action = 'phone:capturing', data = false })
        cb(payload)
    end

    local okShot = pcall(function()
        exports['screenshot-basic']:requestScreenshot({ encoding = 'jpg', quality = 0.9 }, function(data)
            if type(data) == 'string' and data:sub(1, 5) == 'data:' then
                finish({ ok = true, image = data, upload = {
                    url = cfg.url,
                    field = cfg.field or 'file',
                    header = cfg.authHeader or 'Authorization',
                    key = apiKey,
                    path = cfg.responsePath or 'url',
                } })
            else
                finish({ ok = false, error = 'upload_failed' })
            end
        end)
    end)

    if not okShot then
        exports['screenshot-basic']:requestScreenshotUpload(cfg.url, cfg.field or 'file', {
            encoding = 'jpg',
            headers = apiKey ~= '' and { [cfg.authHeader or 'Authorization'] = apiKey } or nil,
        }, function(data)
            local okDecode, resp = pcall(json.decode, data or '')
            local url = okDecode and digPath(resp, cfg.responsePath or 'url') or nil
            if url then
                finish({ ok = true, url = url })
            else
                print('^1[XS-Phone]^0 upload failed — provider answered: ' .. tostring(data):sub(1, 200))
                finish({ ok = false, error = 'upload_failed' })
            end
        end)
    end

    SetTimeout(15000, function()
        finish({ ok = false, error = 'timeout' })
    end)
end)
