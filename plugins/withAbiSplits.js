const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Expo Config-Plugin (V7.4): baut je CPU-Architektur einen eigenen APK statt
 * eines universellen. Der universelle APK bündelt alle Architekturen (~137 MB,
 * über dem 100-MB-Limit); der arm64-v8a-Split (moderne Handys) ist ~51 MB.
 *
 * Weil der android/-Ordner gitignored ist und bei jedem `expo prebuild` neu
 * erzeugt wird, setzt dieses Plugin den splits-Block bei jedem Prebuild erneut
 * in android/app/build.gradle – so bleibt die Größenreduktion dauerhaft.
 */

const SPLITS_BLOCK = `
    // Pro CPU-Architektur einen eigenen APK (Config-Plugin withAbiSplits)
    splits {
        abi {
            enable true
            reset()
            include "armeabi-v7a", "arm64-v8a"
            universalApk false
        }
    }
`;

module.exports = function withAbiSplits(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    // Idempotent: nicht doppelt einfügen
    if (contents.includes('splits {')) return cfg;
    // Vor dem buildTypes-Block einsetzen
    const anchor = contents.match(/\n(\s*)buildTypes\s*\{/);
    if (anchor) {
      contents = contents.replace(anchor[0], `\n${SPLITS_BLOCK}${anchor[0]}`);
      cfg.modResults.contents = contents;
    }
    return cfg;
  });
};
