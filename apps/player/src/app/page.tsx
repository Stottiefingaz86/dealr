"use client";

import { useState } from "react";
import { TableExperience } from "@/components/table-experience";
import { StartScreen, type StartProfile } from "@/components/start-screen";

export default function HomePage() {
  const [profile, setProfile] = useState<StartProfile | null>(null);

  if (!profile) {
    return <StartScreen onEnter={setProfile} />;
  }

  // Name/photo first; TableExperience holds the shoe until Isla is live.
  return (
    <TableExperience
      playerName={profile.name}
      avatarUrl={profile.avatarUrl}
      skipJoinGreet
    />
  );
}
