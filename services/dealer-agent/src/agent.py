"""
Dealr AI dealer — Beyond Presence + live table context.

LLM-led Isla: interesting, varied, table-wide. Anti-repeat baked in.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import time
from dataclasses import dataclass, field

import httpx
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentSession,
    AutoSubscribe,
    JobContext,
    RoomInputOptions,
    WorkerOptions,
    cli,
    utils,
)
from livekit.plugins import bey, openai

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))

logger = logging.getLogger("dealr-dealer")
logging.basicConfig(level=logging.INFO)

CONTEXT_BASE = os.environ.get("DEALR_CONTEXT_URL", "http://localhost:3000")
# Tight poll — acting seats change fast; don't lag a full second behind.
POLL_SECONDS = float(os.environ.get("DEALR_CONTEXT_POLL", "0.3"))
BEY_IDENTITY = "bey-avatar-agent"
# Chat / fluff only — game calls ignore this.
MIN_GAP_SEC = float(os.environ.get("DEALR_SPEAK_GAP", "2.8"))

ISLA_INTRO = "I'm Isla Noir, your dealer today."

ISLA_PERSONA = """
PERSONA — Isla Noir:
- Sweet, cheeky British blackjack dealer. Warm, friendly, a playful wink in the voice — never sexy or erotic.
- Call the game — names, totals, blackjack, busts, dealer twenty-one, winners.
- Finish every sentence. Never cut yourself off mid-line.
- House wins: soft sympathy — unlucky, I'm sorry about that — then move on.
- Light cheeky charm only. Never call anyone love/loves/darling/sweetheart.
- Short lines. No cringe quotes or sayings. No innuendo.
""".strip()

ISLA_INSTRUCTIONS = f"""
You are Isla Noir — live blackjack dealer on camera at Dealr.
{ISLA_PERSONA}

Hard rules:
- ONE short complete sentence. Sweet and cheeky — never sultry or erotic.
- Never invent cards/totals. Never say “You” as a player name.
- Never address players as love/loves/darling/sweetheart.
""".strip()

_TONE_BANK = [
    "Delivery: warm friendly smile, clear and complete.",
    "Delivery: sweet and cheeky — light playful giggle, finish the line.",
    "Delivery: bright host energy, kind and fun — not sultry.",
]

TTS_BASE = (
    "Voice: OpenAI sage — clear young British woman. "
    "Sweet, warm, lightly cheeky — never sexy, never breathy, never erotic. "
    "Finish every phrase cleanly. Not theatrical, not whispery, not bassy. "
)
TTS_CHEEKY = (
    TTS_BASE
    + "Playful cheeky sparkle — soft giggle, still wholesome and finish the sentence."
)

_ONES = (
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
)
_TENS = ("", "", "twenty", "thirty", "forty", "fifty")


def speak_number(n: int) -> str:
    if n < 20:
        return _ONES[n]
    if n < 60:
        tens, ones = divmod(n, 10)
        return _TENS[tens] if ones == 0 else f"{_TENS[tens]}-{_ONES[ones]}"
    return str(n)


def spoken_total(raw: object) -> str | None:
    """Turn hand labels into TTS-friendly words (19 → nineteen, BJ → blackjack)."""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    upper = s.upper()
    if upper in {"BJ", "BLACKJACK"}:
        return "blackjack"
    if upper == "BUST":
        return "bust"
    soft = "soft" in s.lower()
    m = re.search(r"\d+", s)
    if not m:
        return None
    words = speak_number(int(m.group()))
    return f"soft {words}" if soft else words


def total_value(raw: object) -> int | None:
    if raw is None:
        return None
    s = str(raw).strip().upper()
    if s in {"BJ", "BLACKJACK"}:
        return 21
    if s == "BUST":
        return None
    m = re.search(r"\d+", s)
    return int(m.group()) if m else None


@dataclass
class Watch:
    phase: str = ""
    acting: str = ""
    greeted: bool = False
    chat_seen: set[str] = field(default_factory=set)
    beat_seen: set[str] = field(default_factory=set)
    bet_clock_warned: bool = False
    action_clock_warned_for: str = ""
    recent_lines: list[str] = field(default_factory=list)
    last_spoke_at: float = 0.0
    tone_i: int = 0
    turn_i: int = 0
    color_i: int = 0


def pick_line(watch: Watch, options: list[str]) -> str:
    """Rotate presence lines so she doesn't sound stuck on one phrase."""
    watch.color_i += 1
    return options[watch.color_i % len(options)]


def first_name(name: str) -> str:
    return (name or "friend").strip().split()[0] or "friend"


def human_name(snap: dict) -> str:
    raw = str(snap.get("localName") or "").strip()
    name = first_name(raw)
    if not name or name.lower() == "you":
        for seat in snap.get("seats") or []:
            if seat.get("isLocal"):
                n = first_name(str(seat.get("name") or ""))
                if n and n.lower() != "you":
                    return n
        return "friend"
    return name


def clean_name(name: str, snap: dict) -> str:
    n = first_name(name)
    if n.lower() == "you":
        return human_name(snap)
    return n


def remember(watch: Watch, line: str) -> None:
    watch.recent_lines.append(line.strip().lower())
    if len(watch.recent_lines) > 10:
        watch.recent_lines = watch.recent_lines[-10:]


def banned_block(watch: Watch) -> str:
    if not watch.recent_lines:
        return ""
    listed = "; ".join(f"“{x}”" for x in watch.recent_lines[-6:])
    return (
        f"Do NOT reuse or closely paraphrase any of these recent lines: {listed}. "
        "Change wording, rhythm, and energy."
    )


_last_miss_log = 0.0


async def fetch_snapshot(room_name: str) -> dict | None:
    global _last_miss_log
    url = f"{CONTEXT_BASE.rstrip('/')}/api/bey/context?sessionId={room_name}"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.get(url)
            if res.status_code == 404:
                now = time.monotonic()
                if now - _last_miss_log > 8:
                    logger.info("waiting for table context at %s", url)
                    _last_miss_log = now
                return None
            res.raise_for_status()
            return res.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("context fetch failed: %s", exc)
        return None


def table_brief(snap: dict) -> str:
    lines = [
        f"Phase: {snap.get('phase') or 'unknown'}.",
        "Every seated player matters equally — do not centre the human.",
    ]
    acting = snap.get("actingName")
    if acting:
        lines.append(f"Acting now: {clean_name(str(acting), snap)}.")
    dealer_cards = " ".join(str(c) for c in (snap.get("dealerCards") or []))
    lines.append(f"Dealer: [{dealer_cards or 'no cards'}] total {snap.get('dealerTotal') or '—'}.")
    for seat in snap.get("seats") or []:
        name = seat.get("name") or f"Seat {seat.get('seat')}"
        cards = " ".join(str(c) for c in (seat.get("cards") or []))
        lines.append(
            f"{name}: bet ${seat.get('bet') or 0}, "
            f"cards [{cards or 'none'}], total {seat.get('total') or '—'}."
        )
    return "\n".join(lines)


def can_speak(watch: Watch) -> bool:
    return time.monotonic() - watch.last_spoke_at >= MIN_GAP_SEC


def next_tone(watch: Watch) -> str:
    watch.tone_i += 1
    return _TONE_BANK[watch.tone_i % len(_TONE_BANK)]


_CRINGE = (
    "shall we",
    "luck",
    "fortune",
    "dance",
    "tune",
    "darling fate",
    "as they say",
    "quote",
    "they say",
    "once said",
    "here's hoping",
    "fingers crossed for destiny",
)


def line_is_cringe(text: str) -> bool:
    low = text.lower()
    if any(x in low for x in _CRINGE):
        return True
    if '"' in text or "“" in text or "”" in text:
        return True
    # Never address the table as love/loves/darling/sweetheart.
    if re.search(r"\b(loves|darling|sweetheart)\b", low):
        return True
    if re.search(r"(,\s*love\b|\blove[,.!?]?\s*$)", low):
        return True
    return False


async def craft_line(
    watch: Watch,
    snap: dict,
    event: str,
    tone: str,
    *,
    max_words: int = 8,
) -> str | None:
    """Ask OpenAI for the exact spoken string so we can ban repeats."""
    brief = table_brief(snap)
    prompt = (
        f"{ISLA_PERSONA}\n\n"
        f"TABLE STATE (facts only):\n{brief}\n\n"
        f"EVENT: {event}\n\n"
        f"Write ONE spoken line as Isla (max {max_words} words). "
        "Sweet and cheeky — never sexy or erotic. Plain everyday words only. "
        "NO quotes, idioms, metaphors, puns, poems, or clever sayings. "
        "NO stage directions. Output the line alone. "
        f"{banned_block(watch)} "
        f"{tone}"
    )
    model = os.environ.get("DEALR_LLM_MODEL", "gpt-4o-mini")
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "temperature": 0.65,
                    "presence_penalty": 0.35,
                    "frequency_penalty": 0.4,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You write very short sweet dealer lines. "
                                "Plain speech only. Never quotes or sayings. Output the line alone."
                            ),
                        },
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            res.raise_for_status()
            data = res.json()
        text = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            or ""
        )
        text = " ".join(text.strip().strip('"').strip("'").split())
        if not text or line_is_cringe(text):
            return None
        low = text.lower()
        if low in watch.recent_lines:
            return None
        for prev in watch.recent_lines[-5:]:
            if len(prev) > 12 and (prev in low or low in prev):
                return None
        words = text.split()
        if len(words) > max_words + 2:
            text = " ".join(words[:max_words])
        return text
    except Exception as exc:  # noqa: BLE001
        logger.warning("craft_line failed: %s", exc)
        return None


async def speak_llm(
    session: AgentSession,
    watch: Watch,
    snap: dict,
    event: str,
    *,
    force: bool = False,
    max_words: int = 8,
    wait: bool = True,
) -> bool:
    """Craft + speak a chat/fluff line. wait=True so turn calls don't cut her off mid-answer."""
    if not force and not can_speak(watch):
        return False
    tone = next_tone(watch)
    try:
        session.tts = openai.TTS(
            model="gpt-4o-mini-tts",
            voice=os.environ.get("DEALR_TTS_VOICE", "sage"),
            instructions=TTS_BASE + " " + tone,
        )
    except Exception:  # noqa: BLE001
        pass

    line = await craft_line(watch, snap, event, tone, max_words=max_words)
    if line:
        return await speak_exact(session, watch, line, force=True, wait=wait)

    # Fallback: generate_reply if craft failed
    brief = table_brief(snap)
    hint = (
        f"{ISLA_PERSONA}\n\nTABLE STATE:\n{brief}\n\nEVENT: {event}\n\n"
        f"Speak ONE sweet cheeky line (max {max_words} words). Complete sentence. Not sexy. "
        f"{banned_block(watch)} {tone}"
    )
    try:
        await session.generate_reply(instructions=hint, allow_interruptions=False)
        watch.last_spoke_at = time.monotonic()
        remember(watch, event[:80])
        logger.info("reacted (fallback): %s", event[:100])
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("generate_reply failed: %s", exc)
        return False


async def speak_exact(
    session: AgentSession,
    watch: Watch,
    line: str,
    *,
    force: bool = False,
    tts: str | None = None,
    wait: bool = True,
) -> bool:
    """Speak a full line and (by default) wait until she finishes — no mid-sentence cuts."""
    if not force and not can_speak(watch):
        return False
    if line.strip().lower() in watch.recent_lines:
        return False
    if tts:
        try:
            session.tts = openai.TTS(
                model="gpt-4o-mini-tts",
                voice=os.environ.get("DEALR_TTS_VOICE", "sage"),
                instructions=tts,
            )
        except Exception:  # noqa: BLE001
            pass
    try:
        # allow_interruptions=False so the next call doesn't clip her mid-phrase.
        handle = session.say(line, allow_interruptions=False)
        watch.last_spoke_at = time.monotonic()
        remember(watch, line)
        logger.info("spoke: %s", line)
        if wait:
            try:
                await asyncio.wait_for(handle.wait_for_playout(), timeout=12.0)
            except Exception:  # noqa: BLE001
                pass
        return True
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        logger.warning("say failed: %s", msg)
        if "isn't running" in msg:
            raise
        return False


async def call_turn(session: AgentSession, watch: Watch, who: str, seat: dict | None) -> None:
    """Seat call — sweet, cheeky, complete; wait for the line to land."""
    raw_total = seat.get("total") if seat else None
    words = spoken_total(raw_total)
    value = total_value(raw_total)
    watch.turn_i += 1
    if words == "blackjack":
        line = f"{who}, blackjack — nice one."
    elif not words:
        line = f"{who}, you're up."
    elif value is not None and value < 21 and watch.turn_i % 3 == 0:
        line = f"{who}, {words}. Hit or stand?"
    else:
        line = f"{who}, {words}."
    await speak_exact(
        session,
        watch,
        line,
        force=True,
        wait=True,
        tts=TTS_BASE + " Clear dealer call, sweet and cheeky, finish cleanly.",
    )


def line_for_beat(kind: str, snap: dict, beat: dict, watch: Watch) -> str | None:
    """Short present dealer calls — sympathy when the house wins, heat when players win."""
    name = clean_name(str(beat.get("name") or ""), snap)
    names = [clean_name(str(n), snap) for n in (beat.get("names") or [])]
    if kind == "table_all_win":
        return pick_line(
            watch,
            [
                "Well done, everybody.",
                "Everyone wins — nice shoe.",
                "Table cleans up. Well played.",
            ],
        )
    if kind == "table_multi_win":
        group = join_names(names, snap)
        if group == "everybody":
            return pick_line(watch, ["Well done, everybody.", "Nice one, table."])
        return pick_line(
            watch,
            [
                f"Well done, {group}.",
                f"Nice hits, {group}.",
                f"{group} — that's how you do it.",
            ],
        )
    if kind == "table_dealer_wins":
        return pick_line(
            watch,
            [
                "Unlucky guys — dealer wins. Next time.",
                "Sorry not sorry — house takes it. Next hand.",
                "Dealer's hand. Unlucky — you'll get me next time.",
            ],
        )
    if kind == "player_bj":
        return pick_line(
            watch,
            [
                f"{name}, blackjack — well done.",
                f"Blackjack, {name}. Brilliant.",
                f"{name}, twenty-one natural. Nice one.",
            ],
        )
    if kind == "player_win":
        return pick_line(
            watch,
            [
                f"Well done, {name}.",
                f"That's yours, {name}.",
                f"Nice one, {name}.",
            ],
        )
    if kind == "player_bust":
        return pick_line(
            watch,
            [
                f"{name}, bust — unlucky.",
                f"Bust, {name}. I'm sorry about that.",
                f"{name}, over — next hand.",
            ],
        )
    if kind == "player_lose":
        return pick_line(
            watch,
            [
                f"Unlucky, {name}. I'm sorry about that.",
                f"Not this one, {name} — next hand.",
                f"Close, {name}. Unlucky.",
            ],
        )
    if kind == "player_push":
        return pick_line(
            watch,
            [
                f"Push, {name} — bets back.",
                f"{name}, push. Fair enough.",
            ],
        )
    if kind == "dealer_21":
        return pick_line(
            watch,
            [
                "Dealer twenty-one — unlucky guys. Next time.",
                "Twenty-one for the house. Sorry not sorry — next hand.",
                "Dealer has twenty-one. Tough one — you'll get me next time.",
            ],
        )
    if kind == "dealer_bust":
        return pick_line(
            watch,
            [
                "Dealer busts — that's yours.",
                "I'm over. Well done, table.",
                "Dealer bust. Come get it.",
            ],
        )
    if kind == "betting_open":
        return pick_line(
            watch,
            [
                "Place your bets.",
                "Fresh hand — chips down.",
                "Bets please — let's play.",
            ],
        )
    if kind == "tip":
        return pick_line(
            watch,
            [
                f"Thank you, {name} — that's kind.",
                f"You're too kind, {name}.",
                f"Thanks, {name}.",
            ],
        )
    if kind == "throw_dealer":
        return pick_line(
            watch,
            [
                "Hey — easy tiger.",
                "Cheeky. Eyes on the cards.",
                "Oi — I'm dealing here.",
            ],
        )
    return None


_BOT_CHAT = {"maya", "theo", "kai", "reno"}


def pending_chat(snap: dict, watch: Watch) -> list[tuple[str, str, str]]:
    """Human chats always; bot chats rarely — Isla shouldn't narrate the whole chat."""
    local = human_name(snap).lower()
    rows: list[tuple[str, str, str]] = []
    for row in snap.get("recentChat") or []:
        name = str(row.get("name") or "").strip()
        text = str(row.get("text") or "").strip()
        kind = str(row.get("kind") or "chat")
        is_local = bool(row.get("isLocal"))
        if not name or not text or kind in ("system", "follow", "tip"):
            continue
        if name.lower().startswith("isla"):
            continue
        fp = f"{name}:{text}".lower()[:140]
        if fp in watch.chat_seen:
            continue
        first = first_name(name).lower()
        is_bot = first in _BOT_CHAT or name.lower().startswith("bot-")
        is_human = is_local or first in {local, "you"} or not is_bot
        if is_bot and not is_human:
            # Mark most bot chat as seen without answering — reply to ~1 in 4.
            if hash(fp) % 4 != 0:
                mark_chat_seen(watch, fp)
                continue
        if is_human:
            rows.insert(0, (name, text, fp))
        else:
            rows.append((name, text, fp))
    return rows[:1]


def mark_chat_seen(watch: Watch, fp: str) -> None:
    watch.chat_seen.add(fp)
    if len(watch.chat_seen) > 50:
        watch.chat_seen = set(list(watch.chat_seen)[-25:])


def pending_beats(snap: dict, watch: Watch) -> list[dict]:
    out: list[dict] = []
    for beat in snap.get("beats") or []:
        bid = str(beat.get("id") or "")
        if not bid or bid in watch.beat_seen:
            continue
        watch.beat_seen.add(bid)
        if len(watch.beat_seen) > 80:
            watch.beat_seen = set(list(watch.beat_seen)[-40:])
        out.append(beat)
    out.sort(key=lambda b: 0 if str(b.get("kind", "")).startswith("table_") else 1)
    return out[:2]


def join_names(names: list[str], snap: dict) -> str:
    clean = [clean_name(str(n), snap) for n in names if n]
    clean = [n for n in clean if n.lower() != "you"]
    if not clean:
        return "everybody"
    if len(clean) >= 3:
        return "everybody"
    if len(clean) == 2:
        return f"{clean[0]} and {clean[1]}"
    return clean[0]


def is_player_participant(identity: str) -> bool:
    ident = (identity or "").lower()
    if not ident:
        return False
    if ident == BEY_IDENTITY or ident.startswith("bey-"):
        return False
    if ident.startswith("agent-"):
        return False
    return True


async def wait_for_bey_video(room: rtc.Room, timeout: float = 45.0) -> bool:
    try:
        await asyncio.wait_for(
            utils.wait_for_participant(room, identity=BEY_IDENTITY),
            timeout=timeout,
        )
        await asyncio.wait_for(
            utils.wait_for_track_publication(
                room,
                identity=BEY_IDENTITY,
                kind=rtc.TrackKind.KIND_VIDEO,
            ),
            timeout=timeout,
        )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("Bey video wait failed: %s", exc)
        return False


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_NONE)
    room_name = ctx.room.name
    logger.info("Isla in %s — LLM-varied British dealer", room_name)

    voice = os.environ.get("DEALR_TTS_VOICE", "sage")
    session = AgentSession(
        llm=openai.LLM(model=os.environ.get("DEALR_LLM_MODEL", "gpt-4o-mini")),
        tts=openai.TTS(
            model="gpt-4o-mini-tts",
            voice=voice,
            instructions=TTS_BASE + " " + _TONE_BANK[0],
        ),
    )
    agent = Agent(instructions=ISLA_INSTRUCTIONS)

    avatar_id = os.environ.get("BEY_AVATAR_ID")
    if not avatar_id:
        raise RuntimeError("BEY_AVATAR_ID is required")

    avatar = bey.AvatarSession(avatar_id=avatar_id)
    await avatar.start(session, room=ctx.room)
    await session.start(
        agent=agent,
        room=ctx.room,
        room_input_options=RoomInputOptions(
            audio_enabled=False,
            video_enabled=False,
            close_on_disconnect=False,
        ),
    )
    ready = await wait_for_bey_video(ctx.room, timeout=12.0)
    if not ready:
        logger.warning("Bey video slow — continuing; intro when a player is present")

    watch = Watch()

    async def deliver_intro() -> None:
        if watch.greeted:
            return
        watch.greeted = True
        await speak_exact(
            session,
            watch,
            ISLA_INTRO,
            force=True,
            tts=TTS_BASE + " Warm, charming intro — confident smile.",
        )

    def on_participant_connected(participant: rtc.RemoteParticipant) -> None:
        if is_player_participant(participant.identity):
            asyncio.create_task(deliver_intro())

    ctx.room.on("participant_connected", on_participant_connected)
    for p in ctx.room.remote_participants.values():
        if is_player_participant(p.identity):
            await deliver_intro()
            break

    while True:
        await asyncio.sleep(POLL_SECONDS)
        snap = await fetch_snapshot(room_name)
        if not snap:
            continue

        phase = str(snap.get("phase") or "")
        acting = str(snap.get("actingName") or "").strip()

        if phase and phase != watch.phase:
            prev = watch.phase
            watch.phase = phase
            watch.acting = ""
            # Keep energy between rounds — call betting open when the shoe resets.
            if phase == "betting" and prev and prev != "betting":
                line = line_for_beat("betting_open", snap, {}, watch)
                if line:
                    await speak_exact(session, watch, line, force=True, wait=True)
                    continue

        # Seat calls — finish the line before anything else.
        if acting and acting != watch.acting and phase not in ("betting", ""):
            who = clean_name(acting, snap)
            seat = next(
                (
                    s
                    for s in (snap.get("seats") or [])
                    if first_name(str(s.get("name") or "")).lower() == who.lower()
                ),
                None,
            )
            await call_turn(session, watch, who, seat)
            watch.acting = acting
            continue

        # Table moments — wait so sympathy/cheek lands fully.
        beat_done = False
        for beat in pending_beats(snap, watch):
            line = line_for_beat(str(beat.get("kind") or ""), snap, beat, watch)
            if line:
                await speak_exact(
                    session,
                    watch,
                    line,
                    force=True,
                    wait=True,
                    tts=TTS_BASE + " Sweet cheeky dealer, finish the sentence.",
                )
                beat_done = True
                break
        if beat_done:
            continue

        # Chat when the shoe isn't demanding a call.
        for name, text, fp in pending_chat(snap, watch):
            logger.info("chat from %s: %s", name, text[:80])
            who = clean_name(name, snap)
            about = any(
                w in text.lower()
                for w in ("yourself", "who are you", "about you", "your name", "tell us")
            )
            event = (
                f"{who} asked about you: {text!r}. "
                "One short sweet cheeky answer — say you're Isla Noir if asked. "
                "Complete sentence. Not sexy."
                if about
                else (
                    f"{who} said in table chat: {text!r}. "
                    "Reply briefly — sweet and cheeky. Answer them. Complete sentence. "
                    "No quotes. Not flirty-erotic."
                )
            )
            ok = await speak_llm(
                session,
                watch,
                snap,
                event,
                force=True,
                max_words=12 if about else 10,
                wait=True,
            )
            if not ok:
                ok = await speak_exact(
                    session,
                    watch,
                    f"I'm listening, {who} — say that again?",
                    force=True,
                    wait=True,
                )
            if ok:
                mark_chat_seen(watch, fp)
            break


def main() -> None:
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name="dealr-isla",
        )
    )


if __name__ == "__main__":
    main()
