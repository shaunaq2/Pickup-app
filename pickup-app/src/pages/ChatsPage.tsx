import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Game } from "../types";
import { getSport, formatDate, formatTime } from "../utils";
import Avatar from "../components/Avatar";
import ChatPage from "./ChatPage";

interface ChatRoom {
  game_id: number;
  created_at: string;
  expires_at: string;
  kept: boolean;
}

interface LastMessage {
  content: string;
  username: string;
  created_at: string;
}

interface ChatEntry {
  game: Game;
  room: ChatRoom;
  lastMessage: LastMessage | null;
  unread: boolean;
}

interface Props {
  games: Game[];
  username: string;
  joinedIds: Set<number>;
  isHost: (id: number) => boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Track which chats have been "seen" in localStorage
function getSeenTimes(): Record<number, string> {
  try { return JSON.parse(localStorage.getItem("chat_seen") ?? "{}"); } catch { return {}; }
}
function markSeen(gameId: number) {
  const seen = getSeenTimes();
  seen[gameId] = new Date().toISOString();
  localStorage.setItem("chat_seen", JSON.stringify(seen));
}

export default function ChatsPage({ games, username, joinedIds, isHost }: Props) {
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [openGameId, setOpenGameId]   = useState<number | null>(null);

  // My games = joined or hosting
  const myGames = games.filter((g) => joinedIds.has(g.id) || isHost(g.id));

  useEffect(() => {
    if (myGames.length === 0) { setLoading(false); return; }
    let cancelled = false;

    async function load() {
      const gameIds = myGames.map((g) => g.id);

      // Fetch all chat rooms for my games
      const { data: rooms } = await supabase
        .from("chat_rooms")
        .select("*")
        .in("game_id", gameIds);

      if (!rooms || rooms.length === 0) {
        if (!cancelled) { setChatEntries([]); setLoading(false); }
        return;
      }

      const seen = getSeenTimes();

      // Fetch last message per room
      const entries: ChatEntry[] = [];
      for (const room of rooms) {
        const game = myGames.find((g) => g.id === room.game_id);
        if (!game) continue;

        // Skip expired rooms that aren't kept
        const expired = !room.kept && new Date(room.expires_at) < new Date();
        if (expired) continue;

        const { data: msgs } = await supabase
          .from("messages")
          .select("content, username, created_at")
          .eq("game_id", room.game_id)
          .order("created_at", { ascending: false })
          .limit(1);

        const lastMessage = msgs?.[0] ?? null;

        // Unread = last message is newer than when we last viewed this chat
        const seenAt = seen[room.game_id];
        const unread = !!lastMessage && lastMessage.username !== username &&
          (!seenAt || new Date(lastMessage.created_at) > new Date(seenAt));

        entries.push({ game, room, lastMessage, unread });
      }

      // Sort by last message time, most recent first
      entries.sort((a, b) => {
        const ta = a.lastMessage?.created_at ?? a.room.created_at ?? "";
        const tb = b.lastMessage?.created_at ?? b.room.created_at ?? "";
        return tb.localeCompare(ta);
      });

      if (!cancelled) { setChatEntries(entries); setLoading(false); }
    }

    load();
    return () => { cancelled = true; };
  }, [games, joinedIds]);

  const openGame = games.find((g) => g.id === openGameId) ?? null;

  if (openGame) {
    return (
      <ChatPage
        game={openGame}
        username={username}
        isHost={isHost(openGame.id)}
        onBack={() => {
          markSeen(openGame.id);
          setOpenGameId(null);
          // Refresh unread state
          setChatEntries((prev) =>
            prev.map((e) => e.game.id === openGame.id ? { ...e, unread: false } : e)
          );
        }}
      />
    );
  }

  if (loading) {
    return (
      <div style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", paddingTop: 48 }}>
        Loading chats...
      </div>
    );
  }

  if (chatEntries.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">💬</div>
        No active chats yet.
        <br />
        Join a game to start chatting with players.
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
        Messages
      </div>

      {chatEntries.map(({ game, room, lastMessage, unread }) => {
        const sport = getSport(game.sport);
        const expired = !room.kept && new Date(room.expires_at) < new Date();

        return (
          <div
            key={game.id}
            onClick={() => setOpenGameId(game.id)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 4px", cursor: "pointer",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {/* Sport icon as avatar */}
            <div style={{
              width: 52, height: 52, borderRadius: 16, flexShrink: 0,
              background: sport.bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, position: "relative",
            }}>
              {sport.icon.startsWith("img:")
                ? <img src={`/${sport.icon.replace("img:", "")}`} alt={sport.label} style={{ width: "70%", height: "70%", objectFit: "contain" }} />
                : sport.icon}
              {/* Unread dot */}
              {unread && (
                <div style={{
                  position: "absolute", top: 2, right: 2,
                  width: 12, height: 12, borderRadius: "50%",
                  background: "var(--green)",
                  border: "2px solid var(--bg)",
                }} />
              )}
            </div>

            {/* Chat info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <div style={{
                  fontWeight: unread ? 700 : 600, fontSize: 15,
                  color: "var(--text)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  maxWidth: "65%",
                }}>
                  {sport.label} · {game.city}
                </div>
                {lastMessage && (
                  <div style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>
                    {timeAgo(lastMessage.created_at)}
                  </div>
                )}
              </div>

              <div style={{
                fontSize: 13,
                color: unread ? "var(--text)" : "var(--text-3)",
                fontWeight: unread ? 600 : 400,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {expired ? (
                  <span style={{ color: "var(--text-3)", fontStyle: "italic" }}>Chat expired</span>
                ) : lastMessage ? (
                  `${lastMessage.username === username ? "You" : lastMessage.username}: ${lastMessage.content}`
                ) : (
                  <span style={{ fontStyle: "italic" }}>No messages yet — say hi!</span>
                )}
              </div>

              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                {formatDate(game.date)} · {formatTime(game.time)} · {game.players.length}/{game.spots} players
              </div>
            </div>

            {/* Unread badge */}
            {unread && (
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: "var(--green)", flexShrink: 0,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}