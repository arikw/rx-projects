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

Download the APK from [Releases](../../releases), or add this repository's URL to
[Obtainium](https://github.com/ImranR98/Obtainium) to get updates.

## Build

In a container, with [podman](https://podman.io):

```sh
podman build -t localhost/fossify-messages-build tools   # once
tools/build.sh                                            # app/build/outputs/apk/foss/release/
```

A signed release build needs a `keystore.properties` (see `keystore.properties_sample`) and its key.

## License

GPL-3.0, like the original. Based on Fossify Messages by the Fossify contributors; the original's README follows.

---

# Fossify Messages
<img alt="Logo" src="graphics/icon.webp" width="120" />

<a href='https://play.google.com/store/apps/details?id=org.fossify.messages'><img alt='Get it on Google Play' src='https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png' height=80/></a> <a href="https://f-droid.org/packages/org.fossify.messages/"><img src="https://fdroid.gitlab.io/artwork/badge/get-it-on-en.svg" alt="Get it on F-Droid" height=80/></a> <a href="https://apt.izzysoft.de/fdroid/index/apk/org.fossify.messages"><img src="https://gitlab.com/IzzyOnDroid/repo/-/raw/master/assets/IzzyOnDroid.png" alt="Get it on IzzyOnDroid" height=80/></a>

Fossify Messages is your trusted messaging companion, designed to enhance your messaging experience in various ways.

**📱 STAY CONNECTED WITH EASE:**  
With Fossify Messages, you can effortlessly send SMS and MMS messages to stay connected with your loved ones. Enjoy SMS/MMS based group messaging and express yourself with photos, emojis, and quick greetings.

**🚫 BLOCK UNWANTED MESSAGES:**  
Take control of your messaging experience with a robust blocking feature, easily preventing unwanted messages, even from unknown contacts. You can also export and import blocked numbers for hassle-free backup. Additionally, customize your experience by preventing messages with specific words or phrases from reaching your inbox.

**🔒 EFFORTLESS SMS BACKUP:**  
Say goodbye to worries about losing important messages. Fossify Messages offers convenient SMS backup functionality by allowing you to export and import your messages. This feature ensures that you can easily switch devices without losing your valuable conversations.

**🚀 LIGHTNING-FAST AND LIGHTWEIGHT:**  
Despite its powerful features, Fossify Messages boasts a remarkably small app size, making it quick and easy to download and install. Experience speed and efficiency while enjoying the peace of mind that comes with SMS backup.

**🔐 ENHANCED PRIVACY:**  
Customize what appears on your lock screen for added privacy. Choose to display only the sender, message content, or nothing at all. Your messages are in your control.

**🔍 EFFICIENT MESSAGE SEARCH:**  
Say goodbye to endless scrolling through conversations. Fossify Messages simplifies message retrieval with a quick and efficient search feature. Find what you need, when you need it.

**🌈 MODERN DESIGN & USER-FRIENDLY INTERFACE:**  
Enjoy a clean, modern design with a user-friendly interface. The app features a material design and a dark theme option, providing a visually appealing and comfortable user experience.

**🌐 OPEN-SOURCE TRANSPARENCY:**  
Your privacy is a top priority. Fossify Messages operates without requiring an internet connection, guaranteeing message security and stability. Our app is completely free of ads and does not request unnecessary permissions. Moreover, it is fully open-source, providing you with peace of mind, as you have access to the source code for security and privacy audits.

Make the switch to Fossify Messages and experience messaging the way it should be – private, efficient, and user-friendly. Download now and join our community committed to safeguarding your messaging experience.

➡️ Explore more Fossify apps: https://www.fossify.org<br>
➡️ Open-Source Code: https://www.github.com/FossifyOrg<br>
➡️ Join the community on Reddit: https://www.reddit.com/r/Fossify<br>
➡️ Connect on Telegram: https://t.me/Fossify

<div align="center">
<img alt="App image" src="fastlane/metadata/android/en-US/images/phoneScreenshots/1_en-US.png" width="30%">
<img alt="App image" src="fastlane/metadata/android/en-US/images/phoneScreenshots/2_en-US.png" width="30%">
<img alt="App image" src="fastlane/metadata/android/en-US/images/phoneScreenshots/3_en-US.png" width="30%">
</div>

