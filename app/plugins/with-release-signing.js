const { withAppBuildGradle } = require('@expo/config-plugins');

// Signs the release build with a keystore from environment variables, so every release
// installs over the one before it. When ANDROID_KEYSTORE_PATH is not set, the release
// build keeps the debug key, which is how local builds and CI worked before this plugin.
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    const gradle = mod.modResults.contents;
    if (gradle.includes('ANDROID_KEYSTORE_PATH')) return mod;

    // Two-step edit: add a release signing config, then point the release build type at it.
    const releaseSigning = `
    signingConfigs {
        release {
            def keystorePath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (keystorePath) {
                storeFile file(keystorePath)
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
`;
    // The release build type sits inside buildTypes. Its signingConfig is the first one
    // after its "release {" line, which leaves the debug build type alone.
    const buildTypes = /\n(\s*)buildTypes\s*\{/;
    const releaseBuildType = /(buildTypes\s*\{[\s\S]*?\n\s*release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!buildTypes.test(gradle) || !releaseBuildType.test(gradle)) {
      throw new Error(
        'with-release-signing: could not find the release build type in android/app/build.gradle. ' +
          'Expo may have changed the template; update the plugin.',
      );
    }

    let next = gradle.replace(
      releaseBuildType,
      '$1signingConfig (System.getenv("ANDROID_KEYSTORE_PATH") ? signingConfigs.release : signingConfigs.debug)',
    );
    next = next.replace(buildTypes, (_, indent) => `${releaseSigning}\n${indent}buildTypes {`);
    mod.modResults.contents = next;
    return mod;
  });
};
