import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
