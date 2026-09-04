<h1 align="center">Cipher Phone</h1>

<p align="center">A smartphone for <strong>QBox</strong> and <strong>QBCore</strong>. Calls, texts, social media, 20 apps, one resource.</p>

<p align="center">
  <a href="https://github.com/XyraL/cipher-phone/releases"><img src="https://img.shields.io/github/v/release/XyraL/cipher-phone?style=flat-square&color=f5bb55&label=release" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/framework-QBox%20%7C%20QBCore-55dcff?style=flat-square" alt="framework">
  <img src="https://img.shields.io/badge/price-free-30d158?style=flat-square" alt="price">
  <a href="https://xyralscripts.dev/docs-cipher-phone"><img src="https://img.shields.io/badge/docs-xyralscripts.dev-a889ff?style=flat-square" alt="docs"></a>
  <a href="https://discord.gg/XRURAw4TM2"><img src="https://img.shields.io/badge/support-discord-5865F2?style=flat-square" alt="support"></a>
</p>

<p align="center">
  <a href="https://xyralscripts.dev/cipher-phone">Website</a> &nbsp;·&nbsp;
  <a href="https://xyralscripts.dev/docs-cipher-phone">Setup guide</a> &nbsp;·&nbsp;
  <a href="https://github.com/XyraL/cipher-phone/releases">Releases</a> &nbsp;·&nbsp;
  <a href="https://discord.gg/XRURAw4TM2">Discord</a>
</p>

<!-- SCREENSHOTS: drop 2-3 in-game shots here once captured -->

---

## What's in it

| | |
|---|---|
| Phone | Real voice calls through pma-voice. Recents, favorites, *67 to hide your number, mute button |
| Messages | Texts, group chats, photo attachments, unread badges |
| Contacts | Photos, favorites, blocking, and Drop (share your number with someone standing next to you) |
| Camera & Photos | The real GTA phone camera — the screen becomes the viewfinder, aim with your mouse, flip to the front cam for selfies just like Snapmatic. Zoom, grid, tap to focus. Import from Discord or Imgur links, set as wallpaper |
| Chirp | Twitter. Posts, likes, replies, follows, banners, verified badges |
| Prism | Instagram. Photo posts, double-tap to like, comments, profile grids. Same account as Chirp |
| Sparks | Tinder. Swipe cards, super likes, rewind, matches, it even says "It's a Match!" |
| Mail | Real email. Players sign up for their own name@ls.mail address, with inbox and sent folders |
| Wallet | Send money by phone number, see your history |
| Marketplace | Player classifieds with photos |
| City | Every business on your server, live OPEN/CLOSED from who's on duty, boss announcements, and business lines — call or text 911, the mechanic, anyone |
| DarkChat | Anonymous chat rooms behind invite codes. No names anywhere |
| Garage | Where your cars are. Ping one on the GPS or pay the valet to bring it |
| Music | Playlists through xsound |
| App Store | Optional apps install per character, including two games |
| Plus | Notes, Clock with working alarms, Calculator, Weather, full Settings |

Chirp, Prism, Sparks and Mail are real accounts — username and password. Log
in from any phone and your whole profile follows you. Log out and hand your
burner account to someone else if that's your thing.

Business numbers are real lines: calling or texting 911 (or any business in
your config) rings a random on-duty worker's phone. Nobody on duty, no
answer. Simple.

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
3. Add `ensure cipher-phone` to your server.cfg, after ox_lib, oxmysql, your
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
   },
   ```

   qb-core, in `shared/items.lua`:
   ```lua
   phone = { name = 'phone', label = 'Phone', weight = 190, type = 'item', image = 'phone.png', unique = true, useable = true, shouldClose = true, description = 'A smartphone' },
   ```
5. Set up the camera. Make a free account at [fivemanage.com](https://fivemanage.com),
   copy an image API token, paste it into `Config.Phone.Media.apiKey`. Done.
6. Go through `config.lua`. The big ones: your businesses list for the City
   app, app names if you want to rename Chirp and friends, and the open key.

## Works with what you already run

- **Banking**: the Wallet uses framework money, so qb-banking, Renewed-Banking,
  okokBanking and anything similar all work. Nothing to configure.
- **911 and business lines**: no dispatch script needed. Calls and texts to a
  business number go straight to an on-duty worker's phone.
- **Garages**: reads `player_vehicles` (stock on both frameworks), and it
  handles builds that store the model as a hash instead of a name. Different
  table? Change one line in the config.
- **Vehicle keys**: the valet hands out keys for both common key systems.

## Exports

```lua
-- server
exports['cipher-phone']:GetNumber(source)
exports['cipher-phone']:Notify(source, { app = 'mail', title = '...', body = '...' })
exports['cipher-phone']:SendMessage('BANK', number, 'You were paid $2,500.')
exports['cipher-phone']:SendMail(number, { from = 'cityhall@ls.mail', subject = '...', body = '...' })
-- SendMail delivers to whatever mail account is logged in on that player's
-- phone. No account, no delivery — it returns false.

-- client
exports['cipher-phone']:IsPhoneOpen()
```

## If something's not working

- **Photos won't save**: your fivemanage API key is missing or wrong. The
  server console prints the actual reason.
- **Calls connect but no audio**: pma-voice is missing or outdated.
- **"You don't have a phone"**: the item isn't in your inventory config, or
  the name doesn't match `Config.Phone.Item.name`.
- **Garage app is empty**: your server uses a different vehicles table. Point
  `Config.Phone.Garage.table` at it.
- **Music won't play**: xsound isn't installed.

## The rest of the Cipher line

| Script | What it is |
|---|---|
| [cipher](https://github.com/XyraL/cipher) | Gang ops — territory, boosting, contracts |
| [cipher-mdt](https://github.com/XyraL/cipher-mdt) | Police/EMS/Fire MDT and dispatch |
| [cipher-admin](https://github.com/XyraL/cipher-admin) | Admin panel and moderation suite |
| [cipher-trucking](https://github.com/XyraL/cipher-trucking) | Civilian trucking career |
| [cipher-drone](https://github.com/XyraL/cipher-drone) | Police drone system |
| [cipher-multicharacter](https://github.com/XyraL/cipher-multicharacter) | Character select |
| [cipher-dispatch](https://github.com/XyraL/cipher-dispatch) | Standalone dispatch |

## License

Free to use on any server you own or run, commercial or not. Modify it for
your own server. No redistribution, no reselling. Full terms in
[LICENSE](LICENSE).
