import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Game } from "../types";
import { getSport, formatDate, formatTime } from "../utils";
import Avatar from "../components/Avatar";
import ChatPage from "./ChatPage";

// ─── Types ────────────────────────────────────────────────

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

interface GameChatEntry {
  game: Game;
  room: ChatRoom;
  lastMessage: LastMessage | null;
  unread: boolean;
}

interface GroupChat {
  id: number;
  name: string;
  created_by: string;
  created_at: string;
  members: string[];
}

interface GroupMessage {
  id: number;
  group_id: number;
  username: string;
  content: string;
  created_at: string;
}

interface Props {
  games: Game[];
  username: string;
  joinedIds: Set<number>;
  isHost: (id: number) => boolean;
}

// ─── Helpers ─────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getSeenTimes(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem("chat_seen") ?? "{}"); } catch { return {}; }
}
function markSeen(key: string) {
  const seen = getSeenTimes();
  seen[key] = new Date().toISOString();
  localStorage.setItem("chat_seen", JSON.stringify(seen));
}

// ─── Group Chat View ──────────────────────────────────────

function GroupChatView({ group, username, onBack }: { group: GroupChat; username: string; onBack: () => void }) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("group_messages").select("*")
      .eq("group_id", group.id).order("created_at", { ascending: true })
      .then(({ data }) => { setMessages(data ?? []); setLoading(false); });
  }, [group.id]);

  useEffect(() => {
    const channel = supabase.channel(`group:${group.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "group_messages",
        filter: `group_id=eq.${group.id}`,
      }, (payload) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === (payload.new as GroupMessage).id)) return prev;
          return [...prev, payload.new as GroupMessage];
        });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [group.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    await supabase.from("group_messages").insert({ group_id: group.id, username, content: text });
    setSending(false);
    inputRef.current?.focus();
  }

  function renderMessages() {
    return messages.map((msg, i) => {
      const isMe    = msg.username === username;
      const prev    = messages[i - 1];
      const grouped = prev && prev.username === msg.username;
      return (
        <div key={msg.id} style={{
          display: "flex", flexDirection: isMe ? "row-reverse" : "row",
          alignItems: "flex-end", gap: 8,
          marginTop: grouped ? 2 : 10, padding: "0 16px",
        }}>
          <div style={{ width: 28, flexShrink: 0 }}>
            {!isMe && !grouped && (
              <Avatar name={msg.username} idx={msg.username.charCodeAt(0) % 6} size={28} fontSize={11} />
            )}
          </div>
          <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
            {!grouped && (
              <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 3, paddingLeft: isMe ? 0 : 2 }}>
                {isMe ? "You" : msg.username} · {timeAgo(msg.created_at)}
              </div>
            )}
            <div style={{
              background: isMe ? "var(--green)" : "var(--surface)",
              color: isMe ? "#fff" : "var(--text)",
              padding: "9px 13px",
              borderRadius: grouped
                ? (isMe ? "16px 4px 4px 16px" : "4px 16px 16px 4px")
                : (isMe ? "16px 4px 16px 16px" : "4px 16px 16px 16px"),
              fontSize: 14, lineHeight: 1.45, wordBreak: "break-word",
              border: isMe ? "none" : "1px solid var(--border-mid)",
            }}>
              {msg.content}
            </div>
          </div>
        </div>
      );
    });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg)", display: "flex", flexDirection: "column", zIndex: 200 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 16px", borderBottom: "1px solid var(--border)",
        background: "var(--surface)", flexShrink: 0,
      }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "var(--text-2)", padding: "0 4px" }}>←</button>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: "var(--surface)",
          border: "1.5px solid var(--border-mid)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0,
        }}>👥</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{group.name}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{group.members.length} members</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", paddingTop: 12, paddingBottom: 8, display: "flex", flexDirection: "column" }}>
        {loading ? (
          <div style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", marginTop: 40 }}>Loading...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: 60 }}>
            <div style={{ fontSize: 36 }}>👥</div>
            <div style={{ color: "var(--text-3)", fontSize: 13, marginTop: 8 }}>No messages yet. Say hi!</div>
          </div>
        ) : renderMessages()}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "10px 12px", borderTop: "1px solid var(--border)",
        background: "var(--surface)", display: "flex", gap: 8, alignItems: "center",
        flexShrink: 0, paddingBottom: "max(10px, env(safe-area-inset-bottom))",
      }}>
        <input ref={inputRef} value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
          placeholder="Message..."
          style={{
            flex: 1, border: "1.5px solid var(--border-mid)", borderRadius: 22,
            padding: "10px 14px", fontSize: 14, fontFamily: "inherit",
            outline: "none", background: "var(--bg)", color: "var(--text)",
          }}
        />
        <button onClick={send} disabled={!input.trim() || sending} style={{
          width: 40, height: 40, borderRadius: "50%", border: "none", flexShrink: 0,
          background: input.trim() ? "var(--green)" : "var(--border-mid)",
          color: "#fff", fontSize: 17, cursor: input.trim() ? "pointer" : "not-allowed",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.15s",
        }}>➤</button>
      </div>
    </div>
  );
}

// ─── Create Group Chat Modal ──────────────────────────────

function CreateGroupModal({ username, onCreated, onClose }: {
  username: string; onCreated: (g: GroupChat) => void; onClose: () => void;
}) {
  const [friends, setFriends]     = useState<string[]>([]);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating]   = useState(false);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    supabase.from("friendships").select("requester, recipient")
      .or(`requester.eq.${username},recipient.eq.${username}`)
      .eq("status", "accepted")
      .then(({ data }) => {
        const list = (data ?? []).map((r) =>
          r.requester === username ? r.recipient : r.requester
        );
        setFriends(list);
        setLoading(false);
      });
  }, [username]);

  function toggle(f: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(f) ? n.delete(f) : n.add(f);
      return n;
    });
  }

  async function create() {
    if (!groupName.trim() || selected.size === 0) return;
    setCreating(true);
    const members = [username, ...Array.from(selected)];
    const { data } = await supabase.from("group_chats").insert({
      name: groupName.trim(),
      created_by: username,
      members,
    }).select().single();
    if (data) onCreated({ ...data, members });
    setCreating(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "flex-end", zIndex: 300,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: "100%", background: "var(--bg)", borderRadius: "20px 20px 0 0",
        padding: "20px 16px 32px", maxHeight: "80vh", overflowY: "auto",
      }}>
        <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text)", marginBottom: 16 }}>New group chat</div>

        <input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Group name..."
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 12,
            border: "1.5px solid var(--border-mid)", background: "var(--surface)",
            color: "var(--text)", fontSize: 14, outline: "none",
            fontFamily: "inherit", boxSizing: "border-box", marginBottom: 14,
          }}
        />

        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
          Add friends
        </div>

        {loading ? (
          <div style={{ color: "var(--text-3)", fontSize: 13, padding: "12px 0" }}>Loading friends...</div>
        ) : friends.length === 0 ? (
          <div style={{ color: "var(--text-3)", fontSize: 13, padding: "12px 0" }}>No friends yet — add friends first.</div>
        ) : (
          friends.map((f) => (
            <div key={f} onClick={() => toggle(f)} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 12, marginBottom: 8, cursor: "pointer",
              background: selected.has(f) ? "rgba(0,200,120,0.08)" : "var(--surface)",
              border: `1.5px solid ${selected.has(f) ? "var(--green)" : "var(--border-mid)"}`,
            }}>
              <Avatar name={f} idx={f.charCodeAt(0) % 6} size={34} fontSize={13} />
              <div style={{ flex: 1, fontWeight: 600, fontSize: 14, color: "var(--text)" }}>@{f}</div>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                background: selected.has(f) ? "var(--green)" : "transparent",
                border: `2px solid ${selected.has(f) ? "var(--green)" : "var(--border-mid)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 13,
              }}>
                {selected.has(f) && "✓"}
              </div>
            </div>
          ))
        )}

        <button
          onClick={create}
          disabled={!groupName.trim() || selected.size === 0 || creating}
          style={{
            width: "100%", marginTop: 16, padding: "13px", borderRadius: 12,
            border: "none", fontFamily: "inherit", fontWeight: 700, fontSize: 15,
            cursor: !groupName.trim() || selected.size === 0 ? "not-allowed" : "pointer",
            background: !groupName.trim() || selected.size === 0 ? "var(--border-mid)" : "var(--green)",
            color: "#fff", transition: "background 0.15s",
          }}
        >
          {creating ? "Creating..." : `Create group${selected.size > 0 ? ` (${selected.size + 1})` : ""}`}
        </button>
      </div>
    </div>
  );
}

// ─── Main ChatsPage ───────────────────────────────────────

export default function ChatsPage({ games, username, joinedIds, isHost }: Props) {
  const [gameEntries, setGameEntries]   = useState<GameChatEntry[]>([]);
  const [groupChats, setGroupChats]     = useState<GroupChat[]>([]);
  const [groupLastMsg, setGroupLastMsg] = useState<Record<number, LastMessage | null>>({});
  const [loading, setLoading]           = useState(true);
  const [openGameId, setOpenGameId]     = useState<number | null>(null);
  const [openGroup, setOpenGroup]       = useState<GroupChat | null>(null);
  const [showCreate, setShowCreate]     = useState(false);
  const [tab, setTab]                   = useState<"games" | "groups">("games");

  const myGames = games.filter((g) => joinedIds.has(g.id) || isHost(g.id));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const seen = getSeenTimes();

      // Load game chats
      if (myGames.length > 0) {
        const gameIds = myGames.map((g) => g.id);
        const { data: rooms } = await supabase.from("chat_rooms").select("*").in("game_id", gameIds);
        const entries: GameChatEntry[] = [];
        for (const room of rooms ?? []) {
          const game = myGames.find((g) => g.id === room.game_id);
          if (!game) continue;
          if (!room.kept && new Date(room.expires_at) < new Date()) continue;
          const { data: msgs } = await supabase.from("messages").select("content, username, created_at")
            .eq("game_id", room.game_id).order("created_at", { ascending: false }).limit(1);
          const lastMessage = msgs?.[0] ?? null;
          const seenAt = seen[`game_${room.game_id}`];
          const unread = !!lastMessage && lastMessage.username !== username &&
            (!seenAt || new Date(lastMessage.created_at) > new Date(seenAt));
          entries.push({ game, room, lastMessage, unread });
        }
        entries.sort((a, b) => {
          const ta = a.lastMessage?.created_at ?? a.room.created_at ?? "";
          const tb = b.lastMessage?.created_at ?? b.room.created_at ?? "";
          return tb.localeCompare(ta);
        });
        if (!cancelled) setGameEntries(entries);
      }

      // Load group chats
      const { data: groups } = await supabase.from("group_chats").select("*")
        .contains("members", [username]);

      if (groups && !cancelled) {
        setGroupChats(groups);
        // Fetch last message per group
        const lastMsgs: Record<number, LastMessage | null> = {};
        for (const g of groups) {
          const { data: msgs } = await supabase.from("group_messages").select("content, username, created_at")
            .eq("group_id", g.id).order("created_at", { ascending: false }).limit(1);
          lastMsgs[g.id] = msgs?.[0] ?? null;
        }
        if (!cancelled) setGroupLastMsg(lastMsgs);
      }

      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [games, joinedIds, username]);

  const openGame = games.find((g) => g.id === openGameId) ?? null;

  if (openGame) {
    return (
      <ChatPage game={openGame} username={username} isHost={isHost(openGame.id)}
        onBack={() => { markSeen(`game_${openGame.id}`); setOpenGameId(null);
          setGameEntries((prev) => prev.map((e) => e.game.id === openGame.id ? { ...e, unread: false } : e));
        }} />
    );
  }

  if (openGroup) {
    return (
      <GroupChatView group={openGroup} username={username}
        onBack={() => { markSeen(`group_${openGroup.id}`); setOpenGroup(null); }} />
    );
  }

  if (loading) {
    return <div style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", paddingTop: 48 }}>Loading chats...</div>;
  }

  const totalGameChats  = gameEntries.length;
  const totalGroupChats = groupChats.length;

  return (
    <div>
      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["games", "groups"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "9px 0", borderRadius: 10,
            border: "1.5px solid",
            borderColor: tab === t ? "var(--green)" : "var(--border-mid)",
            background: tab === t ? "var(--green)" : "var(--surface)",
            color: tab === t ? "#fff" : "var(--text-2)",
            fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}>
            {t === "games"
              ? `🏟 Games${totalGameChats > 0 ? ` (${totalGameChats})` : ""}`
              : `👥 Groups${totalGroupChats > 0 ? ` (${totalGroupChats})` : ""}`}
          </button>
        ))}
      </div>

      {/* Game chats */}
      {tab === "games" && (
        <>
          {gameEntries.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">💬</div>
              No active game chats yet.<br />Join a game to start chatting.
            </div>
          ) : gameEntries.map(({ game, room, lastMessage, unread }) => {
            const sport = getSport(game.sport);
            return (
              <div key={game.id} onClick={() => setOpenGameId(game.id)} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 4px", cursor: "pointer",
                borderBottom: "1px solid var(--border)",
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                  background: sport.bg, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 26, position: "relative",
                }}>
                  {sport.icon.startsWith("img:")
                    ? <img src={`/${sport.icon.replace("img:", "")}`} alt={sport.label} style={{ width: "70%", height: "70%", objectFit: "contain" }} />
                    : sport.icon}
                  {unread && (
                    <div style={{ position: "absolute", top: 2, right: 2, width: 12, height: 12, borderRadius: "50%", background: "var(--green)", border: "2px solid var(--bg)" }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                    <div style={{ fontWeight: unread ? 700 : 600, fontSize: 15, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "65%" }}>
                      {sport.label} · {game.city}
                    </div>
                    {lastMessage && <div style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>{timeAgo(lastMessage.created_at)}</div>}
                  </div>
                  <div style={{ fontSize: 13, color: unread ? "var(--text)" : "var(--text-3)", fontWeight: unread ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {lastMessage
                      ? `${lastMessage.username === username ? "You" : lastMessage.username}: ${lastMessage.content}`
                      : <span style={{ fontStyle: "italic" }}>No messages yet</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                    {formatDate(game.date)} · {formatTime(game.time)} · {game.players.length}/{game.spots} players
                  </div>
                </div>
                {unread && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }} />}
              </div>
            );
          })}
        </>
      )}

      {/* Group chats */}
      {tab === "groups" && (
        <>
          <button onClick={() => setShowCreate(true)} style={{
            width: "100%", padding: "12px", borderRadius: 12, marginBottom: 14,
            border: "1.5px dashed var(--border-mid)", background: "transparent",
            color: "var(--green)", fontWeight: 700, fontSize: 14,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            + New group chat
          </button>

          {groupChats.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">👥</div>
              No group chats yet.<br />Create one with your friends.
            </div>
          ) : groupChats.map((g) => {
            const last = groupLastMsg[g.id];
            const seenAt = getSeenTimes()[`group_${g.id}`];
            const unread = !!last && last.username !== username &&
              (!seenAt || new Date(last.created_at) > new Date(seenAt));
            return (
              <div key={g.id} onClick={() => setOpenGroup(g)} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 4px", cursor: "pointer",
                borderBottom: "1px solid var(--border)",
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                  background: "var(--surface)", border: "1.5px solid var(--border-mid)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, position: "relative",
                }}>
                  👥
                  {unread && <div style={{ position: "absolute", top: 2, right: 2, width: 12, height: 12, borderRadius: "50%", background: "var(--green)", border: "2px solid var(--bg)" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                    <div style={{ fontWeight: unread ? 700 : 600, fontSize: 15, color: "var(--text)" }}>{g.name}</div>
                    {last && <div style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>{timeAgo(last.created_at)}</div>}
                  </div>
                  <div style={{ fontSize: 13, color: unread ? "var(--text)" : "var(--text-3)", fontWeight: unread ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {last
                      ? `${last.username === username ? "You" : last.username}: ${last.content}`
                      : <span style={{ fontStyle: "italic" }}>No messages yet</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{g.members.length} members</div>
                </div>
                {unread && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }} />}
              </div>
            );
          })}
        </>
      )}

      {showCreate && (
        <CreateGroupModal
          username={username}
          onCreated={(g) => { setGroupChats((prev) => [g, ...prev]); setShowCreate(false); setOpenGroup(g); }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
