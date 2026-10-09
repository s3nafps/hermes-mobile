# Hermes Mobile app

Expo (React Native) app that connects to a Hermes gateway.

## Install the Android test build

1. Open the GitHub **Releases** page of this repository and download the latest `hermes-mobile-<version>.apk` (and, optionally, its `.sha256` file to check it).
2. Open the file on the phone and allow installs from this source when Android asks.
3. Open the app and enter your gateway address.

Each build installs over the previous one. Until the release key is set up (below), builds are signed with the debug key, so they are for testing, not for the Play Store.

## Connecting to a gateway

- Use an address the phone can reach, such as a Tailscale address (`http://100.x.y.z:9119`) or your home-network address. `127.0.0.1` means the phone itself, so it will not reach a gateway on your computer.
- A gateway on another machine needs password sign-in enabled. Set it up in the gateway's `config.yaml` under `dashboard.basic_auth`.

## Release signing

Release builds can be signed with a project keystore, kept as GitHub repository secrets. Set this up once:

1. On your computer, run `scripts/make-release-keystore.sh`. It creates the keystore and a `secrets.txt` file in `~/hermes-mobile-release`. Keep that folder safe: every later release needs the same key.
2. Run the four `gh secret set` commands the script prints. They store the keystore and its passwords as `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`.
3. The next release is signed with that key. A phone with an older debug-signed build must uninstall it once before the first release-signed build installs. The app's saved gateways are removed with it, so add the gateway again.

If the secrets are missing, the workflow falls back to the debug key, so forks and local builds still work.

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
