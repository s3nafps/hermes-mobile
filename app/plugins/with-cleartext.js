const { withAndroidManifest } = require('@expo/config-plugins');

// Allows plain http:// gateway addresses on Android. Gateways on a home network or a
// Tailscale address are often reached over http, and Android 9+ blocks that by default.
module.exports = function withCleartext(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (application) application.$['android:usesCleartextTraffic'] = 'true';
    return mod;
  });
};
