# Live Dealr

Premium live blackjack. Real physical cards. The dealer is the hero.

## Run the prototype

```bash
pnpm install
pnpm test
pnpm dev
```

- Player: http://localhost:3000
- Dealer console / shoe simulator / event inspector: http://localhost:3001
- Admin shell: http://localhost:3002
- API + WebSocket: http://localhost:4000

## Prove the loop

1. Open the player table and dealer console.
2. Start a round (either surface).
3. Deal four physical cards from the shoe simulator (player, dealer, player, dealer).
4. HIT / STAND / DOUBLE on the player phone UI.
5. The dealer console shows the requested action immediately.
6. Deal remaining physical cards through the same shoe path.
7. Watch WIN / LOSE / PUSH / BLACKJACK on the player table.
8. Read the event inspector.

PostgreSQL is optional for this loop. `docker compose up -d` then `pnpm db:generate` when you persist events.

## Deploy (Vercel)

Deploy the player app only — Nest API / websocket stay on a separate host.

The player is a static Next export (`apps/player/out`). Root `vercel.json` builds
`@live-dealr/player` and publishes that folder, so the project Root Directory can
stay at the repo root (the root `package.json` has no `next`).

1. Import `Stottiefingaz86/dealr` in Vercel.
2. Leave Root Directory as `.` (or set it to `apps/player` — both work).
3. Point `NEXT_PUBLIC_*` env vars at your API / stream URLs when you have them.

Root `pnpm build` builds `@live-dealr/player` only. Use `pnpm build:all` for the full turbo graph.
