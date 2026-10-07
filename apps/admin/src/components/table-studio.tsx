"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_TABLE_LAYOUT,
  normalizeTableLayout,
  setLayoutSpot,
  type LayoutSpotId,
  type TableLayout,
} from "@live-dealr/environments";
import { API_URL, TABLE_ID } from "../lib/api";

const SPOTS: { id: LayoutSpotId; label: string; tone: string }[] = [
  { id: "dealer", label: "Dealer", tone: "#d7c4a3" },
  { id: "seat-1", label: "Seat 1", tone: "#6d4aff" },
  { id: "seat-2", label: "Seat 2", tone: "#2fbf6a" },
  { id: "seat-3", label: "Seat 3", tone: "#2fbf6a" },
  { id: "seat-4", label: "Seat 4", tone: "#2fbf6a" },
  { id: "seat-5", label: "Seat 5", tone: "#2fbf6a" },
  { id: "bet", label: "Bet pad", tone: "#f0c43a" },
];

export function TableStudio() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [layout, setLayout] = useState<TableLayout>(DEFAULT_TABLE_LAYOUT);
  const [devices, setDevices] = useState<{ deviceId: string; label: string }[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [dragging, setDragging] = useState<LayoutSpotId | null>(null);
  const [status, setStatus] = useState("Idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const applyLayout = useCallback((next: TableLayout) => {
    setLayout(normalizeTableLayout(next));
  }, []);

  useEffect(() => {
    void fetch(`${API_URL}/tables/${TABLE_ID}/layout`)
      .then((response) => (response.ok ? response.json() : DEFAULT_TABLE_LAYOUT))
      .then((data) => applyLayout(data))
      .catch(() => undefined);
  }, [applyLayout]);

  const connectCamera = useCallback(
    async (preferred?: string) => {
      setStatus("Opening camera…");
      try {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: preferred
            ? { deviceId: { exact: preferred }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        const all = await navigator.mediaDevices.enumerateDevices();
        const cameras = all
          .filter((device) => device.kind === "videoinput")
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${index + 1}`,
          }));
        setDevices(cameras);
        const active =
          preferred ||
          stream.getVideoTracks()[0]?.getSettings().deviceId ||
          cameras[0]?.deviceId ||
          "";
        setDeviceId(active);
        setStatus("Camera live");
      } catch (cause) {
        setStatus(cause instanceof Error ? cause.message : "Camera failed");
      }
    },
    [],
  );

  useEffect(() => {
    void connectCamera();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [connectCamera]);

  function moveToPointer(id: LayoutSpotId, clientX: number, clientY: number) {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const rect = stage.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    setLayout((current) => setLayoutSpot(current, id, { x, y }));
    setDirty(true);
  }

  async function save() {
    setStatus("Saving…");
    try {
      const response = await fetch(`${API_URL}/tables/${TABLE_ID}/layout`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(layout),
      });
      if (!response.ok) {
        throw new Error("Save failed");
      }
      const next = await response.json();
      applyLayout(next);
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString());
      setStatus("Layout saved — players will pick this up on refresh");
    } catch {
      setStatus("Could not save layout");
    }
  }

  function resetDefaults() {
    applyLayout(DEFAULT_TABLE_LAYOUT);
    setDirty(true);
  }

  return (
    <div className="flex min-h-dvh flex-col gap-4 bg-[#07070a] px-4 py-4 text-foreground lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.3em] text-primary uppercase">Admin</p>
          <h1 className="font-display text-4xl">Table studio</h1>
          <p className="mt-1 max-w-xl text-sm text-white/45">
            Align count badges and seats to your physical camera. Drag markers, then save.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-10 min-w-[180px] rounded-full border border-white/10 bg-black/40 px-3 text-sm"
            value={deviceId}
            onChange={(event) => {
              setDeviceId(event.target.value);
              void connectCamera(event.target.value);
            }}
          >
            {devices.length === 0 ? <option value="">No cameras</option> : null}
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={resetDefaults}
            className="h-10 rounded-full border border-white/15 px-4 text-sm text-white/70"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => void save()}
            className="h-10 rounded-full bg-white px-5 text-sm font-semibold text-black"
          >
            {dirty ? "Save layout" : "Saved"}
          </button>
        </div>
      </header>

      <p className="text-xs text-white/40">
        {status}
        {savedAt ? ` · last save ${savedAt}` : ""}
      </p>

      <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
        <div
          ref={stageRef}
          className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black"
          onPointerMove={(event) => {
            if (!dragging) {
              return;
            }
            moveToPointer(dragging, event.clientX, event.clientY);
          }}
          onPointerUp={() => setDragging(null)}
          onPointerLeave={() => setDragging(null)}
        >
          <video ref={videoRef} className="absolute inset-0 size-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/20" />

          {SPOTS.map((spot) => {
            const position =
              spot.id === "dealer"
                ? layout.dealer
                : spot.id === "bet"
                  ? layout.bet
                  : layout.seats[Number(spot.id.split("-")[1]) - 1];
            return (
              <button
                key={spot.id}
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  (event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
                  setDragging(spot.id);
                  moveToPointer(spot.id, event.clientX, event.clientY);
                }}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none active:cursor-grabbing"
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
              >
                <span
                  className="flex min-w-16 flex-col items-center rounded-full border px-3 py-2 text-[10px] tracking-[0.16em] uppercase backdrop-blur-md"
                  style={{
                    borderColor: `${spot.tone}88`,
                    background: "rgba(0,0,0,0.55)",
                    color: spot.tone,
                    boxShadow: dragging === spot.id ? `0 0 0 2px ${spot.tone}` : undefined,
                  }}
                >
                  {spot.label}
                  <span className="mt-0.5 font-display text-lg leading-none text-white">—</span>
                </span>
              </button>
            );
          })}
        </div>

        <aside className="rounded-2xl border border-white/10 bg-[#101017] p-4">
          <p className="text-[11px] tracking-[0.22em] text-white/40 uppercase">Markers</p>
          <ul className="mt-3 flex flex-col gap-2">
            {SPOTS.map((spot) => {
              const position =
                spot.id === "dealer"
                  ? layout.dealer
                  : spot.id === "bet"
                    ? layout.bet
                    : layout.seats[Number(spot.id.split("-")[1]) - 1];
              return (
                <li
                  key={spot.id}
                  className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm"
                >
                  <span style={{ color: spot.tone }}>{spot.label}</span>
                  <span className="tabular-nums text-white/40">
                    {Math.round(position.x)}% · {Math.round(position.y)}%
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-white/40">
            Seat 1 is the local player. Seats 2–5 stay empty until multi-seat is wired. Dealer marker
            should sit on the physical card landing zone in your feed.
          </p>
        </aside>
      </div>
    </div>
  );
}
