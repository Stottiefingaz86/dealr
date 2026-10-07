import { DEFAULT_TABLE_ID } from "@live-dealr/shared-types";

export type DealerVideoSourceKind = "stream-url" | "offline" | "placeholder";

export interface TableMediaSession {
  tableId: string;
  live: boolean;
  /** Public playback URL for players (HLS / MP4 / CDN). Never a player webcam. */
  playbackUrl: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

export type MediaSessionListener = (session: TableMediaSession) => void;

function defaultPlaybackUrl(): string | null {
  const url =
    process.env.DEALER_PLAYBACK_URL?.trim() ||
    process.env.NEXT_PUBLIC_DEALER_STREAM_URL?.trim() ||
    "";
  return url || null;
}

export class TableMediaService {
  private session: TableMediaSession = {
    tableId: DEFAULT_TABLE_ID,
    live: false,
    playbackUrl: null,
    startedAt: null,
    endedAt: null,
  };
  private readonly listeners = new Set<MediaSessionListener>();

  getSession(tableId = DEFAULT_TABLE_ID): TableMediaSession {
    return { ...this.session, tableId };
  }

  goLive(input?: { tableId?: string; playbackUrl?: string | null }): TableMediaSession {
    const playbackUrl = input?.playbackUrl?.trim() || defaultPlaybackUrl();
    this.session = {
      tableId: input?.tableId ?? DEFAULT_TABLE_ID,
      live: true,
      playbackUrl,
      startedAt: new Date().toISOString(),
      endedAt: null,
    };
    this.emit();
    return this.getSession();
  }

  endLive(tableId = DEFAULT_TABLE_ID): TableMediaSession {
    this.session = {
      ...this.session,
      tableId,
      live: false,
      endedAt: new Date().toISOString(),
    };
    this.emit();
    return this.getSession();
  }

  subscribe(listener: MediaSessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    const snapshot = this.getSession();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

export const tableMedia = new TableMediaService();
