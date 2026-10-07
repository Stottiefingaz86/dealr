"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Real-time green-screen keyer. Draws a <video> through a WebGL shader that
 * knocks out the key colour (with edge softening + despill) onto a canvas.
 * Works for a file, a MediaStream, or an HLS/WebRTC playback element.
 */

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2((a_pos.x + 1.0) * 0.5, 1.0 - (a_pos.y + 1.0) * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
uniform sampler2D u_tex;
uniform vec3 u_key;        // key colour RGB 0..1 (used to pick the dominant channel)
uniform float u_similarity; // green-dominance where the key starts (keeps neutrals opaque)
uniform float u_smoothness; // ramp width to fully transparent
uniform float u_spill;      // despill strength 0..1
varying vec2 v_uv;

void main() {
  vec4 src = texture2D(u_tex, v_uv);
  vec3 c = src.rgb;

  // Dominance key: how much more "key" than the other two channels a pixel is.
  // Neutral tones (white shirt, grey, skin) score ~0, so they stay fully opaque;
  // only genuinely green pixels are cut. Far more stable than chroma distance.
  float keyDom = c.g - max(c.r, c.b);
  float alpha = 1.0 - smoothstep(u_similarity, u_similarity + u_smoothness, keyDom);
  // Tighten the ramp so hair edges stay crisp instead of mushy
  alpha = alpha * alpha * (3.0 - 2.0 * alpha);

  // Despill: clamp green to the other channels on fringes, keep brightness
  float spill = max(keyDom, 0.0);
  float luma = dot(c, vec3(0.299, 0.587, 0.114));
  c.g -= spill * u_spill;
  float luma2 = dot(c, vec3(0.299, 0.587, 0.114));
  c += (luma - luma2) * 0.8;

  gl_FragColor = vec4(c * alpha, alpha);
}`;

export interface ChromaKeyOptions {
  /** Key colour as RGB 0..255 (default: studio green). */
  key?: [number, number, number];
  similarity?: number;
  smoothness?: number;
  spill?: number;
}

export function ChromaKeyVideo({
  videoRef,
  className = "",
  style,
  options,
  active = true,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  className?: string;
  style?: React.CSSProperties;
  options?: ChromaKeyOptions;
  active?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const opts = {
    key: options?.key ?? [52, 205, 48],
    similarity: options?.similarity ?? 0.05,
    smoothness: options?.smoothness ?? 0.2,
    spill: options?.spill ?? 0.95,
  };
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !active) {
      return;
    }
    const gl = canvas.getContext("webgl", {
      premultipliedAlpha: true,
      alpha: true,
      antialias: false,
    });
    if (!gl) {
      return;
    }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    const uKey = gl.getUniformLocation(prog, "u_key");
    const uSim = gl.getUniformLocation(prog, "u_similarity");
    const uSmooth = gl.getUniformLocation(prog, "u_smoothness");
    const uSpill = gl.getUniformLocation(prog, "u_spill");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    let raf = 0;
    let vfc = 0;
    let disposed = false;

    const render = () => {
      if (disposed) {
        return;
      }
      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          gl.viewport(0, 0, canvas.width, canvas.height);
        }
        const o = optsRef.current;
        gl.uniform3f(uKey, o.key[0] / 255, o.key[1] / 255, o.key[2] / 255);
        gl.uniform1f(uSim, o.similarity);
        gl.uniform1f(uSmooth, o.smoothness);
        gl.uniform1f(uSpill, o.spill);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    };
    const draw = () => {
      render();
      if (!disposed) {
        schedule();
      }
    };

    const hasVfc = "requestVideoFrameCallback" in video;
    const schedule = () => {
      if (hasVfc) {
        vfc = (
          video as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => number }
        ).requestVideoFrameCallback(draw);
      } else {
        raf = requestAnimationFrame(draw);
      }
    };
    // Repaint on resume / seek so a paused frame is never left stale
    const onPlaying = () => render();
    video.addEventListener("loadeddata", onPlaying);
    video.addEventListener("seeked", onPlaying);

    schedule();

    return () => {
      disposed = true;
      video.removeEventListener("loadeddata", onPlaying);
      video.removeEventListener("seeked", onPlaying);
      cancelAnimationFrame(raf);
      if ("cancelVideoFrameCallback" in video && vfc) {
        (
          video as HTMLVideoElement & {
            cancelVideoFrameCallback: (id: number) => void;
          }
        ).cancelVideoFrameCallback(vfc);
      }
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, [videoRef, active]);

  return <canvas ref={canvasRef} className={className} style={style} aria-hidden />;
}
