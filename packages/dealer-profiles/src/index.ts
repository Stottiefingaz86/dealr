import type { DealerProfile } from "@live-dealr/shared-types";
import { DEFAULT_DEALER_ID } from "@live-dealr/shared-types";

export const ISLA_NOIR: DealerProfile = {
  id: DEFAULT_DEALER_ID,
  displayName: "Isla Noir",
  bio: "Quiet hands. Precise game. Private-table energy.",
  followerCount: 18420,
  isLive: true,
  primaryGames: ["Blackjack"],
  schedule: [
    { day: "Wed", start: "18:00", end: "22:00" },
    { day: "Fri", start: "20:00", end: "01:00" },
    { day: "Sat", start: "20:00", end: "01:00" },
  ],
  tagline: "Blackjack · Private Table · Wed, Fri, Sat",
  highlights: [
    {
      id: "hl-1",
      title: "$4,200 on a split 8s — table went wild",
      kind: "video",
      thumbnailUrl: "/dealer/clip-3.jpg",
      duration: "0:48",
      views: 128400,
      age: "2d",
    },
    {
      id: "hl-2",
      title: "Three dealer busts in a row",
      kind: "short",
      thumbnailUrl: "/dealer/clip-75.jpg",
      duration: "0:21",
      views: 86100,
      age: "4d",
    },
    {
      id: "hl-3",
      title: "Back-to-back blackjacks for seat 5",
      kind: "video",
      thumbnailUrl: "/dealer/clip-12.jpg",
      duration: "1:12",
      views: 54200,
      age: "1w",
    },
    {
      id: "hl-4",
      title: "Saturday night, full table",
      kind: "photo",
      thumbnailUrl: "/dealer/clip-165.jpg",
      views: 31900,
      age: "1w",
    },
    {
      id: "hl-5",
      title: "Perfect shoe, Saturday",
      kind: "video",
      thumbnailUrl: "/dealer/clip-21.jpg",
      duration: "2:05",
      views: 212000,
      age: "2w",
    },
    {
      id: "hl-6",
      title: "When the whole table stands on 12",
      kind: "short",
      thumbnailUrl: "/dealer/clip-26.jpg",
      duration: "0:15",
      views: 44700,
      age: "3w",
    },
  ],
  recommendations: [
    { id: "rec-1", title: "Lightning Blackjack", provider: "Evolution", tag: "game_of_the_week", hue: 46 },
    { id: "rec-2", title: "Speed Baccarat", provider: "Evolution", tag: "hot", hue: 350 },
    { id: "rec-3", title: "Crazy Time", provider: "Evolution", hue: 280 },
    { id: "rec-4", title: "Infinite Blackjack", provider: "Evolution", tag: "new", hue: 200 },
  ],
};

export function getDemoDealer(): DealerProfile {
  return ISLA_NOIR;
}
