#!/usr/bin/env bash
# Creates the Android release keystore for Hermes Mobile, on your own computer.
#
# The keystore is the app's signing identity. Every later release must be signed with the
# same key, or phones refuse to update the app in place. Back up the folder this creates
# (keystore and secrets.txt) somewhere safe. Losing it means a new app identity.
#
# Usage: scripts/make-release-keystore.sh [output-folder]
set -euo pipefail

REPO="${HERMES_REPO:-s3nafps/hermes-mobile}"
OUT_DIR="${1:-$HOME/hermes-mobile-release}"
ALIAS="hermes-mobile"
KEYSTORE="$OUT_DIR/release.keystore"
SECRETS="$OUT_DIR/secrets.txt"

if [ -e "$KEYSTORE" ]; then
  echo "$KEYSTORE already exists. Not overwriting it."
  exit 1
fi

mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"

# One password for the store and the key keeps the secrets simple. PKCS12 requires it.
PASSWORD="$(openssl rand -base64 30 | tr -dc 'A-Za-z0-9' | cut -c1-28)"

keytool -genkeypair \
  -keystore "$KEYSTORE" \
  -storetype PKCS12 \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$PASSWORD" \
  -keypass "$PASSWORD" \
  -dname "CN=Hermes Mobile, O=Hermes Mobile"

cat > "$SECRETS" <<EOF
ANDROID_KEYSTORE_PASSWORD=$PASSWORD
ANDROID_KEY_ALIAS=$ALIAS
ANDROID_KEY_PASSWORD=$PASSWORD
EOF
chmod 600 "$SECRETS"

cat <<EOF

Created:
  $KEYSTORE
  $SECRETS   (the passwords; keep them in a password manager)

Now add these four secrets to the repository, from a terminal with the GitHub CLI:

  gh secret set ANDROID_KEYSTORE_BASE64 -R $REPO --body "\$(openssl base64 -A -in "$KEYSTORE")"
  gh secret set ANDROID_KEYSTORE_PASSWORD -R $REPO --body "$PASSWORD"
  gh secret set ANDROID_KEY_ALIAS -R $REPO --body "$ALIAS"
  gh secret set ANDROID_KEY_PASSWORD -R $REPO --body "$PASSWORD"

The next release build is signed with this key. A phone that has the debug-signed app
needs to uninstall it once before installing a release-signed build.
EOF
