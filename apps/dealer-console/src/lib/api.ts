export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function detectCard(rank: string, suit: string) {
  const response = await fetch(`${API_URL}/dev/shoe/detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rank, suit }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Shoe detect failed");
  }
  return response.json();
}

export async function closeBetting() {
  const response = await fetch(`${API_URL}/tables/BJ-001/betting/close`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Unable to close betting");
  }
  return response.json();
}

export async function goLive(playbackUrl?: string | null) {
  const response = await fetch(`${API_URL}/tables/BJ-001/media/go-live`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playbackUrl }),
  });
  if (!response.ok) {
    throw new Error("Unable to go live");
  }
  return response.json();
}

export async function endLive() {
  const response = await fetch(`${API_URL}/tables/BJ-001/media/end`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Unable to end live");
  }
  return response.json();
}
