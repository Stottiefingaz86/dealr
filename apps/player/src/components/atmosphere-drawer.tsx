"use client";

import { ChevronLeft, Pause, Play } from "lucide-react";
import {
  BACKGROUND_EFFECTS,
  HUE_PRESETS,
  TABLE_EFFECTS,
  type BackgroundEffectId,
  type PlayerEnvironmentSettings,
  type TableEffectId,
} from "@live-dealr/shared-types";
import { cn } from "@live-dealr/ui/lib/utils";
import { Drawer, DrawerContent, DrawerHandle } from "@/components/ui/drawer";
import { useDrawerDirection } from "@/hooks/use-mobile";
import { BackgroundEffectSwatch } from "@/components/layers/background-effects";
import { TableEffectSwatch } from "@/components/table-effect-swatch";
import { formatDuration, MUSIC_LIBRARY, toggleTrack, useMusic } from "@/lib/music";
import { sceneHue } from "@/lib/scene-hue";

export function AtmosphereDrawer({
  open,
  onOpenChange,
  settings,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: PlayerEnvironmentSettings;
  onChange: (patch: Partial<PlayerEnvironmentSettings>) => void;
}) {
  const direction = useDrawerDirection();
  const music = useMusic(settings.ambientVolume);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction={direction}
      shouldScaleBackground={false}
      dismissible={false}
      modal
    >
      <DrawerContent
        className={cn(
          "border-white/8 bg-[#121218]",
          direction === "bottom"
            ? "inset-x-0 bottom-0 h-[78dvh] max-h-[78dvh] rounded-t-[14px]"
            : "inset-y-0 right-0 h-full w-full max-w-sm border-l",
        )}
        onPointerDownOutside={(event) => {
          // Close only on intentional outside tap — not slider drag that leaves the sheet.
          if (event.detail?.originalEvent instanceof PointerEvent) {
            const pe = event.detail.originalEvent;
            if (pe.pointerType === "touch" || pe.buttons === 1) {
              // allow close on clean outside click
            }
          }
        }}
      >
        {direction === "bottom" ? <DrawerHandle /> : null}

        <header className="flex shrink-0 items-center gap-2 border-b border-white/8 px-4 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="-ml-1 flex size-9 items-center justify-center rounded-full hover:bg-white/8"
            aria-label="Close"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div>
            <h2 className="text-base font-semibold">Atmosphere</h2>
            <p className="text-[11px] text-white/40">Lighting, FX & music</p>
          </div>
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5"
          data-drawer-persist
          onPointerDown={(event) => event.stopPropagation()}
        >
          <section className="flex flex-col gap-4">
            <div>
              <p className="text-[11px] tracking-[0.22em] text-white/45 uppercase">Background FX</p>
              <p className="mt-1 text-sm text-white/55">Playable mood layers behind the dealer.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {BACKGROUND_EFFECTS.map((fx) => {
                const active = (settings.backgroundEffect ?? "none") === fx.id;
                return (
                  <button
                    key={fx.id}
                    type="button"
                    onClick={() => onChange({ backgroundEffect: fx.id as BackgroundEffectId })}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl border px-2 py-3",
                      active ? "border-white/35 bg-white/10" : "border-white/8 bg-white/[0.03]",
                    )}
                  >
                    <BackgroundEffectSwatch id={fx.id} />
                    <span className="text-[11px] text-white/70">{fx.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-8 flex flex-col gap-4">
            <div>
              <p className="text-[11px] tracking-[0.22em] text-white/45 uppercase">Table FX</p>
              <p className="mt-1 text-sm text-white/55">The living surface under the cards.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TABLE_EFFECTS.map((fx) => {
                const active = (settings.tableEffect ?? "aurora") === fx.id;
                return (
                  <button
                    key={fx.id}
                    type="button"
                    onClick={() => onChange({ tableEffect: fx.id as TableEffectId })}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl border px-2 py-3",
                      active ? "border-white/35 bg-white/10" : "border-white/8 bg-white/[0.03]",
                    )}
                  >
                    <TableEffectSwatch id={fx.id} hue={sceneHue(settings)} />
                    <span className="text-[11px] text-white/70">{fx.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-8 flex flex-col gap-4">
            <div>
              <p className="text-[11px] tracking-[0.22em] text-white/45 uppercase">Lighting</p>
              <p className="mt-1 text-sm text-white/55">
                Philips Hue–style wash over the dealer feed.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {HUE_PRESETS.map((preset) => {
                const active = Math.abs(settings.lightingHue - preset.hue) < 8;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onChange({ lightingHue: preset.hue })}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl border px-2 py-3",
                      active ? "border-white/35 bg-white/10" : "border-white/8 bg-white/[0.03]",
                    )}
                  >
                    <span
                      className="size-8 rounded-full shadow-[0_0_18px_rgba(255,255,255,0.15)]"
                      style={{
                        background: `radial-gradient(circle at 35% 30%, white, hsla(${preset.hue}, 90%, 55%, 1) 55%)`,
                      }}
                    />
                    <span className="text-[11px] text-white/70">{preset.label}</span>
                  </button>
                );
              })}
            </div>

            <label className="flex flex-col gap-2 text-sm" data-drawer-persist>
              <span className="flex items-center justify-between">
                Colour
                <span
                  className="size-4 rounded-full"
                  style={{ background: `hsl(${settings.lightingHue} 85% 55%)` }}
                />
              </span>
              <input
                type="range"
                min={0}
                max={360}
                value={settings.lightingHue}
                onChange={(event) => onChange({ lightingHue: Number(event.target.value) })}
                onPointerDown={(event) => event.stopPropagation()}
                className="hue-slider w-full"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm" data-drawer-persist>
              Brightness
              <input
                type="range"
                min={0.15}
                max={1}
                step={0.01}
                value={settings.lightingBrightness}
                onChange={(event) => onChange({ lightingBrightness: Number(event.target.value) })}
                onPointerDown={(event) => event.stopPropagation()}
              />
            </label>

            <label className="flex items-center justify-between text-sm">
              Soft pulse
              <input
                type="checkbox"
                checked={settings.lightingPulse}
                onChange={(event) => onChange({ lightingPulse: event.target.checked })}
              />
            </label>
          </section>

          <section className="mt-8 flex flex-col gap-4">
            <div>
              <p className="text-[11px] tracking-[0.22em] text-white/45 uppercase">Music</p>
              <p className="mt-1 text-sm text-white/55">
                Lounge and casino cuts to play under the table.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              {MUSIC_LIBRARY.map((track, i) => {
                const active = music.trackId === track.id;
                const playing = active && music.playing;
                const pct =
                  active && track.duration
                    ? Math.min(100, (music.position / track.duration) * 100)
                    : 0;
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => toggleTrack(track.id)}
                    className={cn(
                      "relative flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.05]",
                      i > 0 && "border-t border-white/6",
                      active && "bg-white/[0.06]",
                    )}
                  >
                    <span
                      className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                      style={{
                        background: `radial-gradient(circle at 30% 25%, hsl(${track.hue} 80% 60%), hsl(${track.hue} 60% 28%) 65%, hsl(${(track.hue + 40) % 360} 50% 14%))`,
                      }}
                    >
                      {playing ? (
                        <Pause className="size-4 fill-white text-white" />
                      ) : (
                        <Play className="ml-0.5 size-4 fill-white text-white" />
                      )}
                      {playing ? <Equalizer /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-[13px] font-medium",
                          active ? "text-white" : "text-white/85",
                        )}
                      >
                        {track.title}
                      </span>
                      <span className="block truncate text-[11px] text-white/45">{track.mood}</span>
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-white/40">
                      {active ? `${formatDuration(music.position)} / ` : null}
                      {formatDuration(track.duration)}
                    </span>
                    {active ? (
                      <span className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10">
                        <span className="block h-full bg-[#f0c43a]" style={{ width: `${pct}%` }} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="-mt-2 text-[10px] leading-relaxed text-white/30">
              Music by Kevin MacLeod (incompetech.com), CC BY 4.0.
            </p>

            <VolumeRow
              label="Music"
              value={settings.ambientVolume}
              onChange={(ambientVolume) => onChange({ ambientVolume })}
            />
            <VolumeRow
              label="Table sounds"
              hint="Chips, cards"
              value={settings.tableVolume}
              onChange={(tableVolume) => onChange({ tableVolume })}
            />
            <VolumeRow
              label="Social"
              hint="Reactions, throwables"
              value={settings.socialVolume}
              onChange={(socialVolume) => onChange({ socialVolume })}
            />

            <label className="flex items-center justify-between text-sm">
              Reduced motion
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(event) => onChange({ reducedMotion: event.target.checked })}
              />
            </label>
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Equalizer() {
  return (
    <span className="absolute bottom-1 right-1 flex items-end gap-[2px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[2px] rounded-sm bg-white"
          style={{
            height: 6,
            animation: `eq-bar 0.9s ease-in-out ${i * 0.15}s infinite alternate`,
          }}
        />
      ))}
    </span>
  );
}

function VolumeRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm" data-drawer-persist>
      <span className="flex items-center justify-between">
        <span>
          {label}
          {hint ? <span className="ml-2 text-[11px] text-white/35">{hint}</span> : null}
        </span>
        <span className="tabular-nums text-white/40">{Math.round(value * 100)}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerDown={(event) => event.stopPropagation()}
      />
    </label>
  );
}
