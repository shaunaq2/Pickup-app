import React, { useEffect, useState, useRef } from "react";
import { Game, JoinRequest } from "../types";
import { getSport, formatDate, formatTime, spotsLeft, canWithdraw, withdrawalDeadline } from "../utils";
import { supabase } from "../lib/supabase";
import Avatar from "./Avatar";

interface Friend { username: string; }

const SKILL_LABEL: Record<string, string> = {
  all:          "All levels",
  beginner:     "Beginner",
  intermediate: "Intermediate",
  advanced:     "Advanced",
};

interface Message {
  id: number;
  game_id: number;
  username: string;
  content: string;
  created_at: string;
}

interface ChatRoom {
  game_id: number;
  created_at: string;
  expires_at: string;
  kept: boolean;
}

interface Props {
  game: Game;
  joined: boolean;
  isHost: boolean;
  hasRequested: boolean;
  balance: number;
  waitlisted: boolean;
  username: string;
  onJoin: () => void;
  onLeave: () => void;
  onRequest: () => void;
  onCancel: () => void;
  onJoinWaitlist: () => void;
  onLeaveWaitlist: () => void;
  onApprove: (name: string) => void;
  onDeny: (name: string) => void;
  onClose: () => void;
  onGoToWallet: () => void;
  onUnhost?: () => void;
}

function formatExpiry(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export default function GameModal({
  game, joined, isHost, hasRequested, balance, waitlisted, username,
  onJoin, onLeave, onRequest, onCancel, onJoinWaitlist, onLeaveWaitlist,
  onApprove, onDeny, onClose, onGoToWallet, onUnhost,
}: Props) {
  const [leaveConfirm, setLeaveConfirm]   = useState(false);
  const [unhostConfirm, setUnhostConfirm] = useState(false);
  const [activeTab, setActiveTab]         = useState<"details" | "chat">("details");
  const [messages, setMessages]           = useState<Message[]>([]);
  const [newMessage, setNewMessage]       = useState("");
  const [sending, setSending]             = useState(false);
  const [room, setRoom]                   = useState<ChatRoom | null>(null);
  const [roomLoading, setRoomLoading]     = useState(false);
  const [extending, setExtending]         = useState(false);
  const [showPrompt, setShowPrompt]       = useState(false);
  const [friends, setFriends]             = useState<Friend[]>([]);
  const [invitedIds, setInvitedIds]       = useState<Set<string>>(new Set());
  const [inviteLoading, setInviteLoading] = useState<string | null>(null);
  const [showInvite, setShowInvite]       = useState(false);
  const messagesEndRef                    = useRef<HTMLDivElement>(null);

  const sport        = getSport(game.sport);
  const full         = spotsLeft(game) === 0 && !joined;
  const isPrivate    = game.privacy === "private";
  const pending      = game.joinRequests.filter((r) => r.status === "pending");
  const canAfford    = balance >= game.costPerPlayer;
  const hasCost      = game.costPerPlayer > 0;
  const withdrawOk   = canWithdraw(game.date, game.time);
  const hasWaitlist  = game.waitlistMax > 0;
  const waitlistFull = game.waitlist.length >= game.waitlistMax;
  const deadline     = withdrawalDeadline(game.date, game.time);
  const canUnhost    = isHost && game.players.every((p) => p === game.host);
  const canChat      = joined || isHost;

  const chatExpired  = room ? (!room.kept && new Date(room.expires_at) < new Date()) : false;

  // Load or create chat room when chat tab opens
  useEffect(() => {
    if (activeTab !== "chat" || !canChat) return;
    let cancelled = false;

    async function initRoom() {
      setRoomLoading(true);
      let { data: existingRoom } = await supabase
        .from("chat_rooms")
        .select("*")
        .eq("game_id", game.id)
        .maybeSingle();

      if (!existingRoom) {
        const { data: newRoom } = await supabase
          .from("chat_rooms")
          .insert({ game_id: game.id })
          .select()
          .single();
        existingRoom = newRoom;
      }

      if (!cancelled && existingRoom) {
        setRoom(existingRoom);
        // Show keep/delete prompt if host and expiring within 1 hour
        const msLeft = new Date(existingRoom.expires_at).getTime() - Date.now();
        if (isHost && !existingRoom.kept && msLeft < 3600000) {
          setShowPrompt(true);
        }
      }
      if (!cancelled) setRoomLoading(false);
    }

    initRoom();
    return () => { cancelled = true; };
  }, [activeTab, game.id, canChat, isHost]);

  // Load messages when chat tab opens
  useEffect(() => {
    if (activeTab !== "chat" || !canChat) return;
    supabase
      .from("messages")
      .select("*")
      .eq("game_id", game.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => setMessages(data ?? []));
  }, [game.id, canChat, activeTab]);

  // Realtime messages
  useEffect(() => {
    if (!canChat) return;
    const channel = supabase
      .channel(`chat-${game.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `game_id=eq.${game.id}`,
      }, (payload) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === (payload.new as Message).id)) return prev;
          return [...prev, payload.new as Message];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [game.id, canChat]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (leaveConfirm) setLeaveConfirm(false);
        else if (unhostConfirm) setUnhostConfirm(false);
        else onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, leaveConfirm, unhostConfirm]);

  // Load friends and existing invites for this game
  useEffect(() => {
    if (!canChat && !isHost) return;
    async function loadFriendsAndInvites() {
      const [{ data: friendRows }, { data: inviteRows }] = await Promise.all([
        supabase
          .from("friendships")
          .select("requester, recipient")
          .or(`requester.eq.${username},recipient.eq.${username}`)
          .eq("status", "accepted"),
        supabase
          .from("game_invites")
          .select("invitee")
          .eq("game_id", game.id)
          .eq("inviter", username),
      ]);
      const friendList = (friendRows ?? []).map((r) =>
        r.requester === username ? { username: r.recipient } : { username: r.requester }
      );
      // Filter out players already in the game
      setFriends(friendList.filter((f) => !game.players.includes(f.username)));
      setInvitedIds(new Set((inviteRows ?? []).map((r) => r.invitee)));
    }
    loadFriendsAndInvites();
  }, [game.id, game.players, username, canChat, isHost]);

  async function sendInvite(toUsername: string) {
    setInviteLoading(toUsername);
    await supabase.from("game_invites").upsert({
      game_id: game.id,
      inviter: username,
      invitee: toUsername,
      status: "pending",
    }, { onConflict: "game_id,invitee" });
    setInvitedIds((prev) => new Set(prev).add(toUsername));
    setInviteLoading(null);
  }

  async function sendMessage() {
    if (!newMessage.trim() || sending || chatExpired) return;
    setSending(true);
    await supabase.from("messages").insert({
      game_id: game.id,
      username,
      content: newMessage.trim(),
    });
    setNewMessage("");
    setSending(false);
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
    setMessages([]);
    setRoom(null);
    setShowPrompt(false);
    setActiveTab("details");
  }

  function confirmLeave() {
    setLeaveConfirm(false);
    onLeave();
    onClose();
  }

  function confirmUnhost() {
    setUnhostConfirm(false);
    onUnhost?.();
    onClose();
  }

  function mainActionLabel() {
    if (full)                      return "Game is full";
    if (isPrivate && hasRequested) return "Cancel request";
    if (isPrivate)                 return "Request to join";
    if (!canAfford && hasCost)     return "Insufficient credits";
    return hasCost ? `Book spot · $${game.costPerPlayer.toFixed(2)}` : "Book my spot";
  }

  function mainActionClass() {
    if (isPrivate && hasRequested) return "cancel-req";
    return mainActionDisabled() ? "disabled-action" : "";
  }

  function mainActionDisabled() {
    return full || (!canAfford && hasCost && !isPrivate);
  }

  function handleMainAction() {
    if (isPrivate && hasRequested) return onCancel();
    if (isPrivate) return onRequest();
    onJoin();
  }

  function formatMsgTime(ts: string) {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />

        {leaveConfirm ? (
          <LeaveConfirm game={game} hasCost={hasCost} onConfirm={confirmLeave} onCancel={() => setLeaveConfirm(false)} />
        ) : unhostConfirm ? (
          <div className="leave-confirm">
            <div className="leave-confirm-icon">🗑️</div>
            <div className="leave-confirm-title">Delete this game?</div>
            <div className="leave-confirm-sub">{game.sport.charAt(0).toUpperCase() + game.sport.slice(1)} at {game.location}</div>
            <div className="leave-confirm-actions">
              <button className="leave-cancel-btn" onClick={() => setUnhostConfirm(false)}>Keep it</button>
              <button className="leave-confirm-btn" onClick={confirmUnhost}>Delete game</button>
            </div>
          </div>
        ) : (
          <>
            <div className="modal-sport-header">
              <div className="modal-sport-icon" style={{ background: sport.bg }}>
                {sport.icon.startsWith("img:") ? (
                  <img src={`/${sport.icon.replace("img:", "")}`} alt={sport.label}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : sport.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div className="modal-title-row">
                  <div className="modal-title">{sport.label} · {game.location}</div>
                  <span className={`privacy-pill ${isPrivate ? "private" : "public"}`}>
                    {isPrivate ? "Private" : "Public"}
                  </span>
                </div>
                <div className="modal-sub">{game.city} · hosted by {game.host}</div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--border-mid)", marginBottom: 12 }}>
              <button
                onClick={() => setActiveTab("details")}
                style={{
                  flex: 1, padding: "10px 0", background: "none", border: "none",
                  borderBottom: activeTab === "details" ? "2px solid var(--green)" : "2px solid transparent",
                  color: activeTab === "details" ? "var(--green)" : "var(--text-2)",
                  fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Details
              </button>
              {canChat && (
                <button
                  onClick={() => setActiveTab("chat")}
                  style={{
                    flex: 1, padding: "10px 0", background: "none", border: "none",
                    borderBottom: activeTab === "chat" ? "2px solid var(--green)" : "2px solid transparent",
                    color: activeTab === "chat" ? "var(--green)" : "var(--text-2)",
                    fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Chat {messages.length > 0 ? `(${messages.length})` : ""}
                </button>
              )}
            </div>

            {activeTab === "details" && (
              <>
                <div className="modal-section">
                  <div className="modal-section-title">Details</div>
                  <div className="detail-row">
                    <span className="detail-label">Date</span>
                    <span className="detail-val">{formatDate(game.date)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Time</span>
                    <span className="detail-val">{formatTime(game.time)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Duration</span>
                    <span className="detail-val">{game.duration} min</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Skill level</span>
                    <span className="detail-val">{SKILL_LABEL[game.skillLevel]}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Availability</span>
                    <span className="detail-val">{spotsLeft(game)} of {game.spots} spots open</span>
                  </div>
                  {game.groundCost > 0 && (
                    <div className="detail-row">
                      <span className="detail-label">Ground cost</span>
                      <span className="detail-val">${game.groundCost.toFixed(2)} total</span>
                    </div>
                  )}
                  {hasCost && (
                    <div className="detail-row">
                      <span className="detail-label">Cost per player</span>
                      <span className="detail-val cost-highlight">${game.costPerPlayer.toFixed(2)}</span>
                    </div>
                  )}
                  {(joined || hasRequested) && !isHost && (
                    <div className="detail-row">
                      <span className="detail-label">Cancellation</span>
                      <span className={`detail-val ${withdrawOk ? "withdraw-ok" : "withdraw-locked"}`}>
                        {withdrawOk ? `Free until ${deadline}` : "Window closed · within 12h of start"}
                      </span>
                    </div>
                  )}
                  {game.recurring && (
                    <div className="detail-row">
                      <span className="detail-label">Schedule</span>
                      <span className="detail-val" style={{ color: "var(--green)" }}>🔁 Repeats weekly</span>
                    </div>
                  )}
                  {hasWaitlist && (
                    <div className="detail-row">
                      <span className="detail-label">Waitlist</span>
                      <span className="detail-val">{game.waitlist.length}/{game.waitlistMax} spots</span>
                    </div>
                  )}
                  {game.note && (
                    <div className="detail-row">
                      <span className="detail-label">Note</span>
                      <span className="detail-val">{game.note}</span>
                    </div>
                  )}
                </div>

                <div className="modal-section">
                  <div className="modal-section-title">Players ({game.players.length})</div>
                  <div className="players-list">
                    {game.players.length === 0 ? (
                      <span className="no-players">No players yet</span>
                    ) : isPrivate && !joined && !isHost ? (
                      <span className="no-players">Members hidden · request to join to see who's playing</span>
                    ) : (
                      game.players.map((player, i) => (
                        <div key={player} className="player-chip">
                          <Avatar name={player} idx={i} size={18} fontSize={8} />
                          {player}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {isHost && pending.length > 0 && (
                  <div className="modal-section">
                    <div className="modal-section-title">Join requests ({pending.length})</div>
                    <div className="request-list">
                      {pending.map((req) => (
                        <RequestRow key={req.name} request={req}
                          onApprove={() => onApprove(req.name)} onDeny={() => onDeny(req.name)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Invite friends section — visible to host and joined players */}
                {(isHost || joined) && friends.length > 0 && (
                  <div className="modal-section">
                    <div
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                      onClick={() => setShowInvite((v) => !v)}
                    >
                      <div className="modal-section-title" style={{ marginBottom: 0 }}>
                        Invite friends
                      </div>
                      <span style={{ fontSize: 13, color: "var(--text-3)" }}>{showInvite ? "▲" : "▼"}</span>
                    </div>

                    {showInvite && (
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        {friends.map((f) => {
                          const invited = invitedIds.has(f.username);
                          return (
                            <div key={f.username} style={{
                              display: "flex", alignItems: "center", gap: 10,
                              padding: "8px 10px", borderRadius: 10,
                              background: "var(--surface)", border: "1px solid var(--border-mid)",
                            }}>
                              <Avatar name={f.username} idx={f.username.charCodeAt(0) % 6} size={30} fontSize={12} />
                              <div style={{ flex: 1, fontWeight: 600, fontSize: 13, color: "var(--text)" }}>
                                @{f.username}
                              </div>
                              {invited ? (
                                <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 600 }}>
                                  ✓ Invited
                                </span>
                              ) : (
                                <button
                                  onClick={() => sendInvite(f.username)}
                                  disabled={inviteLoading === f.username}
                                  style={{
                                    padding: "5px 12px", borderRadius: 8, fontSize: 12,
                                    border: "none", background: "var(--green)",
                                    color: "#fff", cursor: "pointer", fontWeight: 600,
                                  }}
                                >
                                  {inviteLoading === f.username ? "..." : "Invite"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {friends.every((f) => game.players.includes(f.username)) && (
                          <div style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center" }}>
                            All your friends are already in this game!
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {isHost && (
                  <div style={{ marginTop: 8 }}>
                    {canUnhost && onUnhost ? (
                      <button className="modal-action-btn leave" onClick={() => setUnhostConfirm(true)}>
                        Delete game
                      </button>
                    ) : (
                      <div className="withdraw-locked-block">
                        <div className="withdraw-lock-icon">👥</div>
                        <div className="withdraw-lock-text">Players have joined — you can't delete this game</div>
                      </div>
                    )}
                  </div>
                )}

                {!isHost && (
                  <>
                    {joined ? (
                      withdrawOk ? (
                        <button className="modal-action-btn leave" onClick={() => setLeaveConfirm(true)}>
                          Leave game
                        </button>
                      ) : (
                        <div className="withdraw-locked-block">
                          <div className="withdraw-lock-icon">🔒</div>
                          <div className="withdraw-lock-text">You can no longer leave — game starts in less than 12 hours</div>
                        </div>
                      )
                    ) : (
                      <button className={`modal-action-btn ${mainActionClass()}`}
                        onClick={handleMainAction} disabled={mainActionDisabled() && !hasRequested}>
                        {mainActionLabel()}
                      </button>
                    )}

                    {hasRequested && !joined && !withdrawOk && (
                      <div className="withdraw-locked-block" style={{ marginTop: 8 }}>
                        <div className="withdraw-lock-icon">🔒</div>
                        <div className="withdraw-lock-text">Request can no longer be cancelled — game starts in less than 12 hours</div>
                      </div>
                    )}

                    {!joined && full && hasWaitlist && !hasRequested && (
                      <>
                        {waitlisted ? (
                          <button className="modal-action-btn cancel-req" onClick={onLeaveWaitlist}>Leave waitlist</button>
                        ) : !waitlistFull ? (
                          <button className="modal-action-btn waitlist-btn" onClick={onJoinWaitlist}>
                            Join waitlist · {game.waitlist.length}/{game.waitlistMax}
                          </button>
                        ) : (
                          <div className="withdraw-locked-block">
                            <div className="withdraw-lock-icon">⏳</div>
                            <div className="withdraw-lock-text">Waitlist is full ({game.waitlistMax}/{game.waitlistMax})</div>
                          </div>
                        )}
                      </>
                    )}

                    {!joined && hasCost && !isPrivate && (
                      <div className="modal-credit-row">
                        <span className="modal-credit-balance">
                          Your balance: <strong>${balance.toFixed(2)}</strong>
                        </span>
                        {!canAfford && (
                          <button className="modal-topup-link" onClick={onGoToWallet}>Add credits →</button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {activeTab === "chat" && canChat && (
              <div style={{ display: "flex", flexDirection: "column", height: 340 }}>

                {/* Keep / Delete prompt — shows when expiring within 1hr */}
                {showPrompt && !chatExpired && isHost && (
                  <div style={{
                    background: "#fff8e1", border: "1px solid #ffe082",
                    borderRadius: 8, padding: "8px 12px", marginBottom: 8,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  }}>
                    <span style={{ fontSize: 12, color: "#795548" }}>
                      ⏳ Chat expires soon — keep it?
                    </span>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={handleDelete} style={{
                        fontSize: 11, padding: "4px 9px", borderRadius: 6,
                        border: "1px solid #ef9a9a", background: "#fff",
                        color: "#c62828", cursor: "pointer",
                      }}>Delete</button>
                      <button onClick={handleKeep} disabled={extending} style={{
                        fontSize: 11, padding: "4px 9px", borderRadius: 6,
                        border: "none", background: "var(--green)",
                        color: "#fff", cursor: "pointer", fontWeight: 600,
                      }}>{extending ? "..." : "Keep"}</button>
                    </div>
                  </div>
                )}

                {/* Kept badge */}
                {room?.kept && (
                  <div style={{
                    background: "#1a3a2a", borderRadius: 8, padding: "6px 12px",
                    marginBottom: 8, fontSize: 12, color: "var(--green)", fontWeight: 600,
                  }}>
                    ✅ Chat saved — messages kept forever
                  </div>
                )}

                {/* Expiry timer */}
                {room && !room.kept && !chatExpired && (
                  <div style={{
                    fontSize: 11, color: "var(--text-3)", textAlign: "right",
                    marginBottom: 6, paddingRight: 2,
                  }}>
                    ⏱ {formatExpiry(room.expires_at)}
                  </div>
                )}

                {/* Expired state */}
                {chatExpired ? (
                  <div style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    flexDirection: "column", gap: 8,
                  }}>
                    <span style={{ fontSize: 28 }}>💬</span>
                    <span style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>Chat has expired</span>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>Messages are deleted 24h after creation</span>
                    {isHost && (
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button onClick={handleDelete} style={{
                          fontSize: 12, padding: "6px 12px", borderRadius: 8,
                          border: "1px solid var(--border-mid)", background: "var(--surface)",
                          color: "var(--text-2)", cursor: "pointer",
                        }}>Clear chat</button>
                        <button onClick={handleKeep} style={{
                          fontSize: 12, padding: "6px 12px", borderRadius: 8,
                          border: "none", background: "var(--green)",
                          color: "#fff", cursor: "pointer", fontWeight: 600,
                        }}>Keep chat</button>
                      </div>
                    )}
                  </div>
                ) : roomLoading ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--text-3)", fontSize: 13 }}>
                    Loading...
                  </div>
                ) : (
                  <>
                    {/* Messages */}
                    <div style={{
                      flex: 1, overflowY: "auto", padding: "4px 0", marginBottom: 8,
                      display: "flex", flexDirection: "column", gap: 8,
                    }}>
                      {messages.length === 0 ? (
                        <div style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                          color: "var(--text-3)", fontSize: 13,
                        }}>
                          No messages yet — say hi! 👋
                        </div>
                      ) : (
                        messages.map((msg) => {
                          const isMe = msg.username === username;
                          return (
                            <div key={msg.id} style={{
                              display: "flex", flexDirection: isMe ? "row-reverse" : "row",
                              alignItems: "flex-end", gap: 6,
                            }}>
                              {!isMe && (
                                <Avatar name={msg.username} idx={msg.username.charCodeAt(0) % 6} size={22} fontSize={9} />
                              )}
                              <div style={{ maxWidth: "70%" }}>
                                {!isMe && (
                                  <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 2, paddingLeft: 2 }}>
                                    {msg.username}
                                  </div>
                                )}
                                <div style={{
                                  background: isMe ? "var(--green)" : "var(--surface)",
                                  color: isMe ? "white" : "var(--text)",
                                  borderRadius: isMe ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                                  padding: "8px 12px", fontSize: 13,
                                  border: isMe ? "none" : "1px solid var(--border-mid)",
                                }}>
                                  {msg.content}
                                </div>
                                <div style={{
                                  fontSize: 10, color: "var(--text-3)", marginTop: 2,
                                  textAlign: isMe ? "right" : "left", paddingLeft: isMe ? 0 : 2,
                                }}>
                                  {formatMsgTime(msg.created_at)}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder="Message..."
                        style={{
                          flex: 1, padding: "10px 14px", borderRadius: 20,
                          border: "1.5px solid var(--border-mid)", background: "var(--surface)",
                          color: "var(--text)", fontSize: 13, outline: "none", fontFamily: "inherit",
                        }}
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || sending}
                        style={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: newMessage.trim() ? "var(--green)" : "var(--border-mid)",
                          border: "none", cursor: newMessage.trim() ? "pointer" : "not-allowed",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 16, transition: "background 0.2s",
                        }}
                      >
                        ➤
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LeaveConfirm({ game, hasCost, onConfirm, onCancel }: {
  game: Game; hasCost: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const sport = getSport(game.sport);
  return (
    <div className="leave-confirm">
      <div className="leave-confirm-icon">{sport.icon}</div>
      <div className="leave-confirm-title">Leave this game?</div>
      <div className="leave-confirm-sub">
        {game.sport.charAt(0).toUpperCase() + game.sport.slice(1)} at {game.location}
      </div>
      {hasCost && (
        <div className="leave-confirm-refund">
          <span className="refund-pill">↩ ${game.costPerPlayer.toFixed(2)} refunded to wallet</span>
        </div>
      )}
      <div className="leave-confirm-actions">
        <button className="leave-cancel-btn" onClick={onCancel}>Keep my spot</button>
        <button className="leave-confirm-btn" onClick={onConfirm}>Leave game</button>
      </div>
    </div>
  );
}

function RequestRow({ request, onApprove, onDeny }: {
  request: JoinRequest; onApprove: () => void; onDeny: () => void;
}) {
  return (
    <div className="request-row">
      <div className="request-info">
        <Avatar name={request.name} idx={request.name.charCodeAt(0) % 6} size={28} fontSize={11} />
        <span className="request-name">{request.name}</span>
      </div>
      <div className="request-actions">
        <button className="req-deny" onClick={onDeny}>Deny</button>
        <button className="req-approve" onClick={onApprove}>Approve</button>
      </div>
    </div>
  );
}
