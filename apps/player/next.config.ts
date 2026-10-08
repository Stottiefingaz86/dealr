import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serverful Next on Vercel so /api/dealer/* can hold DEEPGRAM_API_KEY / BEY_API_KEY.
  // (Never put those secrets in `env: {}` here — that inlines into the client bundle.)
  images: { unoptimized: true },
  // The dev badge sat on top of the chat composer in the bottom-left corner.
  devIndicators: false,
  transpilePackages: [
    "@live-dealr/ui",
    "@live-dealr/shared-types",
    "@live-dealr/realtime",
    "@live-dealr/environments",
    "@live-dealr/table-controller",
    "@live-dealr/blackjack-engine",
    "@live-dealr/dealer-profiles",
    "@live-dealr/physical-game-events",
    "@live-dealr/rewards",
    "@live-dealr/card-reader",
    "@live-dealr/websocket",
  ],
};

export default nextConfig;
