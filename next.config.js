/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // @turnkey/core's passkey stamper statically references React Native-only
    // packages via `require("@turnkey/react-native-passkey-stamper")`, guarded
    // at runtime by `isReactNative()`. Turbopack follows the string literal
    // regardless and chokes on react-native's Flow syntax. Alias the unused RN
    // subtree to an empty module so it stays out of the web bundle. Paths are
    // resolved relative to the Turbopack root (the project directory).
    resolveAlias: {
      "@turnkey/react-native-passkey-stamper": "./stubs/empty-module.js",
      "react-native-passkey": "./stubs/empty-module.js",
      "react-native": "./stubs/empty-module.js",
    },
  },
}

module.exports = nextConfig
