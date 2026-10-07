/** Local profile for friends table (name + optional avatar data URL). */

const NAME_KEY = "dealr.profile.name";
const AVATAR_KEY = "dealr.profile.avatar";

export function loadProfile(): { name: string; avatarUrl: string | null } {
  if (typeof window === "undefined") return { name: "", avatarUrl: null };
  try {
    return {
      name: window.localStorage.getItem(NAME_KEY) ?? "",
      avatarUrl: window.localStorage.getItem(AVATAR_KEY),
    };
  } catch {
    return { name: "", avatarUrl: null };
  }
}

export function saveProfile(name: string, avatarUrl: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NAME_KEY, name.trim());
    if (avatarUrl) window.localStorage.setItem(AVATAR_KEY, avatarUrl);
    else window.localStorage.removeItem(AVATAR_KEY);
  } catch {
    /* quota / private mode */
  }
}

/** Resize + compress a photo to a small JPEG data URL for PeerJS. */
export function compressAvatarFile(file: File, maxSide = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

export function parseGameId(raw: string): string {
  const trimmed = raw.trim();
  try {
    if (trimmed.includes("://") || trimmed.startsWith("/")) {
      const u = new URL(trimmed, typeof window !== "undefined" ? window.location.origin : "http://localhost");
      const fromQuery = u.searchParams.get("g") ?? u.searchParams.get("room") ?? "";
      if (fromQuery) return sanitizeGameId(fromQuery);
    }
  } catch {
    /* fall through */
  }
  return sanitizeGameId(trimmed);
}

export function sanitizeGameId(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function gameLink(gameId: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/real/?g=${sanitizeGameId(gameId)}`;
}
