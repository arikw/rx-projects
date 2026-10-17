# Lossmol – The right direction

A Thunderbird add-on for writing and reading mail in Hebrew, Arabic and the
other right-to-left scripts (Syriac, Thaana, N'Ko): such text runs right to
left and sits on the right, without fighting the editor. Built on today's
Thunderbird extension APIs (Thunderbird 128 and later, Manifest V3). Below,
"Hebrew" stands for any of these scripts.

## Writing

- **Each paragraph takes its direction from its words as you type.** Mostly
  Hebrew or Arabic: right to left. So an English paragraph in a Hebrew
  message stays left to right, and the other way round. The direction goes into the
  paragraph's `dir` attribute, which is what the recipient's mail client sees.
  A new paragraph opens where the previous one was, so the cursor doesn't
  jump; its first words then decide. A paragraph still empty when you send
  carries no direction of its own.
- **By hand:** the Lossmol button in the compose window's format toolbar
  switches the current paragraph. Its icon shows the paragraph the cursor is
  in (lines on the right: right to left; on the left: left to right), and its
  tooltip says what a click would do. **Ctrl + right Shift** makes it right to
  left and **Ctrl + left Shift** left to right (as in Word and Windows). The
  editor's right-click menu (and the button's) also has **Whole message:
  right-to-left / left-to-right**. A paragraph set by hand stays as you set it.
- **Settings** (Add-ons Manager → Lossmol → Preferences): the direction a new
  message starts in; whether paragraphs follow their words at all; whether
  received messages are fixed (below).

**Sending format.** Thunderbird's "Automatic" sending format downgrades a
message to plain text when it sees no formatting worth keeping, and it never
counts a paragraph's direction as formatting, so the direction would be lost
on the way. Lossmol therefore switches such a message to "HTML and plain
text" just before it's sent (a setting; on by default). If your account
composes in plain text to begin with (Account Settings → Composition &
Addressing → *Compose messages in HTML format* unticked), there is no HTML
to carry a direction and Lossmol can't help.

Quoted and forwarded messages inside a reply are judged paragraph by
paragraph like everything else, but "whole message" leaves them alone.

## Reading

Received messages whose Hebrew or Arabic arrived left-aligned (a common
result of Outlook and web forms) are shown right to left, paragraph by
paragraph, so a mixed message comes out right in both directions. Plain-text messages are
handled by paragraph too (a paragraph being a run of lines up to a blank one).

The Lossmol button in the message header tells you what you're looking at:
in full colour, Lossmol re-aligned something in this message (hover for how
many paragraphs); as an outline, the message looks the way its own
instructions say; grey with left-aligned lines, you switched Lossmol off for
this message. Clicking it switches between the
fixed view and the way the message arrived; the next message follows the
setting again. Right-click the button for the setting itself ("all messages")
and the preferences.

## How a paragraph is judged

- **Each block by its own text** — `<p>`, `<div>`, `<li>`, heading, table
  cell, and so on; text inside nested blocks is left out. So a wrapper never
  flips just because the message is mostly Hebrew, and each paragraph gets
  its own direction.
- **Words, not letters.** English words run longer and Hebrew leaves out most
  vowels, so counting letters leans English. A word is a run of letters in
  one script. Over half the words Hebrew (or Arabic, Syriac, Thaana, N'Ko):
  right to left.
- **Lines that aren't paragraphs** — a message written with Enter as a plain
  line break, or plain text — are grouped into paragraphs and, when they
  disagree, each paragraph is wrapped in a `<div>` of its own so it can carry
  its own direction.
- **When reading, the sender's word counts if the sender knows about
  direction.** A message with `dir="rtl"` anywhere was written with direction
  in mind (Lossmol, Gmail's or Outlook's right-to-left button), so any `dir`
  it puts on a paragraph is deliberate and is kept, even `dir="ltr"` on
  Hebrew. A message with no `dir="rtl"` at all comes from a client that
  stamps `dir="ltr"` on everything or writes none (Yahoo, Gmail's wrapper,
  Outlook); that says nothing, so every paragraph is judged by its words.

## Install

From a release: Thunderbird → Add-ons and Themes → gear → *Install Add-on
From File…* → the `.xpi`.

For development: Add-ons and Themes → gear → *Debug Add-ons* → *Load
Temporary Add-on…* → this folder's `manifest.json`. After changing the code:
*Reload* there, then open a new compose window or message.

## Files

- `manifest.json` — Manifest V3; `compose_action` is the toolbar button.
- `background.js` — registers the scripts below for compose windows and
  displayed messages, injects them into windows already open, and wires the
  button and the context menu to `compose.js`.
- `lib/direction.js` — judges a text: `rtl`, `ltr`, or nothing to judge by.
- `lib/blocks.js` — the blocks of a document and their lines: judging,
  wrapping lines, keeping the caret, watching for changes.
- `compose.js` — in the editor: automatic direction, the commands, the
  keyboard shortcuts, the default direction.
- `display.js`, `display.css` — in a displayed message.
- `options/` — the settings page. `_locales/` — English, Hebrew and Arabic
  (the settings page, the menu and the button follow Thunderbird's language).
- `tools/pack.sh` — builds `dist/lossmol-<version>.xpi`.
  `tools/lint.sh` — `web-ext lint` in a one-shot container (podman by
  default, `CONTAINER=docker` to use Docker). It warns about the `compose`
  and `messagesRead` permissions only because it checks against Firefox's
  list; Thunderbird has them.
- `test/direction.test.js` — `node --test test/direction.test.js`.
  `test/compose.html`, `test/display.html` — stand-ins for the editor and a
  displayed message, to try the scripts in any browser (serve the folder over
  HTTP, e.g. `python3 -m http.server`, and open them).

## Licence

MIT — see `LICENSE`. Use it freely, as long as the licence text and the
credit stay with every copy.
