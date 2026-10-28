# Messages+

A fork of [Fossify Messages](https://github.com/FossifyOrg/Messages) that keeps spam instead of throwing it away.
Package `net.wzmn.messages`, so it installs next to the original. Not affiliated with Fossify.

## What's different

- **Spam is kept, not deleted.** Messages that match a spam keyword or come from a number on the app's own
  "Spam numbers" list are saved silently (no notification) and shown in a Spam folder. Upstream drops them for good.
- The words that made a message spam are highlighted, conversations whose latest message is spam get a tag, and a
  conversation can be filtered to its suspicious messages.
- "Mark as spam" / "Not spam" per message, "Mark sender as spam", and a list of numbers that are never spam.
- A spam keyword can be picked straight from a message, with a live preview of the received messages it would match.
  "Whole word only" per keyword.
- "Update spam marks" re-applies the lists to the messages already on the phone, leaving your own marks alone.
- Spam settings in their own Settings section, and in the Spam folder's menu.

## Install

<a href="https://apps.obtainium.imranr.dev/redirect?r=obtainium://add/https://github.com/arikw/messages"><img src="https://raw.githubusercontent.com/ImranR98/Obtainium/main/assets/graphics/badge_obtainium.png" alt="Get it on Obtainium" height="60"></a>

With [Obtainium](https://github.com/ImranR98/Obtainium), which installs apps from their GitHub releases and keeps them
updated: tap the badge above on your phone, or in Obtainium tap **Add App** and paste
`https://github.com/arikw/messages`.

Or download the APK from [Releases](https://github.com/arikw/messages/releases) and install it by hand.

## Build

In a container, with [podman](https://podman.io):

```sh
podman build -t localhost/fossify-messages-build tools   # once
tools/build.sh                                            # app/build/outputs/apk/foss/release/
```

A signed release build needs a `keystore.properties` (see `keystore.properties_sample`) and its key.

## Everything else

All the rest is Fossify Messages: SMS and MMS, group messages, blocking numbers, message export and import, scheduled
messages, a recycle bin, lock-screen privacy, search, no ads, no internet access. See
[Fossify Messages](https://github.com/FossifyOrg/Messages) for details.

<div align="center">
<img alt="App image" src="fastlane/metadata/android/en-US/images/phoneScreenshots/1_en-US.png" width="30%">
<img alt="App image" src="fastlane/metadata/android/en-US/images/phoneScreenshots/2_en-US.png" width="30%">
<img alt="App image" src="fastlane/metadata/android/en-US/images/phoneScreenshots/3_en-US.png" width="30%">
</div>

<p align="center"><em>Screenshots of the original Fossify Messages.</em></p>

## License

GPL-3.0, like the original. Based on [Fossify Messages](https://github.com/FossifyOrg/Messages) by the Fossify
contributors.

