import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serverful Next on Vercel so /api/dealer/* can hold DEEPGRAM_API_KEY.
  // (Static export cannot run TTS — the browser must never see that key.)
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
