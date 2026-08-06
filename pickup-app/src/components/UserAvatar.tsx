import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { avatarPalette } from "../utils";

interface Props {
  username: string;
  idx?: number;
  size?: number;
  fontSize?: number;
}

// Cache in memory to avoid repeated fetches
const avatarCache: Record<string, string | null> = {};

export default function UserAvatar({ username, idx = 0, size = 32, fontSize = 13 }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(() => {
    // Check localStorage first
    const cached = localStorage.getItem(`runit_avatar_${username}`);
    if (cached) { avatarCache[username] = cached; return cached; }
    return avatarCache[username] ?? null;
  });

  useEffect(() => {
    if (photoUrl || avatarCache[username] === null) return;
    // Fetch from Supabase
    supabase.from("user_profiles").select("avatar_url")
      .eq("username", username).maybeSingle()
      .then(({ data }) => {
        const url = data?.avatar_url ?? null;
        avatarCache[username] = url;
        if (url) {
          localStorage.setItem(`runit_avatar_${username}`, url);
          setPhotoUrl(url);
        } else {
          avatarCache[username] = null;
        }
      });
  }, [username]);

  const [bg, color] = avatarPalette(idx);

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={username}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0,
          border: "1.5px solid var(--border)",
        }}
        onError={() => setPhotoUrl(null)}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize, fontWeight: 700,
    }}>
      {username[0]?.toUpperCase()}
    </div>
  );
}
