# ARC-AI Mobile

React Native (Expo) client for **ARC-AI** — the Autonomous Real-time
Conversational Agent. It talks to the same backend as the ARC-AI web app
(REST under `/api`, realtime over Socket.IO) and mirrors the web feature set on
mobile.

## Features

- **Streaming chat** with the ARC agent, markdown rendering, and message actions
- **Voice mode** — streaming speech-to-text (server-side) and streamed PCM
  text-to-speech with barge-in
- **Vision** — attach photos, documents, or capture from the camera
- **Conversations** — browse, search, rename, pin and delete history
- **Workspaces** — create/switch workspaces that scope conversations & memory
- **Memory** — learned facts, semantic memories, search, and learning toggle
- **Tools** — connect/disconnect MCP servers and inspect their tools
- **Automation** — WhatsApp linking (QR / phone pairing), contact sync, sends
- **Approvals** — decide on agent tool approvals inline with live expiry
- **Agent executions** — live step-by-step plan progress
- **9 themes** (dark/light/neon), persisted locally
- **Auth** — email/password, Google, and guest sessions

## Requirements

- Node.js 20+
- npm 10+
- An Android device or emulator (for APK builds see below)
- For local native builds: Java 17 and the Android SDK
- A reachable ARC-AI backend

## Environment variables

Expo inlines **only** variables prefixed with `EXPO_PUBLIC_` into the app
bundle. They are **not secrets** — anyone can read them from the APK.

There is only **one** variable. REST and Socket.IO both live on the ARC-AI
backend, so a single origin covers both (`<url>/api` and `<url>/socket.io`).

| Variable | Required | Description |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | Yes | Origin of the ARC-AI backend. No trailing slash and **no** `/api` suffix. |

> The web app uses two variables (`VITE_API_URL` + `VITE_SOCKET_URL`) only
> because the browser proxies REST same-origin to dodge third-party-cookie
> blocking while connecting the WebSocket directly. A native app has neither
> constraint, so `EXPO_PUBLIC_SOCKET_URL` is intentionally not used.

Examples of `EXPO_PUBLIC_API_URL`:

| Target | Value |
| --- | --- |
| Hosted backend | `https://<your-backend-host>` |
| Android emulator (local server) | `http://10.0.2.2:5000` |
| iOS simulator (local server) | `http://localhost:5000` |
| Physical device (local server) | `http://<your-computer-LAN-IP>:5000` |

`src/constants/config.ts` ships with a default host, so the app still runs if
`EXPO_PUBLIC_API_URL` is unset — set it to point at your own deployment.

### Environment variables for cloud builds

`eas build` runs on Expo's servers and does **not** read your local `.env`.
Pass the value to the build either inline in `eas.json`:

```jsonc
// eas.json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": { "EXPO_PUBLIC_API_URL": "https://<your-backend-host>" }
    }
  }
}
```

or as an EAS environment variable:

```bash
eas env:create --name EXPO_PUBLIC_API_URL --value https://<your-backend-host> --environment preview --visibility plaintext
```

## Getting started

```bash
npm install
cp .env.example .env      # then set EXPO_PUBLIC_API_URL
npx expo start
```

Then press `a` for Android, `i` for iOS, or scan the QR code with
[Expo Go](https://expo.dev/go). Voice capture and camera require a development
build (created below); plain text chat works in Expo Go.

Useful scripts:

| Command | Description |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run android` | Start and open on Android |
| `npm run ios` | Start and open on iOS |
| `npm run web` | Start in a web browser |
| `npm run lint` | Run ESLint (`expo lint`) |
| `npx tsc --noEmit` | Type-check the project |

## Backend requirement

The mobile client authenticates with a **Bearer token**. Because the browser
flow only sets an httpOnly cookie, the backend must also return the JWT in the
response body for `POST /api/auth/login`, `POST /api/auth/register`,
`POST /api/auth/guest`, and `POST /api/auth/session`. The ARC-AI backend in
this project already returns `{ ..., token }`; see
`server/controllers/authController.js`.

## Build an installable Android APK

The app uses native modules, so it must be built as a standalone/development
binary — not run through Expo Go for the full feature set.

### Option A — GitHub Actions (easiest, no tools to install)

A workflow at `.github/workflows/android-release.yml` builds the APK on
GitHub's servers whenever you push a `v*` tag, and attaches it to a Release.

1. Push the code and the workflow to GitHub (once):

   ```bash
   git add .
   git commit -m "Add Android APK build workflow"
   git push
   ```

2. Ship a version by pushing a tag:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. Open the repository's **Actions** tab and watch the run (about 10 minutes).
   When it finishes, go to **Releases** and download the `.apk`.

To point the build at your own backend, add a repository variable named
`EXPO_PUBLIC_API_URL` (Settings → Secrets and variables → Actions → Variables).
If you leave it unset, the app's compiled-in default host is used.

### Option B — EAS Build (signed APK, needs an Expo account)

1. Install and sign in to the EAS CLI:

   ```bash
   npm install -g eas-cli
   eas login
   ```

2. Link the project to your Expo account (writes `extra.eas.projectId` into
   `app.json`):

   ```bash
   eas init
   ```

3. Set the backend URL for the build (see
   [Environment variables for cloud builds](#environment-variables-for-cloud-builds)).

4. Build the APK using the `preview` profile (`android.buildType: "apk"`):

   ```bash
   eas build --platform android --profile preview
   ```

   When the build finishes, download the `.apk` from the printed URL or from
   the Expo dashboard. EAS generates and stores a keystore for you automatically.

### Option C — Local build (no Expo account, needs Android SDK + JDK 17)

```bash
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease
```

The APK is written to
`android/app/build/outputs/apk/release/app-release.apk`. A locally built
release APK is signed with the debug keystore unless you configure your own
release signing; it is still installable for testing.

### Install on your phone

1. Copy the `.apk` to the device (or open the download link on it).
2. Allow **Install unknown apps** for the app doing the installing
   (Settings → Apps → Special access → Install unknown apps).
3. Open the APK and tap **Install**.

## Publish to a GitHub Release

If you used **Option A** (GitHub Actions), a Release is created and the APK is
attached automatically when you push a `v*` tag — no extra steps.

For a manually built APK, attach it yourself. With the GitHub CLI:

```bash
gh release create v1.0.0 ./app-release.apk \
  --title "ARC-AI Mobile v1.0.0" \
  --notes "First Android release (APK)."
```

Or in the browser: **Releases → Draft a new release →** tag `v1.0.0`, add the
`.apk` under **Attach binaries**, and publish. Users can install directly from
the release asset the same way as in the previous section.

## Project structure

```
src/
  app/            Expo Router routes
    (auth)/       Sign-in / register
    (app)/        Drawer app: chat, memory, tools, automation, settings, about
    camera.tsx    Camera capture modal
    _layout.tsx   Root providers + socket + voice capture
  api/            REST clients (axios) + token holder
  auth/           Google OAuth helper
  chat/           Turn submission + new-chat controller
  components/     UI kit and chat components
  lib/            Pure logic (voice machine, approval UI, history, media)
  socket/         Socket.IO client, event map, handlers, client actions
  store/          Zustand stores (auth, chat, workspace, execution, …)
  theme/          Design tokens + 9 themes
  voice/          STT channel, PCM helpers, TTS player, capture
  constants/      Runtime config
```

## Notes & limitations

- **TTS playback.** Expo Audio has no raw-PCM sink, so streamed server audio is
  wrapped into short WAV segments and played in order. Installing
  `react-native-audio-api` and using a development build upgrades this to true
  sample-accurate streaming. `expo-speech` is used as a local fallback.
- **Voice & camera** need a development or standalone build (not Expo Go).
- `EXPO_PUBLIC_*` values are embedded in the binary; changing the backend
  requires a rebuild or a runtime override.

## License

See [LICENSE](./LICENSE).
