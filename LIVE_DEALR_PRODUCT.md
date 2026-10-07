# Live Dealr — Product & Technical Foundation

## 1. Product Vision

**Live Dealr** is a premium, immersive live casino platform where the **dealer is the hero**.

The goal is not to recreate a traditional live casino studio. Traditional live casino often feels noisy, generic, crowded and transactional. Live Dealr should feel more like a premium interactive broadcast: one dealer, one controlled environment, excellent audio, cinematic presentation, real physical cards and constant player engagement.

The dealer should feel like a creator / personality that players can follow, return to and build affinity with.

### Product principle

> Don't build a better live casino table. Build the first live casino people want to follow.

---

## 2. Core Differentiators

### 2.1 Premium isolated dealer experience

Dealers operate from acoustically controlled booths / studios.

The player should not hear:
- other dealers
- neighbouring tables
- general studio noise
- unrelated casino audio

The player should feel as though the dealer is speaking directly to them.

### 2.2 Dealer as the hero

Dealers are not anonymous operators.

Each dealer can have:
- profile
- avatar / photography
- follower count
- live status
- schedule
- favourite games
- highlights / clips
- community stats
- achievements
- follow button
- notification preferences

Future concept:
- dealer channels
- dealer-specific events
- dealer community goals
- dealer social clips
- external social media promotion

### 2.3 Immersive virtual environment

The dealer and table can be captured using green screen / virtual production.

The player should not see a conventional casino studio behind the dealer.

Potential environments:
- Monaco
- Miami rooftop
- private members club
- futuristic casino
- luxury penthouse
- sports arena
- seasonal environments
- VIP environments

The environment can react to gameplay:
- blackjack
- big wins
- streaks
- dealer bust
- jackpot events
- reward unlocks

### 2.4 Personalised player environment

Each player can personalise parts of their own experience without changing the experience for everyone else.

Potential controls:
- ambient music volume
- dealer voice volume
- table sound volume
- social effects
- lighting colour / hue
- animation intensity
- environment theme
- reduced-motion mode

### 2.5 Continuous engagement

Dead time should be minimised.

During:
- shuffle
- dealer change
- shoe change
- table reset
- short operational pauses

players may optionally interact with:
- scratchers
- mini-games
- trivia
- dealer polls
- predictions
- community goals
- reward moments

These experiences must never interfere with the primary live game.

### 2.6 Rewards and progression

Players can earn progression for meaningful engagement.

Examples:
- completing a shoe
- playing a number of hands
- participating in dealer events
- following a dealer
- completing missions
- achieving streak-related milestones
- optional social participation

Reward mechanics must remain configurable and should not be hardcoded into the blackjack engine.

---

# 3. Critical Game Integrity Principle

## Real cards are the source of truth

Live Dealr must use **real physical cards and a real physical shoe**.

The platform must **NOT use RNG to determine which card is dealt**.

The system only:
1. detects the physical card,
2. records the card,
3. updates game state,
4. calculates rules and totals,
5. presents the information to players and dealers.

The physical card determines the outcome.

### Correct flow

```text
REAL SHOE
   ↓
REAL PHYSICAL CARD
   ↓
CARD READER / SMART SHOE
   ↓
TABLE CONTROLLER
   ↓
BLACKJACK GAME ENGINE
   ↓
REAL-TIME EVENT
   ↓
PLAYER UI + DEALER UI
```

### Incorrect flow

```text
SOFTWARE RNG
   ↓
GENERATED CARD
   ↓
DEALER EXPECTED TO MATCH IT
```

This architecture must never be implemented.

---

# 4. Card Recognition

## 4.1 Primary recognition

Production architecture should support a **smart card-reading shoe**.

When a physical card leaves the shoe, the system receives an event such as:

```json
{
  "event": "CARD_DETECTED",
  "tableId": "BJ-001",
  "shoeId": "SHOE-001",
  "rank": "A",
  "suit": "SPADES",
  "sequence": 126,
  "timestamp": "2026-10-07T12:00:00Z"
}
```

## 4.2 Secondary verification

The architecture should allow future computer-vision verification using an overhead or table-facing camera.

Example:

```text
Smart shoe: A♠
Camera:     A♠
Result:     VERIFIED
```

Mismatch:

```text
Smart shoe: A♠
Camera:     4♦
Result:     REVIEW REQUIRED
```

Computer vision is a secondary integrity layer, not the initial source of truth.

## 4.3 Development hardware simulator

The first prototype will not depend on physical hardware.

Create a **Shoe Simulator** capable of emitting the same event structure that a real card-reading shoe will eventually send.

This allows the real shoe to replace the simulator later without rewriting the game engine.

---

# 5. Player-to-Dealer Action Flow

Example blackjack round:

```text
Dealer deals physical card
        ↓
Smart shoe identifies card
        ↓
Card event enters system
        ↓
Game engine updates hand
        ↓
Player UI updates instantly
        ↓
System determines available actions
        ↓
Player selects HIT / STAND / DOUBLE / SPLIT
        ↓
Action sent through real-time server
        ↓
Dealer console updates
        ↓
Dealer physically performs action
        ↓
Next physical card is read
        ↓
Cycle repeats
```

The dealer should never need to manually type the value of a normal card during standard play.

Manual correction tools may exist later for supervisor-controlled exception handling.

---

# 6. First MVP

The first MVP should prove the core interaction loop.

## MVP scope

Build a **single-player blackjack table** with:

- simulated dealer video
- one player seat
- simulated smart shoe
- physical-card event model
- player cards
- dealer cards
- blackjack hand calculation
- HIT
- STAND
- DOUBLE
- basic SPLIT support can follow after core flow
- dealer action panel
- real-time communication
- game event log
- win / lose / push result
- simple immersive effects
- basic dealer profile
- follow dealer interaction
- environment controls mock
- chat UI shell
- rewards UI shell

No real-money wagering integration is required for the first MVP.

Use demo credits only.

---

# 7. Technology Stack

## Monorepo

Use **Turborepo**.

## Frontend

- Next.js 16
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion

## State

- Zustand for lightweight client state
- TanStack Query where server-state caching is useful

## Immersive presentation

- Three.js
- React Three Fiber
- optional GSAP for advanced animation sequences

## Real-time communication

- WebSockets
- Socket.IO for MVP
- architecture should remain transport-agnostic where practical

## Video / Audio

- LiveKit
- WebRTC

For MVP:
- use placeholder / local dealer video
- do not block development on real LiveKit integration

## Backend

- Node.js
- NestJS
- TypeScript

## Database

- PostgreSQL
- Prisma ORM

## Fast real-time state

- Redis

## Media

Future:
- FFmpeg
- object storage
- CDN

## Virtual production

Prototype:
- OBS
- green screen
- browser overlays

Future:
- Unreal Engine virtual production

---

# 8. Repository Structure

```text
live-dealr/

apps/
  player/
  dealer-console/
  admin/

packages/
  ui/
  blackjack-engine/
  physical-game-events/
  realtime/
  rewards/
  dealer-profiles/
  environments/
  shared-types/

services/
  api/
  websocket/
  table-controller/
  card-reader/
  media/

database/
  prisma/
  seeds/

docs/
  PRODUCT.md
  ARCHITECTURE.md
  GAME_ENGINE.md
  DEALER_STUDIO.md
  REALTIME.md
  DESIGN_SYSTEM.md
  REWARDS.md
```

---

# 9. Core Domain Models

## Card

```ts
type Suit = "clubs" | "diamonds" | "hearts" | "spades";

type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
  sequence: number;
  shoeId: string;
  detectedAt: string;
}
```

## Player action

```ts
type PlayerActionType =
  | "hit"
  | "stand"
  | "double"
  | "split"
  | "insurance";

interface PlayerAction {
  id: string;
  tableId: string;
  playerId: string;
  handId: string;
  action: PlayerActionType;
  createdAt: string;
}
```

## Game event

Use an event-based model.

Examples:

```text
TABLE_OPENED
SHOE_CONNECTED
SHOE_STARTED
ROUND_STARTED
BETTING_OPENED
BET_PLACED
BETTING_CLOSED
CARD_DETECTED
CARD_ASSIGNED
PLAYER_ACTION_REQUIRED
PLAYER_ACTION_RECEIVED
DEALER_ACTION_REQUIRED
HAND_COMPLETED
ROUND_SETTLED
ROUND_COMPLETED
SHOE_COMPLETED
TABLE_PAUSED
TABLE_RESUMED
```

Each event should contain:
- unique ID
- table ID
- round ID
- timestamp
- event type
- payload
- sequence number

---

# 10. Event-Driven Architecture

The platform should be event-driven from day one.

Example:

```text
Smart Shoe
    ↓
CARD_DETECTED
    ↓
Table Controller
    ↓
CARD_ASSIGNED
    ↓
Blackjack Engine
    ↓
GAME_STATE_UPDATED
    ↓
WebSocket
   ↙       ↘
Player     Dealer
UI         Console
```

The event history must allow a complete hand to be reconstructed later.

---

# 11. Blackjack Engine Responsibilities

The blackjack engine may determine:

- hand totals
- soft / hard totals
- blackjack
- bust
- available actions
- split eligibility
- double eligibility
- dealer draw / stand rules
- insurance availability
- settlement logic
- payout calculation
- round completion

It must **NOT**:
- generate cards
- randomise the shoe
- decide which physical card comes next

---

# 12. Dealer Console

The dealer console must prioritise speed and clarity.

Example layout:

```text
┌─────────────────────────────────────────────┐
│ LIVE DEALR                     TABLE BJ-001 │
├─────────────────────────────────────────────┤
│                                             │
│ Dealer                       7♣             │
│                                             │
│ PLAYER 1                                    │
│ A♠  6♥                                     │
│ TOTAL: 17                                  │
│                                             │
│ ACTION                                     │
│ ██████████████████████████████████████████ │
│                  HIT                        │
│ ██████████████████████████████████████████ │
│                                             │
└─────────────────────────────────────────────┘
```

Dealer UX principles:

- large action states
- minimal reading
- no unnecessary navigation
- no manual card entry during normal operation
- extremely clear current player
- extremely clear required action
- visible connectivity state
- visible shoe state
- visible round state
- pause / escalation control for exceptional cases

---

# 13. Player Experience

Mobile-first.

Primary table anatomy:

```text
┌───────────────────────┐
│ LIVE BLACKJACK      ⚙ │
│                       │
│        DEALER         │
│                       │
│      virtual room     │
│                       │
│       A♠    K♥        │
│           21          │
│                       │
│    HIT       STAND    │
│                       │
│ Chat  Rewards  Dealer │
└───────────────────────┘
```

The dealer video should not simply appear as a rectangular video player.

Think in layers:

```text
Layer 5   Win / reward / notification effects
Layer 4   Player interaction UI
Layer 3   Foreground AR / particles
Layer 2   Dealer video
Layer 1   Virtual environment
Layer 0   Background effects
```

---

# 14. Visual Direction

The experience should feel:

- premium
- dark
- cinematic
- modern
- sophisticated
- broadcast quality
- clean
- immersive

Avoid:

- generic casino gold everywhere
- visual clutter
- cheap slot-machine aesthetics
- excessive neon
- noisy dashboards
- obvious template UI
- unnecessary gradients
- tiny controls
- desktop UI simply squeezed onto mobile

The game must remain the focus.

---

# 15. Responsive Strategy

## Mobile

Primary experience.

Dealer should occupy a large portion of the screen.

Player actions should be thumb-friendly.

## Desktop

Use additional space for:
- chat
- dealer profile information
- rewards
- table activity
- optional statistics
- richer environment presentation

Do not simply stretch the mobile layout.

---

# 16. Immersive Game Events

Game events should be able to trigger presentation effects.

Example:

```text
BLACKJACK
   ↓
Effect Orchestrator
   ↓
- lighting pulse
- card particles
- environment response
- spatial sound
- reward animation
```

Other event hooks:

- PLAYER_WIN
- PLAYER_BLACKJACK
- PLAYER_BUST
- DEALER_BUST
- PUSH
- WIN_STREAK
- SHOE_COMPLETED
- REWARD_UNLOCKED
- DEALER_JOINED
- DEALER_FOLLOWED

Presentation effects must never alter game logic.

---

# 17. Personalisation

Create an environment settings model.

Example:

```ts
interface PlayerEnvironmentSettings {
  dealerVolume: number;
  tableVolume: number;
  ambientVolume: number;
  socialVolume: number;
  lightingHue: number;
  animationIntensity: "off" | "low" | "medium" | "high";
  reducedMotion: boolean;
  environmentId: string;
}
```

Settings affect only the individual player's client unless explicitly defined otherwise.

---

# 18. Dealer Profiles

Dealer model should support:

```ts
interface DealerProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  followerCount: number;
  isLive: boolean;
  primaryGames: string[];
  schedule?: DealerSchedule[];
  highlights?: DealerHighlight[];
}
```

MVP should include:
- profile preview
- follow / unfollow
- live badge
- follower count
- simple schedule placeholder

---

# 19. Rewards

Keep reward logic separate from blackjack.

Example events rewards may listen for:

```text
ROUND_COMPLETED
SHOE_COMPLETED
DEALER_FOLLOWED
MISSION_COMPLETED
TABLE_EVENT_PARTICIPATED
```

Do not couple rewards directly into the hand calculation logic.

---

# 20. Admin / Supervisor Future Requirements

Future admin capabilities:

- table status
- dealer status
- shoe status
- card-reader connectivity
- event stream
- round replay
- mismatch alerts
- pause table
- resume table
- void / review workflows
- incident logging
- dealer scheduling
- environment configuration
- reward configuration

These are not required for MVP but architecture should not prevent them.

---

# 21. Security / Integrity Design Principles

- server authoritative game state
- clients never determine outcomes
- player actions timestamped server-side
- all table events sequenced
- event IDs must be immutable
- reject duplicate player actions
- validate actions against current hand state
- reconnecting clients must recover current authoritative state
- dealer console must not manipulate card identity
- card events must be auditable
- card-reader integration must support device identity
- production should include signed / authenticated hardware events
- operational overrides should require elevated roles and audit logging

---

# 22. MVP Development Phases

## Phase 1 — Project foundation

- Turborepo
- apps
- shared packages
- TypeScript
- Tailwind
- shadcn
- linting
- formatting
- shared types

## Phase 2 — Blackjack domain

- card model
- hand model
- blackjack scoring
- available actions
- dealer rules
- settlements
- unit tests

## Phase 3 — Shoe simulator

- developer UI for physical card events
- event creation
- shoe sequence
- reset shoe
- event log

## Phase 4 — Table controller

- consume card event
- assign card to correct hand
- update round state
- publish game events

## Phase 5 — Real-time

- websocket server
- player connection
- dealer connection
- game-state sync
- reconnect recovery

## Phase 6 — Player UI

- premium mobile table
- dealer area
- physical cards
- actions
- balance / demo credits
- result states
- immersive event layer

## Phase 7 — Dealer console

- current hand
- required action
- shoe state
- player state
- clear operational status

## Phase 8 — Dealer personality

- dealer profile
- follow
- schedule
- profile drawer

## Phase 9 — Environment controls

- audio controls
- lighting mock
- animation intensity
- theme selector

## Phase 10 — Polish

- animations
- accessibility
- responsive desktop
- reconnect handling
- loading states
- error states
- visual consistency

---

# 23. First Prototype Success Criteria

The prototype is successful when we can demonstrate:

1. A dealer is visible in a premium live-table UI.
2. A simulated physical card is emitted from the Shoe Simulator.
3. The game engine receives the card.
4. The correct card appears on the player's screen.
5. The player's hand total updates.
6. Available actions are calculated server-side.
7. The player presses HIT.
8. The dealer console immediately shows HIT.
9. Another simulated physical card is dealt.
10. The player's state updates.
11. The player can STAND.
12. Dealer play completes.
13. Win / lose / push is calculated.
14. A visual event is triggered from the result.
15. The complete event sequence can be inspected afterwards.

---

# 24. Non-Negotiables

1. **No RNG-generated playing cards.**
2. **Physical cards are the source of truth.**
3. **Game logic is server authoritative.**
4. **Dealer presentation and game logic remain separate.**
5. **Rewards remain separate from blackjack settlement logic.**
6. **Hardware integration must be replaceable via adapters.**
7. **Mobile is the primary player experience.**
8. **The UI must feel premium, not like a generic casino template.**
9. **The dealer is the visual and emotional focus.**
10. **Every significant game action must be auditable.**

---

# 25. Initial Development Rule

Before writing complex production infrastructure, build the complete end-to-end experience using:

- local dealer video placeholder
- demo credits
- Shoe Simulator
- one blackjack table
- one player
- one dealer console
- WebSockets
- event log

Prove the experience first.

Then replace simulated components one at a time with production infrastructure.

---

# 26. Product North Star

Live Dealr should feel less like:

> "I opened a live blackjack table."

And more like:

> "My favourite dealer is live. I'm joining their table."
