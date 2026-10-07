import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
