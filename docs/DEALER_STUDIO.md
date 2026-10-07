# Dealer studio / OBS

The player table is a live greenscreen composite.

1. OBS feeds the dealer on green (background + table cloth green).
2. Layer 1 paints the virtual room + felt animation.
3. Layer 2 chroma-keys the camera so green becomes transparent.
4. Digital betting markings (main circle, Perfect Pairs / Bet Behind / 21+3) sit on the virtual table.
5. Chips stack on those UI markings — not on a physical printed table.

Physical cards stay in the camera. The app does not draw fake cards. Count badges sit on positioned spots.

Align those spots in **Admin → Table studio** (`apps/admin`, port 3002): open your camera, drag Dealer + Seats 1–5 + Bet pad, then Save. The player table loads that layout from the API.

Wallet is a simple balance sheet (add / cash out) — right on desktop, bottom on mobile.

## Development connection

Players never open a webcam. The dealer console owns go-live; the API publishes a playback URL.

1. Point `DEALER_PLAYBACK_URL` / `NEXT_PUBLIC_DEALER_STREAM_URL` at your HLS or MP4 feed (OBS → media server).
2. In the dealer console, press **Go live**.
3. Players receive `media:state` over the socket and play that URL.

```bash
DEALER_PLAYBACK_URL=http://localhost:8080/dealer.m3u8
NEXT_PUBLIC_DEALER_STREAM_URL=http://localhost:8080/dealer.m3u8
```

Production video will move behind LiveKit / WebRTC in `services/media`. The player still treats the dealer picture as layer 2.
