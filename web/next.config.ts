import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The scaffold enabled cacheComponents and partialPrefetching (experimental). They were removed
  // because every app page is login-gated and loads data in the browser, so they add no benefit
  // and caused "instant navigation" warnings in dev.
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
