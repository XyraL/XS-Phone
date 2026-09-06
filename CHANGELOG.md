# Changelog

All notable changes to **Cipher — Phone**.

## [1.0.2] — 2026-09-06

### Fixed
- **Text messages never notified anyone.** Every incoming text was treated as
  if you'd muted the conversation, so it silently landed in the app with no
  alert, no sound and nothing on the lock screen. Texts now notify properly.
- **Calls with `*67` showed your real number** in the other person's call
  history instead of "Anonymous".
- Verified badges on Chirp and Prism never appeared, mail always looked
  unread, and Sparks profiles always read as inactive — all the same
  underlying cause as the two above.
- Notifications no longer cover an incoming call. They still arrive and wait
  in the notification centre and on the lock screen.

### Added
- When a notification arrives with your phone away, the phone slides up for a
  few seconds so you can read it, then tucks back down.
- Swipe a notification sideways on the lock screen to clear it.
- Tap the name or photo at the top of a conversation to see that contact,
  call them, or add them if they aren't saved yet.
- Airplane Mode now shows in the status bar, so it can't be left on by
  accident.

### Changed
- The contact photo and name at the top of a conversation are properly
  centred.

## [1.0.1] — 2026-09-04

### Fixed
- Texts that arrive while your phone is closed now show a real notification —
  who sent it and a preview of the message — and play the phone's text tone.
  Before it was a generic "You received a new message" with no sound, so
  incoming texts were easy to miss entirely. The sender's name comes from
  your saved contacts, falling back to their number.

## [1.0.0] — 2026-09-04

First release.

- 20+ apps: Phone, Messages, Contacts with Drop sharing, Camera & Photos,
  Chirp, Prism, Sparks, Mail, Wallet, Marketplace, City, DarkChat, Garage,
  Music, App Store with two games, Notes, Clock with working alarms,
  Calculator, Weather and full Settings with theming.
- Real voice calls through pma-voice, group texts, photo attachments.
- Chirp, Prism, Sparks and Mail are real accounts — username and password,
  log in from any phone and your profile follows you.
- Real email: players sign up for their own name@ls.mail address.
- Business lines: calling or texting 911 (or any business in your config)
  rings a random on-duty worker's phone. No dispatch script needed.
- Camera is the actual GTA phone camera — aim with your mouse, flip for
  selfies like Snapmatic, digital zoom, grid, tap to focus.
- First-boot setup wizard, passcode, wallpapers, generated ringtones (no
  sound files to license).
- Garage with GPS ping and paid valet, works with hash-stored vehicle models.
- No SQL import needed — tables create themselves on first start.
