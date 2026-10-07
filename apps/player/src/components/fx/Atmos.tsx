"use client";

import { useEffect, useRef } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";

/**
 * One full-frame GPU atmosphere, many moods. Every mode is built on the same
 * domain-warped fbm engine so they share the painterly density of the fire:
 *
 *  flames  – wall of fire, hottest at the floor, smoky to the top edge
 *  embers  – the fire with its body removed: sparks drifting through the dark
 *  smoke   – slow dark liquid smoke, silk highlights
 *  nebula  – deep-space gas clouds, dust lanes, twinkling star field
 *  aurora  – curtains of light over a starry sky
 *  ink     – liquid marble with gold veins
 *  studio  – Hue room: a dark wall lit by smart light bars and a desk lightstrip
 */
export type AtmosMode = "flames" | "embers" | "smoke" | "nebula" | "aurora" | "ink" | "studio";

const MODE_INDEX: Record<AtmosMode, number> = {
  flames: 0,
  embers: 1,
  smoke: 2,
  nebula: 3,
  aurora: 4,
  ink: 5,
  studio: 6,
};

interface AtmosProps {
  mode?: AtmosMode;
  /** 0..360 base tint */
  hue?: number;
  intensity?: number;
  speed?: number;
  maxDpr?: number;
  targetFps?: number;
  /** Multiplier on internal render resolution; reflections can go much lower. */
  resolution?: number;
}

const vertex = `#version 300 es
precision highp float;
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uHue;
uniform float uIntensity;
uniform float uMode;
in vec2 vUv;
out vec4 fragColor;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = rot * p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

// Sparse twinkling points. density: fraction of cells that stay empty.
float stars(vec2 p, float density, float t) {
  vec2 cell = floor(p);
  vec2 f = fract(p) - 0.5;
  float h = hash(cell);
  float on = step(density, h);
  vec2 off = (vec2(hash(cell + 1.3), hash(cell + 7.1)) - 0.5) * 0.7;
  float d = length(f - off);
  float tw = 0.65 + 0.35 * sin(t * (1.5 + h * 4.0) + h * 50.0);
  return on * smoothstep(0.06 + 0.05 * h, 0.0, d) * tw * (0.4 + h * 0.6);
}

// Fire palette: black -> deep -> bright -> near-white core
vec3 firePalette(float t, float hue) {
  float h = hue / 360.0;
  vec3 deep = hsv2rgb(vec3(h, 0.95, 0.55));
  vec3 mid = hsv2rgb(vec3(h + 0.06, 0.9, 1.0));
  vec3 hot = hsv2rgb(vec3(h + 0.12, 0.35, 1.0));
  vec3 c = mix(vec3(0.0), deep, smoothstep(0.0, 0.35, t));
  c = mix(c, mid, smoothstep(0.3, 0.7, t));
  c = mix(c, hot, smoothstep(0.75, 1.0, t));
  return c;
}

void main() {
  vec2 uv = vUv;
  float aspect = iResolution.x / iResolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = iTime;
  int mode = int(uMode + 0.5);
  float hh = uHue / 360.0;
  vec3 outCol = vec3(0.0);

  if (mode == 0 || mode == 1) {
    // ============ FLAMES / EMBERS ============
    float embers = mode == 1 ? 1.0 : 0.0;
    vec2 q = vec2(fbm(p * 3.0 + vec2(0.0, -t * 1.1)), fbm(p * 3.0 + vec2(5.2, -t * 0.9)));
    vec2 r = vec2(fbm(p * 3.0 + 4.0 * q + vec2(1.7, 9.2 - t * 0.6)), fbm(p * 3.0 + 4.0 * q + vec2(8.3, 2.8 - t * 0.8)));
    float n = fbm(p * 3.0 + 3.0 * r + vec2(0.0, -t * 1.6));

    float heightFalloff = 1.0 - 0.6 * smoothstep(0.05, 1.0, uv.y);
    float flame = pow(clamp(n * heightFalloff * 1.9, 0.0, 1.0), 1.35);
    vec3 col = firePalette(flame, uHue);
    float haze = (0.18 + 0.32 * n) * (0.55 + 0.45 * heightFalloff);
    col += firePalette(0.38, uHue) * haze;

    float sparks = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float scale = 14.0 + fi * 9.0;
      vec2 sp = vec2(p.x * scale + fi * 7.3, (uv.y + t * (0.08 + fi * 0.05)) * scale);
      sp.x += sin(uv.y * 6.0 + t * (0.6 + fi * 0.2) + fi) * 0.6;
      vec2 cell = floor(sp);
      vec2 f = fract(sp) - 0.5;
      float h = hash(cell);
      float on = step(0.93 - embers * 0.05, h);
      vec2 off = (vec2(hash(cell + 1.3), hash(cell + 7.1)) - 0.5) * 0.6;
      float d = length(f - off);
      float twinkle = 0.6 + 0.4 * sin(t * (3.0 + h * 5.0) + h * 40.0);
      float life = 1.0 - 0.7 * smoothstep(0.2, 1.0, uv.y);
      sparks += on * smoothstep(0.12, 0.0, d) * twinkle * life * (0.5 + h);
    }
    vec3 sparkCol = firePalette(0.85, uHue) * sparks * (1.2 + embers * 1.2);
    outCol = mix(col, vec3(0.0), embers) + sparkCol;
    outCol += embers * firePalette(0.3, uHue) * (0.05 + 0.1 * n) * (0.4 + 0.6 * heightFalloff);
  } else if (mode == 2) {
    // ============ SMOKE ============
    vec2 flow = vec2(t * 0.05, -t * 0.08);
    vec2 q = vec2(fbm(p * 2.0 + flow), fbm(p * 2.0 + vec2(5.2, 1.3) + flow * 0.8));
    vec2 r = vec2(fbm(p * 2.0 + 3.0 * q + vec2(1.7, 9.2) + flow * 0.5), fbm(p * 2.0 + 3.0 * q + vec2(8.3, 2.8) - flow * 0.4));
    float n = fbm(p * 2.0 + 3.5 * r);
    vec3 dark = hsv2rgb(vec3(hh, 0.6, 0.07));
    vec3 mid = hsv2rgb(vec3(hh, 0.45, 0.34));
    vec3 light = hsv2rgb(vec3(hh + 0.03, 0.25, 0.68));
    vec3 c = mix(dark, mid, smoothstep(0.25, 0.85, n));
    c = mix(c, light, smoothstep(0.65, 1.0, n) * 0.7);
    c += light * pow(clamp(length(r) - 0.6, 0.0, 1.0), 2.0) * 0.6;
    outCol = c;
  } else if (mode == 3) {
    // ============ NEBULA ============
    vec2 flow = vec2(t * 0.015, t * 0.01);
    vec2 q = vec2(fbm(p * 1.6 + flow), fbm(p * 1.6 + vec2(5.2, 1.3) - flow));
    vec2 r = vec2(fbm(p * 1.6 + 4.0 * q + vec2(1.7, 9.2)), fbm(p * 1.6 + 4.0 * q + vec2(8.3, 2.8)));
    float n = fbm(p * 1.6 + 4.0 * r);
    float n2 = fbm(p * 3.2 - 2.0 * r + vec2(3.1, 7.7));
    vec3 a = hsv2rgb(vec3(hh, 0.85, 0.75));
    vec3 b = hsv2rgb(vec3(hh + 0.14, 0.8, 0.8));
    vec3 core = hsv2rgb(vec3(hh - 0.08, 0.55, 1.0));
    vec3 c = vec3(0.01, 0.01, 0.02);
    c += a * smoothstep(0.35, 0.8, n) * 0.95;
    c += b * smoothstep(0.45, 0.9, n2) * 0.7;
    c += core * pow(smoothstep(0.6, 1.0, n * n2 * 2.0), 2.0) * 0.8;
    c *= 0.6 + 0.4 * smoothstep(0.2, 0.6, fbm(p * 2.5 + r));
    float s = stars(p * 40.0, 0.96, t) + stars(p * 18.0 + vec2(3.3), 0.985, t) * 1.6;
    c += vec3(0.9, 0.95, 1.0) * s;
    outCol = c;
  } else if (mode == 4) {
    // ============ AURORA ============
    vec2 cp = vec2(p.x * 1.4 + t * 0.04, uv.y * 0.35);
    vec2 q = vec2(fbm(cp * 2.0 + vec2(0.0, t * 0.05)), fbm(cp * 2.0 + vec2(5.2, -t * 0.04)));
    float n = fbm(cp * 3.0 + 3.0 * q);
    float ribbon = fbm(vec2(p.x * 0.9 + t * 0.06, t * 0.03));
    float horizon = 0.42 + (ribbon - 0.5) * 0.5;
    float band = smoothstep(horizon - 0.05, horizon + 0.08, uv.y) * (1.0 - smoothstep(horizon + 0.15, horizon + 0.65, uv.y));
    float curtain = pow(clamp(n * 1.5, 0.0, 1.0), 2.2) * band;
    vec3 low = hsv2rgb(vec3(hh, 0.9, 0.95));
    vec3 high = hsv2rgb(vec3(hh + 0.22, 0.8, 0.85));
    vec3 c = mix(low, high, smoothstep(horizon, horizon + 0.5, uv.y)) * curtain * 1.7;
    c += low * 0.1 * band;
    float s = stars(p * 45.0, 0.965, t);
    c += vec3(0.85, 0.9, 1.0) * s * (1.0 - curtain);
    c += vec3(0.012, 0.015, 0.035);
    outCol = c;
  } else if (mode == 5) {
    // ============ INK ============
    vec2 flow = vec2(t * 0.04, t * 0.03);
    vec2 q = vec2(fbm(p * 2.2 + flow), fbm(p * 2.2 + vec2(5.2, 1.3) - flow));
    vec2 r = vec2(fbm(p * 2.2 + 5.0 * q + vec2(1.7, 9.2) + flow), fbm(p * 2.2 + 5.0 * q + vec2(8.3, 2.8) - flow));
    float n = fbm(p * 2.2 + 5.0 * r);
    vec3 c1 = hsv2rgb(vec3(hh, 0.9, 0.55));
    vec3 c2 = hsv2rgb(vec3(hh + 0.1, 0.8, 0.95));
    vec3 c3 = hsv2rgb(vec3(hh - 0.12, 0.7, 0.9));
    vec3 gold = vec3(1.0, 0.86, 0.55);
    vec3 c = mix(vec3(0.02), c1, smoothstep(0.2, 0.55, n));
    c = mix(c, c2, smoothstep(0.5, 0.8, n));
    c = mix(c, c3, smoothstep(0.55, 0.95, q.x * q.y * 3.0));
    float vein = pow(1.0 - abs(fract(n * 6.0 + r.x * 2.0) * 2.0 - 1.0), 14.0);
    c += gold * vein * 0.55;
    outCol = c;
  } else {
    // ============ STUDIO (Hue room) ============
    // A dark wall lit only by smart lights: two Play bars, a lightstrip under the desk,
    // and a wash lamp behind the dealer. Soft exponential falloff, slow colour drift.
    float wallN = fbm(p * 5.0);
    vec3 c = vec3(0.012, 0.012, 0.018) * (0.8 + 0.4 * wallN);

    float drift = t * 0.025;
    // Light bars: capsule sources with gradient colour top->bottom
    vec2 barL = vec2(aspect * 0.14, 0.52);
    vec2 barR = vec2(aspect * 0.86, 0.52);
    float barH = 0.11;
    for (int i = 0; i < 2; i++) {
      vec2 b = i == 0 ? barL : barR;
      float side = i == 0 ? 0.0 : 1.0;
      vec2 d = p - b;
      float seg = clamp(d.y / barH, -1.0, 1.0);
      float dist = length(vec2(d.x, d.y - seg * barH));
      float hueAlong = hh + drift + side * 0.22 + (seg + 1.0) * 0.07;
      vec3 col = hsv2rgb(vec3(hueAlong, 0.8, 1.0));
      float core = smoothstep(0.012, 0.004, dist);
      float wash = exp(-dist * 4.5) * 0.55 + exp(-dist * 1.6) * 0.22;
      c += col * (core * 1.3 + wash * (0.85 + 0.3 * wallN));
    }

    // Lightstrip under the desk — horizontal gradient line, blooms up the wall
    float stripY = 0.335;
    float stripD = abs(uv.y - stripY);
    float stripX = smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.92, uv.x);
    vec3 stripCol = hsv2rgb(vec3(hh + drift + 0.5 + uv.x * 0.25, 0.75, 1.0));
    float stripCore = smoothstep(0.006, 0.0, stripD) * stripX;
    float stripWash = exp(-stripD * 9.0) * 0.5 * stripX * step(stripY, uv.y);
    c += stripCol * (stripCore * 1.2 + stripWash);

    // Wash lamp behind the dealer, breathing slowly
    float breathe = 0.85 + 0.15 * sin(t * 0.5);
    vec2 lampP = vec2(aspect * 0.5, 0.78);
    float lampD = length((p - lampP) * vec2(0.8, 1.2));
    vec3 lampCol = hsv2rgb(vec3(hh + drift + 0.1, 0.65, 1.0));
    c += lampCol * exp(-lampD * 2.2) * 0.32 * breathe * (0.85 + 0.3 * wallN);

    // Thin light leak along the ceiling line
    float ceil = exp(-abs(uv.y - 0.985) * 40.0);
    c += hsv2rgb(vec3(hh + drift + uv.x * 0.2, 0.7, 1.0)) * ceil * 0.5;

    outCol = c;
  }

  outCol *= uIntensity;
  float alpha = clamp(max(max(outCol.r, outCol.g), outCol.b) * 1.4, 0.0, 1.0);
  fragColor = vec4(outCol, alpha);
}
`;

export default function Atmos({
  mode = "flames",
  hue = 18,
  intensity = 1,
  speed = 1,
  maxDpr = 1.25,
  targetFps = 30,
  resolution = 1,
}: AtmosProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        webgl: 2,
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
        dpr: Math.min(window.devicePixelRatio || 1, maxDpr),
      });
    } catch {
      return;
    }
    const gl = renderer.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.display = "block";
    el.appendChild(canvas);

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uHue: { value: hue },
        uIntensity: { value: intensity },
        uMode: { value: MODE_INDEX[mode] },
      },
      transparent: true,
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    // Studio has crisp lines, so it gets more internal resolution than the soft noise modes.
    const renderScale = (mode === "studio" ? 0.85 : 0.6) * resolution;
    const resize = () => {
      renderer.setSize(el.clientWidth * renderScale, el.clientHeight * renderScale);
      // ogl writes px sizes onto the canvas style; stretch it back over the container
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      const res = program.uniforms.iResolution?.value as Float32Array | undefined;
      if (res) {
        res[0] = gl.drawingBufferWidth;
        res[1] = gl.drawingBufferHeight;
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let raf = 0;
    let last = 0;
    const interval = 1000 / targetFps;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < interval) return;
      last = now;
      const timeU = program.uniforms.iTime;
      // Absolute clock so a second instance (the table reflection) stays in sync with this one.
      if (timeU) timeU.value = (now / 1000) * speed;
      renderer.render({ scene: mesh });
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (canvas.parentNode === el) el.removeChild(canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [mode, hue, intensity, speed, maxDpr, targetFps, resolution]);

  return <div ref={containerRef} className="size-full" />;
}
