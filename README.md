<h1 align="center">XS-Phone</h1>

<p align="center">A smartphone for <strong>QBox</strong> and <strong>QBCore</strong>. Calls, texts, maps, social media, two dozen apps, one resource.</p>

<p align="center">
  <a href="https://github.com/XyraL/XS-Phone/releases"><img src="https://img.shields.io/github/v/release/XyraL/XS-Phone?style=flat-square&color=f5bb55&label=release" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/framework-QBox%20%7C%20QBCore-55dcff?style=flat-square" alt="framework">
  <img src="https://img.shields.io/badge/price-free-30d158?style=flat-square" alt="price">
  <a href="https://xyralscripts.dev/docs-xs-phone"><img src="https://img.shields.io/badge/docs-xyralscripts.dev-a889ff?style=flat-square" alt="docs"></a>
  <a href="https://discord.gg/XRURAw4TM2"><img src="https://img.shields.io/badge/support-discord-5865F2?style=flat-square" alt="support"></a>
</p>

<p align="center">
  <a href="https://xyralscripts.dev/xs-phone">Website</a> &nbsp;·&nbsp;
  <a href="https://xyralscripts.dev/docs-xs-phone">Setup guide</a> &nbsp;·&nbsp;
  <a href="https://github.com/XyraL/XS-Phone/releases">Releases</a> &nbsp;·&nbsp;
  <a href="https://discord.gg/XRURAw4TM2">Discord</a>
</p>

<!-- SCREENSHOTS: drop 2-3 in-game shots here once captured -->

---

## What's in it

| | |
|---|---|
| Phone | Real voice calls through pma-voice. Add people mid-call for group calls, recents, favorites, *67 to hide your number, mute button. 911 and 912 ring on-duty police and EMS |
| Messages | Texts, group chats, photos, share your location, unread badges |
| Maps | The whole map with you on it. Save places, see places around the city, drop a pin anywhere, set your GPS, share a spot with a contact |
| Contacts | Photos, favorites, blocking, and Drop (share your number with someone standing next to you). Set your own photo that shows when you call or text, for everyone or only your contacts |
| Camera & Photos | The real GTA phone camera — the screen becomes the viewfinder, aim with your mouse, flip to the front cam for selfies just like Snapmatic. Zoom, grid, tap to focus. Import from Discord or Imgur links, set as wallpaper |
| Chirp | Twitter. Posts, likes, replies, follows, banners, verified badges |
| Prism | Instagram. Photo posts, double-tap to like, comments, profile grids. Same account as Chirp |
| Sparks | Tinder. Swipe cards, super likes, rewind, matches, it even says "It's a Match!" |
| Mail | Real email. Players sign up for their own name@ls.mail address, with inbox and sent folders |
| Wallet | Send money by phone number, pay or decline your bills and fines, send bills while on duty, see your history. Car Keys for your cars and the keys friends lend you |
| Home | Your houses and the ones you have keys to. Lock and unlock, give and take keys, see who rang the doorbell |
| Weazel News | Reporters publish stories with photos, everyone reads them, breaking news alerts every phone in the city |
| Crypto | Coins with prices that move every minute. Charts, buy, sell, send to another number |
| Marketplace | Player classifieds with photos |
| Services | Every business you list, open or closed from who's on duty, with call, text and a GPS button. Boss announcements. On-duty workers answer their business line in a shared inbox |
| DarkChat | Anonymous chat rooms behind invite codes. No names anywhere |
| Garage | Your cars with pictures, sorted into out, garaged and impounded. Find, lock, unlock, honk, flash and start them from the phone. Order a valet who drives the car to you, and lend a key to a friend for a set time |
| Music | Playlists through xsound |
| App Store | Optional apps install per character, including two games |
| Plus | Notes, Clock with working alarms, Calculator, Weather, full Settings with nine phone colours and your own photo as wallpaper |

It looks and feels like the newest iPhone: glass dock, widgets and buttons,
detailed app icons, a thin Pro frame with the Action and Camera Control buttons,
and the Inter font so text looks right on every PC. Swipe between home screen
pages, hold an app to move or remove it, and flick through the Smart Stack
widget. The lock screen has widgets under the clock, a torch button, and Live
Activities for calls, music and the valet. Apps open out of their icon and you
swipe from the left edge to go back. The island comes alive during a call, while
music plays or while the valet is on the way, swipe down from the right for the
control centre, swipe down on the home screen to search, and swipe up to go home.

Chirp, Prism, Sparks and Mail are real accounts — username and password. Log
in from any phone and your whole profile follows you. Log out and hand your
burner account to someone else if that's your thing.

Business numbers are real lines. Calling 911, 912 or any business in your
config rings a random on-duty worker, and the caller only ever sees 911 or the
business name, never the worker's own number. Texts land in a shared inbox in
the Services app that everyone on duty sees, and they reply as the line. None
of it touches their personal messages or recents.

The first time a player opens the phone they get a proper setup: pick a look,
pick a wallpaper, set a passcode. Ringtones and text tones are generated in
code, so there are no sound files to download and nothing to license. Close
the phone mid-anything and it reopens right where you left it.

## Requirements

- ox_lib
- oxmysql
- qbx_core **or** qb-core (it detects which one you run)
- pma-voice for call audio
- screenshot-basic for the camera
- xsound if you want the Music app (everything else works without it)
- ox_inventory is supported but not required

## Install

1. Drop the folder into `resources`.
2. No SQL import needed. Tables create themselves on first start. The file in
   `sql/` is only there if you want to run it yourself.
3. Add `ensure XS-Phone` to your server.cfg, after ox_lib, oxmysql, your
   framework and pma-voice.
4. Both frameworks already ship a `phone` item, and the phone uses it as is —
   most servers can skip this step. Only add the item if your server doesn't
   have one (or skip items entirely with `Item.enabled = false`):

   ox_inventory, in `data/items.lua`:
   ```lua
   ['phone'] = {
       label = 'Phone',
       weight = 190,
       stack = false,
       consume = 0,
       client = { event = 'XS-Phone:client:use' },
   },
   ```

   On ox_inventory that `client.event` line is what opens the phone — it does
   not use the framework's useable-item system, so without it the item sits
   there and nothing happens. If you kept your server's existing `phone` item,
   add the line to that definition. The open key and `/phone` work either way.

   qb-core, in `shared/items.lua`:
   ```lua
   phone = { name = 'phone', label = 'Phone', weight = 190, type = 'item', image = 'phone.png', unique = true, useable = true, shouldClose = true, description = 'A smartphone' },
   ```

   A `phone.png` ships in `inventory_images/` if you want it — most servers
   already have one they like, so this is optional. It goes in
   `ox_inventory/web/images/`, `qb-inventory/html/images/`,
   `ps-inventory/html/images/`, `qs-inventory/html/images/`,
   `codem-inventory/html/itemimages/` or `core_inventory/html/img/`, depending
   on what you run.
5. Set up the camera. Make a free account at [fivemanage.com](https://fivemanage.com),
   copy an image API token, paste it into `Config.Phone.Media.apiKey`. Done.
6. Go through `config.lua`. The big ones: your businesses list for the
   Services app, app names if you want to rename Chirp and friends, and the open
   key.

## Works with what you already run

- **Banking**: the Wallet uses framework money, so qb-banking, Renewed-Banking,
  okokBanking and anything similar all work. Nothing to configure.
- **911 and business lines**: no dispatch script needed. Calls and texts to a
  business number go straight to an on-duty worker's phone.
- **Garages**: reads `player_vehicles` (stock on both frameworks), and it
  handles builds that store the model as a hash instead of a name. Works with
  qb-garages, Qbox and jg-advancedgarages. Different table? Change one line in
  the config.
- **Vehicle keys**: the valet and shared keys work with qbx_vehiclekeys,
  qb-vehiclekeys, Renewed-Vehiclekeys, wasabi_carlock, mk_vehiclekeys,
  jaksam's vehicles_keys and cd_garage. Locking from the phone goes through
  qbx_vehiclekeys or Renewed-Vehiclekeys when you run them.
- **Car pictures**: the Garage shows each car using FiveM's own vehicle
  pictures. Add-on cars without one get a drawing instead, or set
  `Config.Phone.Garage.images = ''` to turn pictures off.
- **Housing**: the Home app shows up on its own when qbx_properties,
  ps-housing, qb-houses or bcs_housing is running. What it can do depends on
  the script: qb-houses and bcs_housing lock from the phone, ps-housing locks
  MLO houses through ox_doorlock, qbx_properties has no locks of its own.
  Keys and the doorbell work on all of them (bcs_housing keys stay in its own
  menu).
- **Taxis**: with XS-TaxiJob running, the Services app gets a Call a cab
  card. It shows how many cabs are free, then who took your call and their
  plate.
- **Bills and fines**: reads the `phone_invoices` table that qb-phone used
  (it creates it if you don't have one, so `/fine` and other billing scripts
  that write there just work), plus okokBilling and peleg-billing. Paid bills go
  into the job's account on Renewed-Banking, qb-banking, okokBanking,
  tgg-banking, wasabi_banking, fd_banking or the old qb-management.

## Exports

```lua
-- server
exports['XS-Phone']:GetNumber(source)
exports['XS-Phone']:Notify(source, { app = 'mail', title = '...', body = '...' })
exports['XS-Phone']:SendMessage('BANK', number, 'You were paid $2,500.')
exports['XS-Phone']:SendMail(number, { from = 'cityhall@ls.mail', subject = '...', body = '...' })
exports['XS-Phone']:CreateBill(source or citizenid, amount, 'mechanic', 'Engine rebuild')
-- CreateBill puts a bill in their Wallet. Paying it sends the money to that job.
-- SendMail delivers to whatever mail account is logged in on that player's
-- phone. No account, no delivery — it returns false.

-- client
exports['XS-Phone']:IsPhoneOpen()
```

## If something's not working

- **Photos won't save**: your fivemanage API key is missing or wrong. The
  server console prints the actual reason.
- **Calls connect but no audio**: pma-voice is missing or outdated.
- **"You don't have a phone"**: the item isn't in your inventory config, or
  the name doesn't match `Config.Phone.Item.name`.
- **Garage app is empty**: your server uses a different vehicles table. Point
  `Config.Phone.Garage.table` at it.
- **Cars show as out when they're parked**: set `Config.Phone.Garage.stateFrom`
  to the column your garage script uses.
- **Music won't play**: xsound isn't installed.
- **No Home app**: none of the supported housing scripts is running. Set
  `Config.Phone.Home.housing` if yours has a different resource name.
- **News or Crypto missing**: they're in the App Store. New phones come with
  News already installed.
- **Nobody can write news**: add your reporter job to `Config.Phone.News.jobs`.

## My other scripts

| Script | What it is |
|---|---|
| [XS-MultiCharacter](https://github.com/XyraL/XS-MultiCharacter) | Character select and spawn |
| [XS-MDT](https://github.com/XyraL/XS-MDT) | Police, EMS and fire MDT with live CAD |
| [XS-Dispatch](https://github.com/XyraL/XS-Dispatch) | Live dispatch for police, EMS and fire |
| [XS-AdminMenu](https://github.com/XyraL/XS-AdminMenu) | Admin panel and moderation |
| [XS-Mechanic](https://github.com/XyraL/XS-Mechanic) | Mechanic shops you build in game |
| [XS-Dealerships](https://github.com/XyraL/XS-Dealerships) | Car dealerships you build in game |
| [XS-DoorLock](https://github.com/XyraL/XS-DoorLock) | Door locks you set up in game |
| [XS-CriminalTablet](https://github.com/XyraL/XS-CriminalTablet) | Gang tablet with turf, wars and raids |
| [XS-Boosting](https://github.com/XyraL/XS-Boosting) | Vehicle boosting |
| [XS-Robberies](https://github.com/XyraL/XS-Robberies) | Robbery creator |
| [XS-Trucking](https://github.com/XyraL/XS-Trucking) | Trucking career |
| [XS-TaxiJob](https://github.com/XyraL/XS-TaxiJob) | Taxi job |
| [XS-AirDrops](https://github.com/XyraL/XS-AirDrops) | Contested supply drops |
| [XS-Drone](https://github.com/XyraL/XS-Drone) | Police drone |
| [XS-LoadingScreen](https://github.com/XyraL/XS-LoadingScreen) | Loading screen |

## License

Free to use on any server you own or run, commercial or not. Modify it for
your own server. No redistribution, no reselling. Full terms in
[LICENSE](LICENSE).
