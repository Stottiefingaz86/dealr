import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@live-dealr/ui",
    "@live-dealr/shared-types",
    "@live-dealr/environments",
  ],
};

export default nextConfig;
