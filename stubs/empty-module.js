// Empty stub used to keep React Native-only modules out of the web bundle.
//
// @turnkey/core's passkey stamper contains a string-literal
// `require("@turnkey/react-native-passkey-stamper")` that is guarded at runtime
// by `isReactNative()` and never executes on web. Turbopack still resolves it
// statically and pulls in react-native-passkey -> react-native, whose Flow
// syntax (`import typeof`) it cannot parse. Aliasing that subtree here removes
// it from the browser/SSR graph without affecting runtime behavior.
module.exports = {}
