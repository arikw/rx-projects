<img src="app/src/releaseConfig/res/mipmap-xxxhdpi/audio_recorder_logo.png" alt="R-Recorder icon" width="96">

# R-Recorder

R-Recorder is a fork of [Audio Recorder](https://github.com/Dimowner/AudioRecorder) by Dmytro Ponomarenko
(Dimowner), licensed under the Apache License 2.0. It is not affiliated with or endorsed by the original author.

## Install

[<img src="https://raw.githubusercontent.com/ImranR98/Obtainium/main/assets/graphics/badge_obtainium.png"
     alt="Get it on Obtainium"
     height="54">](https://apps.obtainium.imranr.dev/redirect?r=obtainium://add/https://github.com/arikw/r-recorder)

- With [Obtainium](https://obtainium.imranr.dev/), which installs the app and keeps it updated from this
  repository's releases: tap the badge above on your phone, or add `https://github.com/arikw/r-recorder` in Obtainium.
- Or download the APK from [Releases](https://github.com/arikw/r-recorder/releases/latest). Each release lists the
  APK's SHA-256 and the signing certificate's SHA-256, to check the file.

R-Recorder installs next to the original Audio Recorder; it does not replace or update it.

## What it changes
- **Where recordings are saved** (Settings → "Save recordings to"):
  - the app's own folder, as in the original (other apps can't read it);
  - `Recordings/R-Recorder`, a shared folder other apps can read (the default; Android 11+);
  - a folder you choose: recordings are made in the app's folder and copied there when they finish.
- Its own app id (`net.wzmn.audiorecorder`), name and icon, so it installs next to the original app.

## Building

Release builds are signed with the fork's own key when `key/release/signing.properties` exists (kept out of git),
and with the public sample key otherwise. Build in a container: `tools/Containerfile`.

## Features (from Audio Recorder)

<p><b>1. Fast Startup</b>: the app optimized to launch quickly, so you won’t miss a beat when inspiration strikes.</p>
<b>2. Flexible Formats</b>: Choose from three recording formats:

 - <b>M4A</b>: High-quality audio in a compact file size.
 - <b>WAVE (WAV)</b>: Ideal for professional-grade recordings.
 - <b>3Gp</b>: Perfect for sharing on the go.

<b>3. Customizable Settings:</b>
 - Easy to adjust sample rate and bitrate to suit your needs.
 - Toggle between mono and stereo recording.

<b>4. Visual Waveform</b>: See your recordings come to life with waveform display.

<b>5. User-Friendly Features:</b>
 - Rename recordings for easy organization.
 - Share your audio files effortlessly.
 - Import existing audio files.
 - Create bookmarks for quick access.
 - Personalize the app with colorful themes.

## Test Coverage Reports

The project uses [JaCoCo](https://www.jacoco.org/) for code-coverage reporting. Two Gradle tasks are available:

### Unit-test-only report (no device required)

```bash
./gradlew jacocoTestReport
```

Runs **unit tests** (`testDebugConfigDebugUnitTest`) and generates a coverage report.

| Output   | Path                                                  |
|----------|-------------------------------------------------------|
| HTML     | `app/build/reports/jacoco/html/index.html`            |
| XML      | `app/build/reports/jacoco/jacocoTestReport.xml`       |

### Full report — unit tests + connected (instrumented) tests

> **Prerequisite:** a connected device or running emulator.

```bash
./gradlew jacocoFullReport
```

Runs both **unit tests** and **connected Android tests** (`connectedDebugConfigDebugAndroidTest`), then merges the coverage data into a single report.

| Output   | Path                                                  |
|----------|-------------------------------------------------------|
| HTML     | `app/build/reports/jacoco/htmlFull/index.html`        |
| XML      | `app/build/reports/jacoco/jacocoFullReport.xml`       |

### Coverage verification

```bash
./gradlew jacocoTestCoverageVerification
```

Runs `jacocoFullReport` and then asserts that the overall **line coverage ratio ≥ 5 %**. The build will fail if the threshold is not met.

> **Tip:** For fast local iteration use `jacocoTestReport` (unit tests only). Reserve `jacocoFullReport` / `jacocoTestCoverageVerification` for CI or when you need instrumented-test coverage.

## License

```
Copyright 2019 Dmytro Ponomarenko

Licensed to the Apache Software Foundation (ASF) under one or more contributor
license agreements. See the NOTICE file distributed with this work for
additional information regarding copyright ownership. The ASF licenses this
file to you under the Apache License, Version 2.0 (the "License"); you may not
use this file except in compliance with the License. You may obtain a copy of
the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations under
the License.
```
