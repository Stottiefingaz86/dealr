/** Latest person-cutout canvas — reflection reuses this instead of a second MediaPipe. */

let canvas: HTMLCanvasElement | null = null;

export function publishCutoutCanvas(el: HTMLCanvasElement | null) {
  canvas = el;
}

export function getCutoutCanvas(): HTMLCanvasElement | null {
  return canvas;
}
