import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export so Vercel can deploy from the monorepo root without setting
  // Root Directory to apps/player (the root package.json has no "next").
  output: "export",
  images: { unoptimized: true },
  // The dev badge sat on top of the chat composer in the bottom-left corner.
  devIndicators: false,
  transpilePackages: [
    "@live-dealr/ui",
    "@live-dealr/shared-types",
    "@live-dealr/realtime",
    "@live-dealr/environments",
  ],
};

export default nextConfig;
