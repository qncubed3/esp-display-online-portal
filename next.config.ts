import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // QuickJS loads its WASM file from node_modules at runtime, so it must not be bundled.
  serverExternalPackages: ["quickjs-emscripten", "quickjs-emscripten-core", "@jitl/quickjs-wasmfile-release-sync"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
