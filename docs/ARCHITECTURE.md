# Architecture

Physical cards are the source of truth. Software never selects the next card.

```text
Shoe Simulator | Physical Smart Shoe
        ↓
Card Reader Adapter (CardReaderPort)
        ↓
Table Controller
        ↓
Blackjack Engine (cards in, rules out)
        ↓
Sequenced GameEvent + GameState
        ↓
WebSocket
   ↙        ↘
Player UI   Dealer Console
```

## Process topology (MVP)

`services/api` is a single NestJS process. HTTP and Socket.IO stay on Nest. Domain objects are wired in `services/api/src/kernel.ts` so the table controller, card-reader adapter and engine stay independent of decorator DI.

The process still composes:

- `services/card-reader`
- `services/table-controller`
- `services/websocket`

This is a deployment convenience, not a coupling of domains. Each remains a replaceable package. A physical shoe later implements `CardReaderPort` instead of `ShoeSimulatorAdapter`.

## Authoritative state

`TableRuntime` is the only writer of game state. Clients render snapshots and send player intent. The shoe simulator POSTs to `/dev/shoe/detect`; it does not call React setters.

## Persistence

Prisma + PostgreSQL are ready (`database/prisma`). The live loop uses an in-memory sequenced event log so the prototype can run without Redis or a database. Event records can be appended to Postgres without changing the engine.

## Intentionally deferred

- Redis
- LiveKit (placeholder dealer stage)
- Three.js / EnvironmentLayer implementation (abstraction only)
- Authentication
- Real-money payments
- Computer-vision verification
