"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, MessageSquare, PenLine, RotateCcw, SlidersHorizontal, Undo2 } from "lucide-react";
import {
  CHIP_VALUES,
  DEFAULT_PLAYER_ID,
  DEFAULT_TABLE_ID,
  type Card,
  type ChipValue,
  type Hand,
  type Player,
  type PlayerActionType,
} from "@live-dealr/shared-types";
import { EnvironmentLayer } from "./layers/environment-layer";
import {
  DealerVideoLayer,
  DEMO_DEALER_SOURCES,
  type FeedStatus,
} from "./layers/dealer-video-layer";
import { MoodOverlay } from "./layers/mood-overlay";
import { BackgroundEffects } from "./layers/background-effects";
import { seatGeometry, TableScene, type SceneSeat } from "./table-scene";
import { ChipTray } from "./chip-tray";
import { ActionRing } from "./action-ring";
import { StreamChat } from "./stream-chat";
import { ChatDrawer } from "./chat-drawer";
import { DealerDrawer } from "./dealer-drawer";
import { DealerAvatar } from "./dealer-avatar";
import { WalletDrawer } from "./wallet-drawer";
import { AtmosphereDrawer } from "./atmosphere-drawer";
import { MissionsButton, MissionsDrawer } from "./missions-drawer";
import { PanelDock } from "./panel-dock";
import { cn } from "@live-dealr/ui/lib/utils";
import { buildBeyTableSummary, useBeyDealer } from "@/lib/use-bey-dealer";
import { WinConfetti } from "./win-confetti";
import { PlayerMenu } from "./player-menu";
import {
  AvatarReactionMenu,
  DEALER_THROW_SEAT,
  ReactionLayer,
  useReactions,
} from "./reactions";
import { useTableSocket } from "@/lib/use-table-socket";
import { useCountdown } from "@/lib/use-countdown";
import { useAnchorSpots } from "@/lib/use-anchor-spots";
import { usePlayerStore } from "@/lib/store";
import { formatMoney } from "@/lib/chips";
import { useIsMobile } from "@/hooks/use-mobile";
import { setSfxLevels } from "@/lib/sfx-levels";
import {
  playBetConfirm,
  playSocialPop,
  playChipPlace,
  preloadChipSfx,
  unlockAudio,
} from "@/lib/chip-sound";
import { fireClaimConfetti } from "@/lib/confetti";
import {
  playCountdownTick,
  playTurnChime,
  preloadRewardClaim,
} from "@/lib/turn-sound";
import { ensureAmbience } from "@/lib/music";
import { playCardDeal } from "@/lib/card-sound";
import { playGoodEvening, playPlaceYourBets, preloadDealerTalk } from "@/lib/dealer-talk";
import { speakHandTotal, speakRewardCongrats, speakTipThanks } from "@/lib/dealer-voice";
import { loadProfile } from "@/lib/player-profile";

type ActionBurst = { action: PlayerActionType; id: string };

/** Drop below the seat tag so trays clear the bet pad / cards. */

export type TableExperienceProps = {
  /** Override for live/friends tables where your id isn't the demo DEFAULT_PLAYER_ID. */
  playerId?: string;
  actions?: ReturnType<typeof useTableSocket>;
  /** Friends table handles its own join greets — skip the solo once-per-tab line. */
  skipJoinGreet?: boolean;
  /** From the start screen — used for Isla context + seat name. */
  playerName?: string;
  avatarUrl?: string | null;
  /** Fires once AI Isla is live (or Bey is unavailable so the table can open). */
  onDealerReady?: () => void;
};

export function TableExperience({
  playerId: playerIdProp,
  actions,
  skipJoinGreet = false,
  playerName,
  avatarUrl = null,
  onDealerReady,
}: TableExperienceProps = {}) {
  const [feedStatus, setFeedStatus] = useState<FeedStatus>("idle");
  // Ready from first paint — never flash the old loop while we flip this on.
  const beyWanted = process.env.NEXT_PUBLIC_BEY_DEALER === "1";
  const dealerSources = beyWanted
    ? []
    : process.env.NEXT_PUBLIC_DEALER_STREAM_URL
      ? [process.env.NEXT_PUBLIC_DEALER_STREAM_URL]
      : DEMO_DEALER_SOURCES;
  const mainRef = useRef<HTMLElement>(null);
  const dealerVideoRef = useRef<HTMLVideoElement>(null);
  const profileName = useMemo(
    () => playerName?.trim() || loadProfile().name.trim() || "Player",
    [playerName],
  );
  const profileAvatar = useMemo(
    () => avatarUrl ?? loadProfile().avatarUrl,
    [avatarUrl],
  );
  const bey = useBeyDealer({
    enabled: beyWanted,
    videoRef: dealerVideoRef,
    userName: profileName,
    tableId: DEFAULT_TABLE_ID,
  });
  const beyLive = bey.status === "live";
  // Shoe only starts when Isla’s video is actually live — never with hardcoded VO.
  const tableOpen = !beyWanted || beyLive;
  const waitingForIsla = beyWanted && !beyLive;
  // Always AI stream mode when Bey is on — never show the old green-screen loop.
  const beyStream = beyWanted;
  // Never fall back to canned dealer lines while AI Isla is the product.
  const loopVoice = !beyWanted;

  const socketActions = useTableSocket({
    enabled: !actions && tableOpen,
    displayName: playerName?.trim() || undefined,
    avatarUrl,
  });
  const {
    addChip,
    clearBet,
    confirmBet,
    sendAction,
    follow,
    chooseSeat,
    sendChat,
    tip,
    sendReaction,
    claimReward,
    playerId: socketPlayerId,
  } = actions ?? socketActions;
  const localPlayerId = playerIdProp ?? socketPlayerId ?? DEFAULT_PLAYER_ID;
  const state = usePlayerStore((s) => s.state);
  const events = usePlayerStore((s) => s.events);
  const chat = usePlayerStore((s) => s.chat);
  const roomReactions = usePlayerStore((s) => s.reactions);
  const following = usePlayerStore((s) => s.following);
  const setFollowing = usePlayerStore((s) => s.setFollowing);
  const panel = usePlayerStore((s) => s.panel);
  const setPanel = usePlayerStore((s) => s.setPanel);
  const settings = usePlayerStore((s) => s.settings);
  const updateSettings = usePlayerStore((s) => s.updateSettings);
  const missions = usePlayerStore((s) => s.missions);
  const unlockList = usePlayerStore((s) => s.unlocks);
  const signalMission = usePlayerStore((s) => s.signalMission);
  const claimMission = usePlayerStore((s) => s.claimMission);
  const unlocks = useMemo(() => new Set(unlockList), [unlockList]);
  const bettingRemaining = useCountdown(state?.bettingClosesAt ?? null);
  const actionRemaining = useCountdown(state?.actionClosesAt ?? null);
  const [selectedChip, setSelectedChip] = useState<ChipValue>(25);
  const isMobile = useIsMobile();
  useEffect(() => {
    setSfxLevels({ table: settings.tableVolume, social: settings.socialVolume });
  }, [settings.tableVolume, settings.socialVolume]);

  // Lounge track on by default — browsers need a gesture, so we arm immediately and retry on first tap.
  useEffect(() => {
    ensureAmbience();
    void preloadChipSfx();
    preloadRewardClaim();
    // Canned dealer VO only when AI Isla isn't taking the mic.
    if (process.env.NEXT_PUBLIC_BEY_DEALER === "1") return;
    preloadDealerTalk();
    if (skipJoinGreet) return;
    const greetName = loadProfile().name.trim() || undefined;
    playGoodEvening({ name: greetName });
    const armVoice = () => {
      unlockAudio();
      playGoodEvening({ name: greetName });
      window.removeEventListener("pointerdown", armVoice);
      window.removeEventListener("keydown", armVoice);
    };
    window.addEventListener("pointerdown", armVoice, { once: true });
    window.addEventListener("keydown", armVoice, { once: true });
    return () => {
      window.removeEventListener("pointerdown", armVoice);
      window.removeEventListener("keydown", armVoice);
    };
  }, [skipJoinGreet]);
  const [actionBursts, setActionBursts] = useState<Record<string, ActionBurst>>({});
  const [friends, setFriends] = useState<Set<string>>(() => new Set());
  const [playerMenu, setPlayerMenu] = useState<{
    playerId: string;
    name: string;
    seat: number;
  } | null>(null);
  const seenActionEvents = useRef(new Set<string>());
  const reactions = useReactions();

  useEffect(() => {
    if (!onDealerReady) return;
    if (tableOpen) onDealerReady();
  }, [tableOpen, onDealerReady]);

  // Beats Isla should react to — facts only (agent turns these into spoken lines).
  const beyBeatsRef = useRef<
    Array<{
      id: string;
      kind: string;
      name?: string;
      names?: string[];
      emoji?: string;
      amount?: number;
      hand?: string;
      total?: string;
    }>
  >([]);
  const seenBeyBeats = useRef(new Set<string>());
  function pushBeyBeat(
    id: string,
    kind: string,
    extra?: {
      name?: string;
      names?: string[];
      emoji?: string;
      amount?: number;
      hand?: string;
      total?: string;
    },
  ) {
    if (seenBeyBeats.current.has(id)) return;
    seenBeyBeats.current.add(id);
    beyBeatsRef.current = [...beyBeatsRef.current.slice(-24), { id, kind, ...extra }];
  }

  // Push shoe to Isla — throttle clocks so countdown ticks don't hammer the main thread.
  const actingPlayerId = state?.actingPlayerId ?? null;
  const tablePhase = state?.table.phase;
  const chatLen = chat.length;
  const chatTail = chat[chat.length - 1]?.id ?? "";
  useEffect(() => {
    if (!bey.conversationId || !state) return;
    let cancelled = false;
    const push = () => {
      if (cancelled) return;
      const seats = state.players
        .filter((p) => p.seat != null)
        .map((p) => {
          const hand = p.hands[p.activeHandIndex] ?? p.hands[0];
          return {
            seat: p.seat as number,
            name: p.displayName,
            isLocal: p.id === localPlayerId,
            bet: p.currentBet,
            cards: (hand?.cards ?? []).map(cardLabel),
            total: handLabel(hand),
          };
        });
      const acting = state.players.find((p) => p.id === state.actingPlayerId);
      const local = state.players.find((p) => p.id === localPlayerId);
      const localHand = local?.hands[local.activeHandIndex] ?? local?.hands[0];
      const summary = buildBeyTableSummary({
        phase: state.table.phase,
        dealerTotal: handLabel(state.dealer.hand),
        actingName: acting?.displayName ?? null,
        seats,
        chat: chat.slice(-10).map((m) => ({ name: m.senderName, text: m.text })),
      });
      void fetch("/api/bey/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: bey.conversationId,
          phase: state.table.phase,
          actingSeat: acting?.seat ?? null,
          actingName:
            acting?.id === localPlayerId
              ? profileName
              : (acting?.displayName ?? null),
          dealerTotal: handLabel(state.dealer.hand),
          dealerCards: (state.dealer.hand?.cards ?? []).map(cardLabel),
          bettingRemaining,
          actionRemaining,
          localSeat: local?.seat ?? null,
          localName: profileName,
          seats: seats.map((s) =>
            s.isLocal ? { ...s, name: profileName || s.name } : s,
          ),
          recentChat: chat.slice(-10).map((m) => ({
            name:
              m.senderId === localPlayerId || m.senderName === "You"
                ? profileName
                : m.senderName,
            text: m.text,
            kind: m.kind,
            isLocal:
              m.senderId === localPlayerId ||
              m.senderName === "You" ||
              m.senderName === profileName,
          })),
          beats: beyBeatsRef.current.slice(-12),
          summary:
            summary +
            (localHand
              ? `\nLocal player ${profileName} hand: [${(localHand.cards ?? [])
                  .map(cardLabel)
                  .join(" ")}] total ${handLabel(localHand)}.`
              : ""),
        }),
      }).catch(() => undefined);
    };
    push();
    // Clocks only — refresh every 2s without re-running on every second tick.
    const id = window.setInterval(push, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    bey.conversationId,
    state,
    actingPlayerId,
    tablePhase,
    chatLen,
    chatTail,
    roomReactions.length,
    localPlayerId,
    profileName,
    // clocks intentionally omitted — interval covers them
    bettingRemaining > 0,
    actionRemaining > 0,
  ]);

  // Map throws aimed at the dealer → Isla reacts (with thrower's live hand).
  useEffect(() => {
    for (const reaction of roomReactions) {
      if (reaction.kind !== "throw" || reaction.toSeat !== DEALER_THROW_SEAT) continue;
      const thrower = state?.players.find((p) => p.id === reaction.senderId);
      const hand = thrower?.hands[thrower.activeHandIndex] ?? thrower?.hands[0];
      pushBeyBeat(`throw-${reaction.id}`, "throw_dealer", {
        name: reaction.senderName,
        emoji: reaction.emoji,
        hand: (hand?.cards ?? []).map(cardLabel).join(" ") || undefined,
        total: handLabel(hand) ?? undefined,
      });
    }
  }, [roomReactions, state]);

  const seenHandVoice = useRef(new Set<string>());
  useEffect(() => {
    const table = usePlayerStore.getState().state;
    const me = table?.players.find((p) => p.id === localPlayerId);
    for (const event of events) {
      if (event.type === "HAND_COMPLETED" && !seenHandVoice.current.has(event.id)) {
        seenHandVoice.current.add(event.id);
        const handId = event.payload.handId;
        const ownerPlayer = table?.players.find((p) => p.hands.some((h) => h.id === handId));
        const isMine = ownerPlayer?.id === localPlayerId;
        const { isBust, isBlackjack, total, owner } = event.payload;
        if (loopVoice && (isMine || owner === "dealer") && (isBust || isBlackjack)) {
          void speakHandTotal(isBust ? "BUST" : isBlackjack ? "BJ" : String(total));
        }
        // Whole table — BJ / bust for any seat, not only the human.
        const who =
          owner === "dealer"
            ? "Isla"
            : ownerPlayer?.displayName && ownerPlayer.displayName !== "You"
              ? ownerPlayer.displayName
              : isMine
                ? profileName
                : "Player";
        if (owner === "dealer" && isBust) {
          pushBeyBeat(event.id, "dealer_bust");
        } else if (owner === "dealer" && (isBlackjack || total === 21)) {
          pushBeyBeat(event.id, "dealer_21");
        } else if (owner !== "dealer" && isBlackjack) {
          pushBeyBeat(event.id, "player_bj", { name: who });
        } else if (owner !== "dealer" && isBust) {
          pushBeyBeat(event.id, "player_bust", { name: who });
        }
      }
      if (event.type === "ROUND_SETTLED") {
        const snap = usePlayerStore.getState().state;
        const settlements = event.payload.settlements ?? [];
        if (seenHandVoice.current.has(event.id)) continue;
        seenHandVoice.current.add(event.id);
        const named = settlements.map((s) => {
          const p = snap?.players.find((x) => x.id === s.playerId);
          const n =
            p?.id === localPlayerId
              ? profileName
              : p?.displayName && p.displayName !== "You"
                ? p.displayName
                : "Player";
          return { ...s, name: n };
        });
        const winners = named.filter(
          (s) => s.outcome === "win" || s.outcome === "blackjack",
        );
        const losers = named.filter(
          (s) => s.outcome === "lose" || s.outcome === "bust",
        );
        const pushes = named.filter((s) => s.outcome === "push");
        const bjs = named.filter((s) => s.outcome === "blackjack");
        // One table-level call — never only celebrate the human seat.
        if (named.length > 0 && winners.length === named.length) {
          pushBeyBeat(event.id, "table_all_win", {
            names: winners.map((w) => w.name),
          });
        } else if (winners.length >= 2) {
          pushBeyBeat(event.id, "table_multi_win", {
            names: winners.map((w) => w.name),
          });
        } else if (winners.length === 1) {
          pushBeyBeat(`${event.id}-win`, "player_win", { name: winners[0]!.name });
        } else if (losers.length === named.length && named.length > 0) {
          pushBeyBeat(event.id, "table_dealer_wins");
        } else if (losers.length === 1 && winners.length === 0) {
          pushBeyBeat(`${event.id}-lose`, "player_lose", { name: losers[0]!.name });
        }
        // Named sympathy / push when the round was mixed — keeps her present.
        if (winners.length > 0 && losers.length === 1) {
          pushBeyBeat(`${event.id}-lose`, "player_lose", { name: losers[0]!.name });
        }
        for (const p of pushes.slice(0, 1)) {
          pushBeyBeat(`${event.id}-push-${p.playerId}`, "player_push", {
            name: p.name,
          });
        }
        for (const bj of bjs) {
          pushBeyBeat(`${event.id}-bj-${bj.playerId}`, "player_bj", { name: bj.name });
        }
      }
      if (event.type !== "PLAYER_ACTION_RECEIVED") {
        continue;
      }
      if (seenActionEvents.current.has(event.id)) {
        continue;
      }
      seenActionEvents.current.add(event.id);
      const { playerId, action } = event.payload;
      setActionBursts((prev) => ({ ...prev, [playerId]: { action, id: event.id } }));
      window.setTimeout(() => {
        setActionBursts((prev) => {
          if (prev[playerId]?.id !== event.id) {
            return prev;
          }
          const next = { ...prev };
          delete next[playerId];
          return next;
        });
      }, 1900);
    }
  }, [events, localPlayerId, loopVoice, profileName]);

  const playersBySeat = useMemo(() => {
    const map = new Map<number, Player>();
    for (const player of state?.players ?? []) {
      map.set(player.seat, player);
    }
    return map;
  }, [state?.players]);

  // Match by id only. Guests must not fall back to seat 1 (host). Solo demo uses DEFAULT_PLAYER_ID.
  const localPlayer =
    state?.players.find((player) => player.id === localPlayerId) ??
    (!playerIdProp ? state?.players.find((player) => player.id === DEFAULT_PLAYER_ID) : undefined);
  const playerHand = localPlayer?.hands[0];
  const dealerHand = state?.dealer.hand;

  const cardCount = (playerHand?.cards.length ?? 0) + (dealerHand?.cards.length ?? 0);
  useEffect(() => {
    if (cardCount > 0) {
      playCardDeal();
    }
  }, [cardCount]);

  const result = state?.lastSettlements.find((item) => item.playerId === localPlayer?.id);
  const won =
    result &&
    (result.outcome === "win" || result.outcome === "blackjack") &&
    state?.table.phase === "round_complete";

  const betting = state?.table.phase === "betting";
  const isMyTurn =
    state?.table.phase === "player_action" && state.actingPlayerId === localPlayer?.id;
  const someoneElseActing =
    state?.table.phase === "player_action" &&
    Boolean(state.actingPlayerId) &&
    state.actingPlayerId !== localPlayer?.id;

  // Mission signals: a settled hand (once per round) and a locked-in bet (once per round)
  const settledRoundRef = useRef<string | null>(null);
  const betRoundRef = useRef<string | null>(null);
  const roundId = state?.round?.id ?? null;
  const phase = state?.table.phase;
  useEffect(() => {
    if (!roundId || !localPlayer) return;
    if (phase !== "betting" && betRoundRef.current !== roundId && localPlayer.currentBet > 0) {
      betRoundRef.current = roundId;
      signalMission({ type: "bet_locked", amount: localPlayer.currentBet });
    }
    if (phase === "round_complete" && result && settledRoundRef.current !== roundId) {
      settledRoundRef.current = roundId;
      const hand = localPlayer.hands.find((h) => h.id === result.handId);
      signalMission({
        type: "hand_settled",
        outcome: result.outcome,
        bet: result.betAmount,
        net: result.net,
        doubled: Boolean(hand?.isDoubled),
      });
    }
  }, [roundId, phase, result, localPlayer, signalMission]);

  // Dealer: "place your bets" every time betting opens (loop VO only — Isla says this live)
  const wasBetting = useRef(false);
  useEffect(() => {
    if (betting && !wasBetting.current && loopVoice) {
      playPlaceYourBets();
    }
    wasBetting.current = betting;
  }, [betting, loopVoice]);

  // Heads-up chime the moment the action passes to you
  useEffect(() => {
    if (isMyTurn) playTurnChime();
  }, [isMyTurn]);

  // Tick through the last three seconds of any clock that's yours to beat
  const myClock = betting ? bettingRemaining : isMyTurn ? actionRemaining : null;
  useEffect(() => {
    if (myClock !== null && myClock >= 1 && myClock <= 3) playCountdownTick(myClock);
  }, [myClock]);

  const dealerName = state?.dealer.profile.displayName ?? "Isla Noir";
  const balance = localPlayer?.demoCredits ?? 1000;
  const totalBet = localPlayer?.currentBet ?? 0;
  const chips = localPlayer?.chipStack ?? [];
  const bettingSeconds = 15;
  const actionWindowSeconds = someoneElseActing ? 6 : 12;
  const bettingProgress =
    betting && bettingRemaining !== null
      ? Math.max(0, Math.min(1, bettingRemaining / bettingSeconds))
      : 0;
  const actionProgress =
    state?.actionClosesAt && actionRemaining !== null
      ? Math.max(0, Math.min(1, actionRemaining / actionWindowSeconds))
      : 1;

  function placeOnLocalSeat() {
    if (!betting) {
      return;
    }
    unlockAudio();
    playChipPlace();
    addChip(selectedChip);
  }

  const localSeat = localPlayer?.seat ?? 1;
  // Always render all 5 pads — vacant seats stay visible so the table reads full.
  const sceneSeats: SceneSeat[] = [1, 2, 3, 4, 5].map((seat) => {
    const seated = playersBySeat.get(seat);
    const isLocal = seated?.id === localPlayerId;
    const hand = seated?.hands[0];
    const acting = Boolean(
      seated && state?.table.phase === "player_action" && state.actingPlayerId === seated.id,
    );
    return {
      seat,
      displayName: isLocal ? profileName : (seated?.displayName ?? null),
      avatarUrl: isLocal ? (profileAvatar ?? seated?.avatarUrl) : seated?.avatarUrl,
      isLocal,
      chips: seated?.chipStack ?? [],
      bet: seated?.currentBet ?? 0,
      cards: hand?.cards ?? [],
      handTotal: handLabel(hand),
      isActing: acting,
      turnProgress: acting ? actionProgress : 1,
      turnSeconds: acting ? actionRemaining : null,
      actionBurst: seated ? (actionBursts[seated.id] ?? null) : null,
      menuOpen: isLocal ? reactions.menuOpen : playerMenu?.playerId === seated?.id,
      hideTag: false,
      onAvatarClick: () => {
        if (isLocal) {
          setPlayerMenu(null);
          reactions.toggleMenu();
          return;
        }
        if (!seated) return;
        reactions.setMenuOpen(false);
        setPlayerMenu({ playerId: seated.id, name: seated.displayName, seat });
      },
    };
  });

  // Screen-space anchors (measured through the 3D plane) for menus + throws
  const anchorSpots = useAnchorSpots(
    mainRef,
    `${sceneSeats.map((s) => `${s.seat}:${s.displayName}:${s.cards.length}`).join("|")}:${phase}:${localSeat}`,
  );
  const geoFallback = seatGeometry(localSeat);
  // Never fall back to screen-centre — that put the tray under the wrong pad.
  const localSpot = anchorSpots[localSeat] ?? {
    x: geoFallback.spot.x,
    y: Math.min(86, 52 + geoFallback.spot.y * 0.35),
  };
  const seatTargets = [
    {
      seat: DEALER_THROW_SEAT,
      spot: anchorSpots[DEALER_THROW_SEAT] ?? { x: 50, y: 22 },
      isLocal: false,
      isDealer: true,
    },
    ...sceneSeats
      .filter((s) => s.isLocal || Boolean(s.displayName))
      .map((s) => ({
        seat: s.seat,
        spot: anchorSpots[s.seat] ?? {
          x: seatGeometry(s.seat).spot.x,
          y: 58 + seatGeometry(s.seat).spot.y * 0.28,
        },
        isLocal: s.isLocal,
      })),
  ];
  const menuPlayerSpot = playerMenu ? (anchorSpots[playerMenu.seat] ?? null) : null;

  // Play reactions from the rest of the room (ours are rendered locally when sent).
  const seenReactions = useRef(new Set<string>());
  const anchorRef = useRef(anchorSpots);
  anchorRef.current = anchorSpots;
  useEffect(() => {
    function spotFor(seat: number) {
      if (seat === DEALER_THROW_SEAT) {
        return anchorRef.current[DEALER_THROW_SEAT] ?? { x: 50, y: 22 };
      }
      if (anchorRef.current[seat]) return anchorRef.current[seat]!;
      // Fallback if the seat tag hasn't measured yet — keep throws visible.
      const geo = seatGeometry(seat);
      return { x: geo.spot.x, y: 58 + geo.spot.y * 0.28 };
    }

    for (const reaction of roomReactions) {
      if (seenReactions.current.has(reaction.id) || reaction.senderId === localPlayerId) {
        continue;
      }
      seenReactions.current.add(reaction.id);
      const from = spotFor(reaction.fromSeat);
      if (reaction.kind === "emote") {
        playSocialPop(1.5);
        reactions.spawnEmote(reaction.emoji, from);
      } else if (reaction.toSeat !== null) {
        reactions.spawnThrow(reaction.emoji, from, spotFor(reaction.toSeat));
      }
    }
  }, [roomReactions, localPlayerId, reactions.spawnEmote, reactions.spawnThrow]);

  const panelOpen = panel !== "none";
  const tallPanel =
    panel === "dealer" || panel === "wallet" || panel === "rewards" || panel === "settings";

  return (
    <div
      className={cn(
        "flex h-dvh max-h-dvh overflow-hidden bg-black text-foreground",
        isMobile ? "flex-col" : "flex-row",
      )}
    >
    <main ref={mainRef} className="relative min-h-0 min-w-0 flex-1 overflow-clip">
      <EnvironmentLayer settings={settings} />
      <BackgroundEffects settings={settings} />
      <DealerVideoLayer
        sources={dealerSources}
        dealerName={dealerName}
        onStatusChange={setFeedStatus}
        videoRef={dealerVideoRef}
        streamMode={beyStream}
      />
      {waitingForIsla ? (
        <div className="absolute inset-0 z-[40] flex flex-col items-center justify-center bg-[#07070a]/92 backdrop-blur-md">
          <p className="text-[11px] tracking-[0.34em] text-white/40 uppercase">AI dealer</p>
          <h2 className="mt-2 font-display text-4xl leading-none text-white">{dealerName}</h2>
          <p className="mt-4 text-sm text-white/50">
            {bey.status === "checking"
              ? "Checking the room…"
              : bey.status === "error" || bey.status === "unavailable"
                ? "Reconnecting Isla…"
                : "Joining the table…"}
          </p>
          <p className="mt-2 max-w-[16rem] text-center text-[12px] text-white/35">
            Hands deal the moment she’s live — no filler voice.
          </p>
          {bey.error ? (
            <p className="mt-3 max-w-[20rem] text-center text-[11px] text-white/30">{bey.error}</p>
          ) : null}
        </div>
      ) : null}
      {beyWanted && bey.status === "error" ? (
        <div className="pointer-events-none absolute left-1/2 top-[4.5rem] z-[8] -translate-x-1/2 rounded-full border border-white/12 bg-black/50 px-3 py-1 text-[10px] text-white/70 backdrop-blur-md">
          AI dealer unavailable: {bey.error ?? "error"}
        </div>
      ) : null}
      <MoodOverlay settings={settings} />

      <TableScene
        settings={settings}
        phase={state?.table.phase}
        seats={sceneSeats}
        dealerCards={dealerHand?.cards ?? []}
        dealerTotal={handLabel(dealerHand)}
        canBet={betting}
        onBet={placeOnLocalSeat}
        onSit={(seat) => {
          if (!betting || seat === localSeat) return;
          unlockAudio();
          chooseSeat(seat);
        }}
        localDock={
          betting ? (
            <SeatDock
              seconds={bettingRemaining}
              leading={
                <DockButton label="Undo bet" onClick={clearBet} disabled={totalBet === 0}>
                  <Undo2 className="size-4" strokeWidth={1.75} />
                </DockButton>
              }
              trailing={
                <>
                  <DockButton
                    label="Double bet"
                    onClick={() => {
                      for (const chip of chips) {
                        addChip(chip);
                      }
                    }}
                    disabled={totalBet === 0}
                  >
                    <span className="text-[11px] font-bold">2×</span>
                  </DockButton>
                  <DockButton
                    label="Confirm bet"
                    onClick={() => {
                      unlockAudio();
                      playBetConfirm();
                      confirmBet();
                    }}
                    disabled={totalBet < 1}
                    accent
                    pulse={totalBet >= 1}
                  >
                    <Check className="size-4" strokeWidth={2.5} />
                  </DockButton>
                </>
              }
            >
              <span
                className={`mr-2 min-w-[2.4rem] border-r border-white/10 pr-2 text-right text-[12px] font-semibold tabular-nums sm:mr-2.5 sm:min-w-[2.6rem] sm:pr-2.5 sm:text-[13px] ${
                  totalBet > 0 ? "text-[#f0c43a]" : "text-white/35"
                }`}
              >
                ${formatMoney(totalBet)}
              </span>
              <ChipTray
                minimal
                size={isMobile ? 28 : 34}
                selectedChip={selectedChip}
                onSelectChip={setSelectedChip}
                onUndo={clearBet}
                onDouble={() => {
                  for (const chip of chips) {
                    addChip(chip);
                  }
                }}
                chipValues={CHIP_VALUES}
                canDouble={totalBet > 0}
              />
            </SeatDock>
          ) : isMyTurn ? (
            <SeatDock seconds={actionRemaining} urgent={actionProgress < 0.3}>
              <ActionRing
                size="sm"
                available={state?.availableActions ?? []}
                onAction={(action) => sendAction(action)}
              />
            </SeatDock>
          ) : null
        }
        dealerVideoRef={dealerVideoRef}
        streamMode={beyStream}
      />

      <StreamChat
        messages={chat}
        dealerId={state?.dealer.id}
        onDealerTap={() => setPanel("dealer")}
      />

      <ReactionLayer
        throws={reactions.throws}
        emotes={reactions.emotes}
        impacts={reactions.impacts}
      />

      <AnimatePresence>
        {reactions.menuOpen ? (
          <AvatarReactionMenu
            open={reactions.menuOpen}
            onClose={() => reactions.closeMenu()}
            localSpot={localSpot}
            seats={seatTargets}
            unlocks={unlocks}
            onLocked={() => {
              reactions.closeMenu();
              setPanel("rewards");
            }}
            onEmote={(emoji) => {
              playSocialPop(1.5);
              reactions.spawnEmote(emoji, localSpot);
              sendReaction("emote", emoji);
              signalMission({ type: "reaction" });
            }}
            onThrow={(emoji, to, toSeat) => {
              reactions.spawnThrow(emoji, localSpot, to);
              sendReaction("throw", emoji, toSeat);
              signalMission({ type: "reaction" });
              if (toSeat === DEALER_THROW_SEAT) {
                const meHand = localPlayer?.hands[localPlayer.activeHandIndex] ?? localPlayer?.hands[0];
                pushBeyBeat(`throw-local-${Date.now()}`, "throw_dealer", {
                  name: profileName,
                  emoji,
                  hand: (meHand?.cards ?? []).map(cardLabel).join(" ") || undefined,
                  total: handLabel(meHand) ?? undefined,
                });
              }
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {playerMenu && menuPlayerSpot ? (
          <PlayerMenu
            name={playerMenu.name}
            spot={menuPlayerSpot}
            isFriend={friends.has(playerMenu.playerId)}
            onFriend={() => {
              setFriends((prev) => {
                const next = new Set(prev);
                if (next.has(playerMenu.playerId)) {
                  next.delete(playerMenu.playerId);
                } else {
                  next.add(playerMenu.playerId);
                }
                return next;
              });
            }}
            onMessage={() => setPanel("chat")}
            onClose={() => setPlayerMenu(null)}
          />
        ) : null}
      </AnimatePresence>

      <div className="pointer-events-none relative z-10 flex min-h-dvh flex-col">
        <header className="pointer-events-auto flex items-start justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-2">
            {/* Avatar + name — one tap target, highlights on hover */}
            <button
              type="button"
              onClick={() => setPanel(panel === "dealer" ? "none" : "dealer")}
              aria-label={`${dealerName} — dealer page`}
              className="group -ml-1.5 flex min-w-0 items-center gap-2.5 rounded-full py-1 pl-1.5 pr-4 text-left transition hover:bg-white/10 active:bg-white/14"
            >
              <DealerAvatar
                size={44}
                ring={feedStatus === "live" ? "live" : "soft"}
                className="transition group-hover:scale-[1.04] group-hover:brightness-110"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2 py-[3px] text-[9px] tracking-[0.2em] uppercase">
                    <span
                      className={`size-1.5 rounded-full ${feedStatus === "live" ? "bg-destructive" : "bg-white/30"}`}
                    />
                    {feedStatus === "live" ? "Live" : "Cam"}
                  </span>
                  <span className="text-[10px] tracking-[0.28em] text-white/60 uppercase">
                    Blackjack
                  </span>
                </span>
                <h1 className="mt-0.5 whitespace-nowrap font-display text-[22px] leading-none text-white drop-shadow transition group-hover:text-[#f0c43a]">
                  {dealerName}
                </h1>
              </span>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              data-drawer-toggle="deposit"
              onClick={() => setPanel("wallet")}
              aria-label="Balance"
              className={`inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold tabular-nums text-white/90 ${
                panel === "wallet" ? "bg-white/20" : "bg-black/35 hover:bg-black/50"
              }`}
            >
              ${formatMoney(balance)}
            </button>

            <IconButton
              label="Chat"
              active={panel === "chat"}
              onClick={() => setPanel(panel === "chat" ? "none" : "chat")}
            >
              <MessageSquare className="size-[17px]" strokeWidth={1.5} />
            </IconButton>

            <IconButton
              label="Atmosphere"
              active={panel === "settings"}
              onClick={() => setPanel(panel === "settings" ? "none" : "settings")}
            >
              <SlidersHorizontal className="size-[17px]" strokeWidth={1.5} />
            </IconButton>
          </div>
        </header>
      </div>

      <WinConfetti active={Boolean(won)} big={result?.outcome === "blackjack"} />

      {isMobile ? <RotateHint /> : null}

      {/* Ghost composer — opens the side chat */}
      <button
        type="button"
        onClick={() => setPanel("chat")}
        className="absolute bottom-[max(0.9rem,env(safe-area-inset-bottom))] left-3 z-30 inline-flex h-9 items-center gap-2 rounded-full border border-white/12 bg-black/35 pl-3 pr-4 text-[12px] text-white/55 backdrop-blur-md transition hover:bg-black/55 hover:text-white/80"
      >
        <PenLine className="size-3.5" strokeWidth={1.75} />
        Write in chat
      </button>

      {/* Missions — floating, bottom-right */}
      <MissionsButton
        book={missions}
        active={panel === "rewards"}
        onClick={() => setPanel(panel === "rewards" ? "none" : "rewards")}
      />
    </main>

    <PanelDock
      open={panelOpen}
      side={isMobile ? "bottom" : "right"}
      size={tallPanel ? "tall" : "default"}
    >
      <WalletDrawer
        docked
        open={panel === "wallet"}
        onOpenChange={(open) => setPanel(open ? "wallet" : "none")}
        balance={balance}
      />
      <AtmosphereDrawer
        docked
        open={panel === "settings"}
        onOpenChange={(open) => setPanel(open ? "settings" : "none")}
        settings={settings}
        onChange={updateSettings}
      />
      <MissionsDrawer
        docked
        open={panel === "rewards"}
        onOpenChange={(open) => setPanel(open ? "rewards" : "none")}
        book={missions}
        unlocks={unlocks}
        onClaim={(mission, buttonEl) => {
          claimMission(mission.id);
          const amount = mission.reward.kind === "cashback" ? mission.reward.amount : 0;
          const unlockLabel =
            mission.reward.kind === "cashback" ? undefined : mission.reward.label;
          claimReward({
            missionId: mission.id,
            missionTitle: mission.title,
            amount,
            unlockLabel,
          });
          unlockAudio();
          fireClaimConfetti(buttonEl);
          window.setTimeout(() => {
            if (loopVoice) {
              void speakRewardCongrats({
                name: localPlayer?.displayName,
                missionTitle: mission.title,
                amount,
                unlockLabel,
              });
            } else {
              pushBeyBeat(`reward-${mission.id}-${Date.now()}`, "player_win", {
                name: localPlayer?.displayName ?? profileName,
              });
            }
          }, 450);
        }}
      />
      {state?.dealer.profile ? (
        <DealerDrawer
          docked
          open={panel === "dealer"}
          onOpenChange={(open) => setPanel(open ? "dealer" : "none")}
          profile={state.dealer.profile}
          live={feedStatus === "live"}
          following={following}
          balance={balance}
          onFollow={(next) => {
            setFollowing(next);
            follow(next);
          }}
          onTip={(amount) => {
            tip(amount);
            signalMission({ type: "tip", amount });
            if (loopVoice) {
              void speakTipThanks({
                name: localPlayer?.displayName,
                amount,
              });
            } else {
              pushBeyBeat(`tip-${amount}-${Date.now()}`, "tip", {
                name: localPlayer?.displayName ?? profileName,
                amount,
              });
            }
          }}
        />
      ) : null}
      <ChatDrawer
        docked
        open={panel === "chat"}
        onOpenChange={(open) => setPanel(open ? "chat" : "none")}
        messages={chat}
        onSend={sendChat}
        dealerId={state?.dealer.id}
        onDealerTap={() => setPanel("dealer")}
      />
    </PanelDock>
    </div>
  );
}

/** Pill + wing buttons — lives inside the avatar Standee (same seat position). */
function SeatDock({
  seconds,
  urgent = false,
  caption,
  leading,
  trailing,
  children,
}: {
  seconds: number | null;
  urgent?: boolean;
  caption?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className="pointer-events-none relative z-20 flex flex-col items-center gap-1.5"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.16 } }}
      transition={{ type: "spring", stiffness: 460, damping: 30 }}
    >
      <div className="pointer-events-auto relative flex items-center justify-center">
        {leading ? (
          <div className="absolute right-[calc(100%+0.5rem)] top-1/2 flex -translate-y-1/2 items-center gap-2">
            {leading}
          </div>
        ) : null}
        <div
          className={`relative flex items-center rounded-full border bg-[#0d0d13] px-2.5 py-1.5 shadow-[0_14px_36px_rgba(0,0,0,0.6)] sm:px-3 sm:py-2 ${
            urgent ? "border-[#e04545]/70" : "border-white/15"
          }`}
        >
          {children}
          {seconds !== null ? (
            <span
              className={`absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full text-[10px] font-bold tabular-nums text-black shadow ${
                urgent ? "bg-[#e04545] text-white" : "bg-[#f0c43a]"
              }`}
            >
              {seconds}
            </span>
          ) : null}
        </div>
        {trailing ? (
          <div className="absolute left-[calc(100%+0.5rem)] top-1/2 flex -translate-y-1/2 items-center gap-2">
            {trailing}
          </div>
        ) : null}
      </div>
      {caption ? (
        <p className="whitespace-nowrap text-[10px] tabular-nums text-white/60 drop-shadow">
          {caption}
        </p>
      ) : null}
    </motion.div>
  );
}

/** Portrait phones only: the full table needs the wide shot. */
function RotateHint() {
  const [portrait, setPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const update = () => setPortrait(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  if (!portrait || dismissed) {
    return null;
  }
  return (
    <button
      type="button"
      onClick={() => setDismissed(true)}
      className="absolute right-3 top-[4.6rem] z-30 inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/45 px-2.5 py-1 text-[10px] text-white/70 backdrop-blur-md"
    >
      <RotateCcw className="size-3" strokeWidth={1.75} />
      Rotate for the full table
    </button>
  );
}

function DockButton({
  onClick,
  disabled,
  label,
  children,
  accent = false,
  pulse = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
  accent?: boolean;
  pulse?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`relative flex size-8 items-center justify-center rounded-full border shadow-[0_10px_24px_rgba(0,0,0,0.5)] disabled:opacity-30 sm:size-9 ${
        accent
          ? "border-[#3dce6a]/90 bg-[#2fbf5b] text-black hover:brightness-110"
          : "border-white/15 bg-[#0d0d13] text-white/80 hover:bg-white/10"
      } ${pulse && !disabled ? "animate-[dealr-confirm-pulse_1.6s_ease-in-out_infinite]" : ""}`}
    >
      {pulse && !disabled ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-[#2fbf5b]/45 animate-[dealr-confirm-ring_1.6s_ease-out_infinite]"
        />
      ) : null}
      <span className="relative z-[1]">{children}</span>
    </button>
  );
}

function IconButton({
  children,
  onClick,
  label,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex size-8 items-center justify-center rounded-full text-white/90 ${
        active ? "bg-white/20" : "bg-black/35 hover:bg-black/50"
      }`}
    >
      {children}
    </button>
  );
}

function handLabel(hand?: Hand | null): string | null {
  if (!hand || hand.cards.length === 0) {
    return null;
  }
  if (hand.isBust) {
    return "BUST";
  }
  if (hand.isBlackjack) {
    return "BJ";
  }
  return String(hand.total);
}

function cardLabel(card: Card): string {
  return `${card.rank}${card.suit?.[0] ?? ""}`;
}
