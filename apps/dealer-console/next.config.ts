import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@live-dealr/ui",
    "@live-dealr/shared-types",
    "@live-dealr/realtime",
    "@live-dealr/physical-game-events",
  ],
};

export default nextConfig;
