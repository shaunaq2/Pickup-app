import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Game } from "../types";
import { getSport, formatDate, formatTime } from "../utils";
import Avatar from "../components/Avatar";

interface ChatMessage {
  id: number;
  game_id: number;
  username: string;
  content: string;
  created_at: string;
}

interface ChatRoom {
  game_id: number;
  expires_at: string;
  kept: boolean;
}

interface Props {
  game: Game;
  username: string;
  isHost: boolean;
  onBack: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatExpiry(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export default function ChatPage({ game, username, isHost, onBack }: Props) {
  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [room, setRoom]             = useState<ChatRoom | null>(null);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [extending, setExtending]   = useState(false);
  const bottomRef                   = useRef<HTMLDivElement>(null);
  const inputRef                    = useRef<HTMLInputElement>(null);
  const sport                       = getSport(game.sport);

  const gameStart = new Date(`${game.date}T${game.time}`);
  const correctExpiry = new Date(gameStart.getTime() + 24 * 60 * 60 * 1000);
  const expired = room ? (!room.kept && new Date() > correctExpiry) : false;

  useEffect(() => {
    let cancelled = false;
    async function init() {
      let { data: existingRoom } = await supabase
        .from("chat_rooms").select("*").eq("game_id", game.id).maybeSingle();

      if (!existingRoom) {
        // Set expires_at to 24hrs after the game starts, not 24hrs from now
        const gameStart = new Date(`${game.date}T${game.time}`);
        const expiresAt = new Date(gameStart.getTime() + 24 * 60 * 60 * 1000).toISOString();
        const { data: newRoom } = await supabase
          .from("chat_rooms").insert({ game_id: game.id, expires_at: expiresAt }).select().single();
        existingRoom = newRoom;
      }

      if (!cancelled && existingRoom) {
        setRoom(existingRoom);
        const msLeft = correctExpiry.getTime() - Date.now();
        if (isHost && !existingRoom.kept && msLeft < 3600000) setShowPrompt(true);
      }

      const { data: msgs } = await supabase
        .from("messages").select("*").eq("game_id", game.id)
        .order("created_at", { ascending: true });

      if (!cancelled) { setMessages(msgs ?? []); setLoading(false); }
    }
    init();
    return () => { cancelled = true; };
  }, [game.id, isHost]);

  useEffect(() => {
    const channel = supabase.channel(`chat-full:${game.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `game_id=eq.${game.id}`,
      }, (payload) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === (payload.new as ChatMessage).id)) return prev;
          return [...prev, payload.new as ChatMessage];
        });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [game.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending || expired) return;
    setSending(true);
    setInput("");
    await supabase.from("messages").insert({ game_id: game.id, username, content: text });
    setSending(false);
    inputRef.current?.focus();
  }

  async function handleKeep() {
    setExtending(true);
    await supabase.from("chat_rooms").update({ kept: true }).eq("game_id", game.id);
    setRoom((r) => r ? { ...r, kept: true } : r);
    setShowPrompt(false);
    setExtending(false);
  }

  async function handleDelete() {
    await supabase.from("messages").delete().eq("game_id", game.id);
    await supabase.from("chat_rooms").delete().eq("game_id", game.id);
    onBack();
  }

  // Group consecutive messages by same sender
  function renderMessages() {
    return messages.map((msg, i) => {
      const isMe    = msg.username === username;
      const prev    = messages[i - 1];
      const grouped = prev && prev.username === msg.username;

      return (
        <div key={msg.id} style={{
          display: "flex", flexDirection: isMe ? "row-reverse" : "row",
          alignItems: "flex-end", gap: 8,
          marginTop: grouped ? 2 : 10,
          padding: "0 16px",
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
        <button onClick={onBack} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 22, color: "var(--text-2)", padding: "0 4px", lineHeight: 1,
        }}>←</button>

        <div style={{
          width: 38, height: 38, borderRadius: 10, background: sport.bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, flexShrink: 0,
        }}>
          {sport.icon.startsWith("img:")
            ? <img src={`/${sport.icon.replace("img:", "")}`} alt={sport.label} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            : sport.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {sport.label} · {game.city}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>
            {formatDate(game.date)} · {formatTime(game.time)} · {game.players.length} players
          </div>
        </div>

        {room && !room.kept && !expired && (
          <div style={{ fontSize: 10, color: "var(--text-3)", background: "var(--surface-2,#f0f0f0)", borderRadius: 6, padding: "3px 7px", flexShrink: 0 }}>
            ⏱ {formatExpiry(correctExpiry.toISOString())}
          </div>
        )}
        {room?.kept && <div style={{ fontSize: 10, color: "var(--green)", fontWeight: 600, flexShrink: 0 }}>✓ Saved</div>}
      </div>

      {/* Expiry prompt */}
      {showPrompt && !expired && (
        <div style={{
          background: "#fff8e1", borderBottom: "1px solid #ffe082",
          padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, color: "#795548" }}>⏳ Chat expires soon — keep it?</span>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={handleDelete} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, border: "1px solid #ef9a9a", background: "#fff", color: "#c62828", cursor: "pointer" }}>Delete</button>
            <button onClick={handleKeep} disabled={extending} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, border: "none", background: "var(--green)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
              {extending ? "..." : "Keep"}
            </button>
          </div>
        </div>
      )}

      {/* Expired banner */}
      {expired && (
        <div style={{
          background: "#fce4ec", borderBottom: "1px solid #f48fb1",
          padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, color: "#880e4f" }}>This chat has expired.</span>
          {isHost && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleDelete} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, border: "1px solid #f48fb1", background: "#fff", color: "#880e4f", cursor: "pointer" }}>Delete</button>
              <button onClick={handleKeep} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, border: "none", background: "var(--green)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Keep</button>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", paddingTop: 12, paddingBottom: 8, display: "flex", flexDirection: "column" }}>
        {loading ? (
          <div style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", marginTop: 40 }}>Loading...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: 60 }}>
            <div style={{ fontSize: 36 }}>💬</div>
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
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } }}
          disabled={expired}
          placeholder={expired ? "Chat has expired" : "Message..."}
          style={{
            flex: 1, border: "1.5px solid var(--border-mid)", borderRadius: 22,
            padding: "10px 14px", fontSize: 14, fontFamily: "inherit",
            outline: "none", background: expired ? "var(--surface)" : "var(--bg)",
            color: "var(--text)",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending || expired}
          style={{
            width: 40, height: 40, borderRadius: "50%", border: "none", flexShrink: 0,
            background: input.trim() && !expired ? "var(--green)" : "var(--border-mid)",
            color: "#fff", fontSize: 17, cursor: input.trim() && !expired ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s",
          }}
        >➤</button>
      </div>
    </div>
  );
}
