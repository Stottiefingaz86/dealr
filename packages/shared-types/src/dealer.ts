export interface DealerSchedule {
  day: string;
  start: string;
  end: string;
}

export type DealerHighlightKind = "video" | "short" | "photo";

export interface DealerHighlight {
  id: string;
  title: string;
  thumbnailUrl?: string;
  kind?: DealerHighlightKind;
  /** e.g. "0:42" for clips */
  duration?: string;
  views?: number;
  /** Relative age label, e.g. "2d" */
  age?: string;
}

export interface DealerRecommendation {
  id: string;
  title: string;
  provider: string;
  tag?: "game_of_the_week" | "new" | "hot";
  /** CSS hue used for the placeholder tile art */
  hue: number;
}

export interface DealerProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  followerCount: number;
  isLive: boolean;
  primaryGames: string[];
  schedule?: DealerSchedule[];
  highlights?: DealerHighlight[];
  recommendations?: DealerRecommendation[];
  /** Short tagline shown under the name on her page */
  tagline?: string;
}
