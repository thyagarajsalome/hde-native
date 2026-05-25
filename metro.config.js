const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

/**
 * Fix: @supabase/supabase-js uses @opentelemetry packages internally.
 * Those packages use dynamic import(variable) expressions which are
 * NOT supported by Hermes (React Native's JS engine) and cause the
 * bundle compilation to fail with "Invalid expression encountered".
 *
 * Solution: Resolve all @opentelemetry/* imports to empty modules
 * so they are never included in the Hermes-compiled bundle.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@opentelemetry/")) {
    return { type: "empty" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
