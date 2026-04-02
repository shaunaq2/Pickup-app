import React, { useEffect, useState, useRef } from "react";
import { Game, JoinRequest } from "../types";
import { getSport, formatDate, formatTime, spotsLeft, canWithdraw, withdrawalDeadline } from "../utils";
import { supabase } from "../lib/supabase";
import Avatar from "./Avatar";

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
  const [isTeamChat, setIsTeamChat]       = useState(false);
  const [savingChat, setSavingChat]       = useState(false);
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

  // Check if this is a saved team chat
  useEffect(() => {
    supabase.from("team_chats").select("id").eq("game_id", game.id).maybeSingle()
      .then(({ data }) => setIsTeamChat(!!data));
  }, [game.id]);

  // Check if chat has expired (24h after game date+time)
  const gameDateTime = new Date(`${game.date}T${game.time}`);
  const chatExpiry   = new Date(gameDateTime.getTime() + 24 * 60 * 60 * 1000);
  const chatExpired  = !isTeamChat && new Date() > chatExpiry;

  // Load messages
  useEffect(() => {
    if (!canChat || activeTab !== "chat") return;
    supabase.from("messages").select("*").eq("game_id", game.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => setMessages(data ?? []));
  }, [game.id, canChat, activeTab]);

  // Realtime messages
  useEffect(() => {
    if (!canChat) return;
    const channel = supabase.channel(`chat-${game.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `game_id=eq.${game.id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
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

  async function sendMessage() {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    await supabase.from("messages").insert({
      game_id: game.id,
      username,
      content: newMessage.trim(),
    });
    setNewMessage("");
    setSending(false);
  }

  async function saveAsTeamChat() {
    setSavingChat(true);
    await supabase.from("team_chats").insert({
      game_id: game.id,
      name: `${game.sport} at ${game.location}`,
    });
    setIsTeamChat(true);
    setSavingChat(false);
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
                {/* Chat expiry / team chat banner */}
                {!isTeamChat && !chatExpired && isHost && (
                  <div style={{
                    background: "var(--surface)", border: "1px solid var(--border-mid)",
                    borderRadius: 8, padding: "8px 12px", marginBottom: 8,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                      ⏳ Chat deletes 24h after game
                    </span>
                    <button
                      onClick={saveAsTeamChat}
                      disabled={savingChat}
                      style={{
                        background: "var(--green)", color: "white", border: "none",
                        borderRadius: 6, padding: "4px 10px", fontSize: 11,
                        fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {savingChat ? "Saving..." : "Save as team"}
                    </button>
                  </div>
                )}

                {isTeamChat && (
                  <div style={{
                    background: "#1a3a2a", borderRadius: 8, padding: "6px 12px",
                    marginBottom: 8, fontSize: 12, color: "var(--green)", fontWeight: 600,
                  }}>
                    ✅ Team chat — messages saved forever
                  </div>
                )}

                {chatExpired ? (
                  <div style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    flexDirection: "column", gap: 8, color: "var(--text-3)",
                  }}>
                    <span style={{ fontSize: 24 }}>💬</span>
                    <span style={{ fontSize: 13 }}>Chat has expired</span>
                    <span style={{ fontSize: 11 }}>Messages are deleted 24h after the game</span>
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