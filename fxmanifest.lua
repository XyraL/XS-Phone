fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'cipher-phone'
author 'XyraL'
description 'Cipher — Phone. iPhone-style smartphone for QBox/QBCore.'
version '1.0.0'

dependencies {
    'ox_lib',
    'oxmysql',
}

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua',
    'shared/utils.lua',
}

client_scripts {
    'bridge/framework.lua',
    'client/main.lua',
    'client/drop.lua',
    'client/calls.lua',
    'client/camera.lua',
    'client/nui.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'bridge/framework.lua',
    'server/db.lua',
    'server/retention.lua',
    'server/main.lua',
    'server/apps/contacts.lua',
    'server/apps/gallery.lua',
    'server/apps/messages.lua',
    'server/apps/drop.lua',
    'server/apps/calls.lua',
    'server/apps/wallet.lua',
    'server/apps/notes.lua',
    'server/apps/clock.lua',
    'server/apps/social.lua',
    'server/apps/mail.lua',
    'server/apps/market.lua',
    'server/apps/services.lua',
    'server/apps/darkchat.lua',
    'server/apps/prism.lua',
    'server/apps/garage.lua',
    'server/apps/music.lua',
    'server/apps/match.lua',
}

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/css/*.css',
    'html/js/os/*.js',
    'html/js/apps/*.js',
}
