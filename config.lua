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
    },

    -- The City app. Each entry is a job on your server. A business shows
    -- OPEN when someone with that job is online and on duty. Bosses can set
    -- an announcement from the app. emergency = true puts it in the 911
    -- panel up top.
    -- number is the business line. Calling or texting it reaches a random
    -- on-duty worker's phone. Leave it out to make a business unreachable.
    Businesses = {
        { job = 'police',     label = 'LSPD',               category = 'Emergency', emergency = true, number = '911' },
        { job = 'ambulance',  label = 'Pillbox Medical',    category = 'Emergency', emergency = true, number = '912' },
        { job = 'mechanic',   label = 'Los Santos Customs', category = 'Vehicles',  number = '555-0100' },
        { job = 'taxi',       label = 'Downtown Cab Co.',   category = 'Transport', number = '555-0200' },
        { job = 'burgershot', label = 'Burger Shot',        category = 'Food & Drink', number = '555-0300' },
        { job = 'cardealer',  label = 'PDM Dealership',     category = 'Vehicles',  number = '555-0400' },
    },

    -- Name shown on the boot screen.
    Branding = {
        osName = 'CipherOS',
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
        services = 'City',
    },

    -- App Store. Everything in Available can be installed and removed per
    -- character. DefaultInstalled is what a fresh phone comes with.
    Store = {
        Available = {
            'social', 'prism', 'market', 'music', 'weather',
            'darkchat', 'match', 'game2048', 'snake',
        },
        DefaultInstalled = { 'social', 'prism', 'market', 'music', 'weather' },
    },

    -- The Garage app only reads this table, it never spawns anything.
    -- player_vehicles is correct for stock qb-core and QBox.
    Garage = {
        enabled = true,
        table = 'player_vehicles',
        -- Mark an out vehicle on the GPS.
        Ping = { enabled = true },
        -- Pay to get a garaged car delivered to you.
        Valet = {
            enabled = true,
            cost = 250,
            account = 'bank',
            delay = 12, -- seconds until the car shows up
        },
    },

    Music = {
        maxTracks = 50,
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

    -- What a brand new phone starts with. Players change these in Settings.
    DefaultSettings = {
        wallpaper = 'aurora',
        ringtone = 'horizon',
        texttone = 'pop',
        theme = 'dark',
        accent = 'blue',
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
        valet = 3,
        numberChange = 2,
        businessWrite = 10,
        accountAuth = 10,
    },
}
