const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite's web worker imports wa-sqlite.wasm; Metro treats .wasm as a
// source file unless it's registered as an asset extension.
config.resolver.assetExts.push("wasm");

// withUniwindConfig must stay the outermost wrapper — it owns the Metro
// transformer that compiles Tailwind classNames at build time.
module.exports = withUniwindConfig(config, {
  cssEntryFile: "./src/global.css",
  dtsFile: "./src/uniwind-types.d.ts",
});
