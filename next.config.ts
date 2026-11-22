import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Paint the launch from the initial document, without a blocking CSS round trip.
  experimental: { inlineCss: true },
  // Run Tailwind CSS on every .css file Turbopack bundles.
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
