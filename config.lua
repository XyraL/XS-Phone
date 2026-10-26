Config = {}

Config.Debug = false

Config.Phone = {

    -- How players open the phone. The key is just a default, players can
    -- rebind it in their GTA keybinds.
    Command = 'phone',
    OpenKey = '`',

    -- Set enabled = false if you want everyone to have a phone without
    -- needing the item.
    Item = {
        enabled = true,
        name = 'phone',
    },

    -- Can players use the phone while dead?
    AllowWhenDead = false,

    Numbers = {
        -- 'own' = the phone generates its own unique numbers (recommended).
        -- 'framework' = use the number from charinfo instead. Only pick this
        -- if your server already shows those numbers everywhere.
        mode = 'own',
        format = '###-####',
        -- Price for "Get a New Number" in Settings. 0 = free.
        changeCost = 500,
    },

    -- How many days things stay in the database. 0 = keep forever.
    -- Old rows get cleaned up automatically so your DB doesn't grow forever.
    Retention = {
        messages = 30,
        calls = 30,
        mail = 30,
        transactions = 90,
        news = 30,
    },

    -- The Services app. Each entry is a job on your server, and only what you
    -- list here shows up. A business is OPEN while someone with that job is
    -- on duty, CLOSED when nobody is. Bosses can post an announcement from
    -- the app. emergency = true puts it in the big emergency buttons up top.
    -- number is the business line. Calls ring a random on-duty worker, and
    -- texts land in a shared inbox every on-duty worker sees in the app.
    -- Workers answer and reply AS that number, so nobody ever sees their own
    -- phone number. Leave number out to make a business unreachable.
    -- coords is where the GPS button sends people. Leave it out to hide it.
    Businesses = {
        { job = 'police',     label = 'LSPD',               category = 'Emergency',    emergency = true, number = '911', coords = vector3(428.0, -981.0, 30.7) },
        { job = 'ambulance',  label = 'Pillbox Medical',    category = 'Emergency',    emergency = true, number = '912', coords = vector3(298.0, -584.0, 43.3) },
        { job = 'mechanic',   label = 'Los Santos Customs', category = 'Vehicles',     number = '555-0100', coords = vector3(-337.0, -137.0, 39.0) },
        { job = 'taxi',       label = 'Downtown Cab Co.',   category = 'Transport',    number = '555-0200', coords = vector3(903.0, -170.0, 74.0) },
        { job = 'burgershot', label = 'Burger Shot',        category = 'Food & Drink', number = '555-0300', coords = vector3(-1183.0, -884.0, 13.8) },
        { job = 'cardealer',  label = 'PDM Dealership',     category = 'Vehicles',     number = '555-0400', coords = vector3(-56.0, -1097.0, 26.4) },
    },

    -- Name shown on the boot screen.
    Branding = {
        osName = 'XyraLOS',
    },

    -- Share your number with people standing near you. They only get your
    -- number if they accept.
    Drop = {
        enabled = true,
        range = 10.0,      -- meters
        offerTimeout = 30, -- seconds before the offer expires
    },

    Calls = {
        timeout = 25,            -- seconds of ringing before it counts as missed
        anonymousPrefix = '*67', -- dial this before a number to hide yours
        maxParticipants = 5,     -- most people on one group call, you included
    },

    -- Camera uploads. Make a free account at fivemanage.com, grab an image
    -- API token and paste it below. That's the whole setup.
    Media = {
        provider = 'fivemanage', -- 'fivemanage', 'fivemerr' or 'custom'
        apiKey = '',
        Providers = {
            fivemanage = {
                url = 'https://api.fivemanage.com/api/image',
                field = 'file',
                responsePath = 'url',
                authHeader = 'Authorization',
            },
            fivemerr = {
                url = 'https://api.fivemerr.com/v1/media/images',
                field = 'file',
                responsePath = 'url',
                authHeader = 'Authorization',
            },
            custom = {
                url = '',
                field = 'file',
                responsePath = 'url',
                authHeader = 'Authorization',
            },
        },
        -- Image links are only accepted from these hosts.
        allowedHosts = {
            'api.fivemanage.com', 'r2.fivemanage.com', 'fmfiles.com',
            'api.fivemerr.com', 'media.fivemerr.com',
        },
        -- Hosts players can import photos from (paste a link in Photos).
        -- Keep this list short. Random hosts let people IP-log your players.
        externalHosts = {
            'cdn.discordapp.com', 'media.discordapp.net', 'i.imgur.com',
        },
        maxPhotos = 200, -- per character
    },

    Wallet = {
        account = 'bank',
        maxTransfer = 50000,
    },

    -- Rename the branded apps if you want your own names.
    AppNames = {
        social = 'Chirp',
        darkchat = 'DarkChat',
        prism = 'Prism',
        match = 'Sparks',
        services = 'Services',
        news = 'Weazel News',
    },

    -- App Store. Everything in Available can be installed and removed per
    -- character. DefaultInstalled is what a fresh phone comes with.
    Store = {
        Available = {
            'social', 'prism', 'market', 'music', 'weather', 'news',
            'crypto', 'darkchat', 'match', 'game2048', 'snake',
        },
        DefaultInstalled = { 'social', 'prism', 'market', 'music', 'weather', 'news' },
    },

    -- The Garage app reads this table.
    -- player_vehicles is correct for stock qb-core and QBox.
    Garage = {
        enabled = true,
        table = 'player_vehicles',
        -- Which column says a car is parked. 'auto' uses in_garage when your table
        -- has it (jg-advancedgarages does), then stored, then state.
        -- Set 'state', 'in_garage' or 'stored' to force one.
        stateFrom = 'auto',
        -- Mark an out vehicle on the GPS.
        Ping = { enabled = true },
        -- Car pictures in the app. %s is the model name. Set '' to turn them off.
        images = 'https://docs.fivem.net/vehicles/%s.webp',
        -- Pay to get a garaged car delivered to you. With drive = true a valet
        -- drives it to you on the roads and waits at lights like everyone else.
        -- If they really get stuck or take longer than maxDrive seconds, they
        -- park where they are when you're close, or the car is put beside you.
        Valet = {
            enabled = true,
            cost = 250,
            account = 'bank',
            delay = 5,              -- seconds before the valet sets off
            drive = true,
            driver = 's_m_y_valet_01',
            speed = 18.0,           -- meters per second, about 40 mph
            drivingStyle = 786603,
            spawnDistance = 260.0,  -- how far away the valet starts
            maxDrive = 240,
        },
        -- Lock, unlock, honk, flash the lights and start the engine from the
        -- phone while the car is out. range = how close you need to be, 0 = anywhere.
        Remote = {
            enabled = true,
            range = 150.0,
        },
        -- Lend a key to a contact from the Garage app. It shows up in their
        -- Wallet and stops working when it runs out or you take it back.
        Keys = {
            enabled = true,
            maxPerCar = 5,
        },
    },

    Music = {
        maxTracks = 50,
    },

    Maps = {
        maxPlaces = 50, -- saved places per phone
        -- Pinned on everyone's map. Edit these to fit your server.
        -- icon: hospital, police, park, garage, airport, town, food, car, star, work, home, pin
        Places = {
            { label = 'Pillbox Medical',    icon = 'hospital', x = 298.0,   y = -584.0 },
            { label = 'Mission Row Police', icon = 'police',   x = 428.0,   y = -981.0 },
            { label = 'Legion Square',      icon = 'park',     x = 195.0,   y = -934.0 },
            { label = 'Los Santos Customs', icon = 'garage',   x = -337.0,  y = -137.0 },
            { label = 'LS International',   icon = 'airport',  x = -1037.0, y = -2737.0 },
            { label = 'Sandy Shores',       icon = 'town',     x = 1853.0,  y = 3686.0 },
            { label = 'Paleto Bay',         icon = 'town',     x = -448.0,  y = 6012.0 },
        },
    },

    Mail = {
        -- Everyone's address ends with this.
        domain = 'ls.mail',
        maxBody = 4000,
    },

    Market = {
        maxListings = 5, -- active listings per player
        expiryDays = 14,
    },

    -- Bills in the Wallet. Players see and pay what they owe. Works with the
    -- qb-phone style phone_invoices table (created if missing, so /fine and
    -- other billing scripts that write there just work), okokBilling and
    -- peleg-billing. Paid bills go to the job's society account.
    Bills = {
        enabled = true,
        account = 'bank',      -- what bills are paid from
        allowDecline = true,   -- lets players decline bills that allow it
        banking = 'auto',      -- society bank: 'auto', a resource name, or 'none'
        invoiceTable = true,   -- use (and create) the phone_invoices table
        okokTable = 'okokbilling',
        maxAmount = 100000,
        -- Bills from these jobs show as fines.
        fineJobs = { 'police', 'sheriff', 'bcso', 'sasp' },
        -- Jobs that can send bills from the Wallet while on duty. Leave it
        -- out to use every job in Businesses above.
        -- issuers = { 'police', 'ambulance', 'mechanic' },
    },

    -- The Home app shows up when one of these is running: qbx_properties,
    -- ps-housing, qb-houses or bcs_housing. Lock, share keys and see who
    -- rang the doorbell, as far as each housing script allows.
    Home = {
        housing = 'auto', -- or force one: 'qbx_properties', 'ps-housing', 'qb-houses', 'bcs_housing', 'none'
        maxKeys = 10,
    },

    -- The Crypto app. Prices are made up by the server and move on their own,
    -- pulled gently back toward each coin's starting price so they never
    -- run off to zero or the moon. Add, remove or rename coins freely.
    Crypto = {
        account = 'bank', -- money for trades comes from and goes back to this account
        fee = 0.01,       -- 1% on every buy and sell
        tick = 60,        -- seconds between price moves
        history = 1440,   -- price points kept per coin (1440 x 60s = one day)
        maxTrade = 1000000,
        Coins = {
            { id = 'xyr',  symbol = 'XYR',  name = 'XyraCoin',      price = 2400.0, volatility = 0.008, color = '#2ec8c8' },
            { id = 'vine', symbol = 'VINE', name = 'Vinewood Gold', price = 410.0,  volatility = 0.012, color = '#d9a441' },
            { id = 'sand', symbol = 'SAND', name = 'Sandcoin',      price = 38.0,   volatility = 0.018, color = '#c2703d' },
            { id = 'bean', symbol = 'BEAN', name = 'BeanCoin',      price = 1.85,   volatility = 0.03,  color = '#7d5bd6' },
        },
    },

    -- The News app. Everyone can read. Players with one of these jobs can
    -- publish, and that job's boss grade can take any story down.
    News = {
        jobs = { 'reporter', 'weazelnews' },
        categories = { 'City', 'Crime', 'Business', 'Sports', 'Weather', 'Entertainment' },
        breakingCooldown = 300, -- seconds between breaking alerts per reporter
    },

    -- What a brand new phone starts with. Players change these in Settings.
    DefaultSettings = {
        wallpaper = 'aurora',
        ringtone = 'horizon',
        texttone = 'pop',
        theme = 'dark',
        accent = 'blue',
        frame = 'midnight',
        homeLayout = '',
        photoShare = 'everyone',
        textScale = 'default',
        time24 = false,
        lockPreviews = true,
        dropEnabled = true,
        airplane = false,
        dnd = false,
        setupDone = false,
    },

    -- Anti-spam. How many times a player can do each thing per minute.
    RateLimits = {
        saveSettings = 60,
        contactsWrite = 30,
        sendMessage = 30,
        threadWrite = 10,
        dropSend = 10,
        callStart = 15,
        pinVerify = 10,
        pinSet = 5,
        photoSave = 20,
        walletTransfer = 10,
        notesWrite = 30,
        alarmsWrite = 20,
        socialPost = 10,
        socialWrite = 40,
        mailSend = 15,
        marketPost = 6,
        darkchatSend = 40,
        darkchatRoom = 6,
        prismPost = 10,
        prismWrite = 40,
        musicWrite = 20,
        matchSwipe = 60,
        matchWrite = 20,
        storeWrite = 20,
        galleryImport = 15,
        garagePing = 10,
        mapsWrite = 20,
        newsPost = 6,
        cryptoTrade = 20,
        billPay = 10,
        taxiCall = 6,
        billSend = 10,
        homeWrite = 20,
        garageRemote = 30,
        garageKeys = 10,
        profileWrite = 10,
        valet = 3,
        numberChange = 2,
        businessWrite = 10,
        accountAuth = 10,
    },
}
