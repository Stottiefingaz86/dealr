"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, MessageSquare, PenLine, RotateCcw, SlidersHorizontal, Undo2 } from "lucide-react";
import {
  CHIP_VALUES,
  DEFAULT_PLAYER_ID,
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

type ActionBurst = { action: PlayerActionType; id: string };

/** Drop below the seat tag so trays clear the bet pad / cards. */
const BET_DOCK_DROP_PX = 72;
const ACTION_DOCK_DROP_PX = 64;

export type TableExperienceProps = {
  /** Override for live/friends tables where your id isn't the demo DEFAULT_PLAYER_ID. */
  playerId?: string;
  actions?: ReturnType<typeof useTableSocket>;
  /** Friends table handles its own join greets — skip the solo once-per-tab line. */
  skipJoinGreet?: boolean;
};

export function TableExperience({
  playerId: playerIdProp,
  actions,
  skipJoinGreet = false,
}: TableExperienceProps = {}) {
  const socketActions = useTableSocket({ enabled: !actions });
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
  const [feedStatus, setFeedStatus] = useState<FeedStatus>("idle");
  const dealerSources = process.env.NEXT_PUBLIC_DEALER_STREAM_URL
    ? [process.env.NEXT_PUBLIC_DEALER_STREAM_URL]
    : DEMO_DEALER_SOURCES;
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
    preloadDealerTalk();
    void preloadChipSfx();
    preloadRewardClaim();
    if (skipJoinGreet) return;
    playGoodEvening();
    const armVoice = () => {
      unlockAudio();
      playGoodEvening();
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
  const mainRef = useRef<HTMLElement>(null);
  const dealerVideoRef = useRef<HTMLVideoElement>(null);
  const reactions = useReactions();

  const seenHandVoice = useRef(new Set<string>());
  useEffect(() => {
    const me = usePlayerStore.getState().state?.players.find((p) => p.id === localPlayerId);
    for (const event of events) {
      if (event.type === "HAND_COMPLETED" && !seenHandVoice.current.has(event.id)) {
        seenHandVoice.current.add(event.id);
        // Only call the local player's finished hand — avoids a chorus of bot totals.
        const handId = event.payload.handId;
        const isMine = me?.hands.some((h) => h.id === handId);
        if (isMine || event.payload.owner === "dealer") {
          const { isBust, isBlackjack, total } = event.payload;
          const label = isBust ? "BUST" : isBlackjack ? "BJ" : String(total);
          void speakHandTotal(label);
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
  }, [events, localPlayerId]);

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

  // Dealer: "place your bets" every time betting opens
  const wasBetting = useRef(false);
  useEffect(() => {
    if (betting && !wasBetting.current) {
      playPlaceYourBets();
    }
    wasBetting.current = betting;
  }, [betting]);

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
      displayName: seated?.displayName ?? null,
      avatarUrl: seated?.avatarUrl,
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
      hideTag: isLocal && (betting || isMyTurn),
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

  return (
    <main ref={mainRef} className="relative min-h-dvh overflow-clip bg-black text-foreground">
      <EnvironmentLayer settings={settings} />
      <BackgroundEffects settings={settings} />
      <DealerVideoLayer
        sources={dealerSources}
        dealerName={dealerName}
        onStatusChange={setFeedStatus}
        videoRef={dealerVideoRef}
      />
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
        dealerVideoRef={dealerVideoRef}
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

      {/* Tray hangs under your seat pad — pill centred on the seat, sides wing out. */}
      <AnimatePresence mode="wait">
        {betting ? (
          <SeatDock
            key="bets-dock"
            spot={localSpot}
            dropPx={BET_DOCK_DROP_PX}
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
              size={isMobile ? 30 : 38}
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
          <SeatDock
            key="action-dock"
            spot={localSpot}
            dropPx={ACTION_DOCK_DROP_PX}
            seconds={actionRemaining}
            urgent={actionProgress < 0.3}
          >
            <ActionRing
              size="sm"
              available={state?.availableActions ?? []}
              onAction={(action) => sendAction(action)}
            />
          </SeatDock>
        ) : null}
      </AnimatePresence>

      <WinConfetti active={Boolean(won)} big={result?.outcome === "blackjack"} />

      <WalletDrawer
        open={panel === "wallet"}
        onOpenChange={(open) => setPanel(open ? "wallet" : "none")}
        balance={balance}
      />

      <AtmosphereDrawer
        open={panel === "settings"}
        onOpenChange={(open) => setPanel(open ? "settings" : "none")}
        settings={settings}
        onChange={updateSettings}
      />

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
      <MissionsDrawer
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
          // Sound comes from fireClaimConfetti → playRedeemSfx (once, soft).
          fireClaimConfetti(buttonEl);
          window.setTimeout(() => {
            void speakRewardCongrats({
              name: localPlayer?.displayName,
              missionTitle: mission.title,
              amount,
              unlockLabel,
            });
          }, 450);
        }}
      />

      {state?.dealer.profile ? (
        <DealerDrawer
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
            void speakTipThanks({
              name: localPlayer?.displayName,
              amount,
            });
          }}
        />
      ) : null}

      <ChatDrawer
        open={panel === "chat"}
        onOpenChange={(open) => setPanel(open ? "chat" : "none")}
        messages={chat}
        onSend={sendChat}
        dealerId={state?.dealer.id}
        onDealerTap={() => setPanel("dealer")}
      />
    </main>
  );
}

function SeatDock({
  spot,
  dropPx = ACTION_DOCK_DROP_PX,
  seconds,
  urgent = false,
  caption,
  leading,
  trailing,
  children,
}: {
  spot: { x: number; y: number };
  dropPx?: number;
  seconds: number | null;
  urgent?: boolean;
  caption?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Pill on the seat centre line; wings don't shift it. Clamp so we never clip
  // under the home indicator / missions row.
  const style = {
    left: `${spot.x}%`,
    top: `min(calc(${spot.y}% + ${dropPx}px), calc(100% - 5.25rem - env(safe-area-inset-bottom, 0px)))`,
    transform: "translate(-50%, -50%)",
  };

  return (
    <motion.div
      className="pointer-events-none absolute z-40 flex flex-col items-center gap-1.5"
      style={style}
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
