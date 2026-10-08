# Hermes Mobile app

Expo (React Native) app that connects to a Hermes gateway.

## Install the Android test build

1. Open the GitHub **Releases** page of this repository and download the latest `hermes-mobile-<version>.apk` (and, optionally, its `.sha256` file to check it).
2. Open the file on the phone and allow installs from this source when Android asks.
3. Open the app and enter your gateway address.

Each build installs over the previous one. The builds are signed with the project's debug key, so they are for testing, not for the Play Store.

## Connecting to a gateway

- Use an address the phone can reach, such as a Tailscale address (`http://100.x.y.z:9119`) or your home-network address. `127.0.0.1` means the phone itself, so it will not reach a gateway on your computer.
- A gateway on another machine needs password sign-in enabled. Set it up in the gateway's `config.yaml` under `dashboard.basic_auth`.

## Build from source

Android builds run on GitHub Actions, see `.github/workflows/android-release.yml`.

- Push a tag such as `v0.1.0`, or run the **Android release** workflow by hand and type a version.
- The workflow checks types and lint, generates the native project with `expo prebuild`, builds the APK, and publishes a GitHub release with the APK attached.

Locally:

```bash
npm ci --legacy-peer-deps
npx tsc --noEmit
npx expo lint
npx expo start
```

The `android/` and `ios/` folders are generated and not committed.
