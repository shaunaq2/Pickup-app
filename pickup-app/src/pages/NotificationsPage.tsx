import React, { useState } from "react";
import { Notification, Game } from "../types";
import { getSport } from "../utils";
import GameModal from "../components/GameModal";

interface Props {
  notifications: Notification[];
  games: Game[];
  joinedIds: Set<number>;
  requestedIds: Set<number>;
  waitlistedIds: Set<number>;
  balance: number;
  username: string;
  isHost: (id: number) => boolean;
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
  onJoin: (id: number) => void;
  onLeave: (id: number) => void;
  onRequest: (id: number) => void;
  onCancel: (id: number) => void;
  onJoinWaitlist: (id: number) => void;
  onLeaveWaitlist: (id: number) => void;
  onApprove: (gameId: number, name: string) => void;
  onDeny: (gameId: number, name: string) => void;
  onGoToWallet: () => void;
  onUnhost: (id: number) => void;
  onOpenChat: (id: number) => void;
}

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function notifIcon(type: Notification["type"]): string {
  switch (type) {
    case "request_received": return "🔔";
    case "request_sent":     return "📤";
    case "request_approved": return "✅";
    case "request_denied":   return "❌";
    case "you_joined":       return "✅";
    case "you_left":         return "👋";
    case "off_waitlist":     return "🎉";
    case "player_joined":    return "👤";
    case "friend_request":   return "👋";
    case "friend_accepted":  return "🤝";
    case "game_invite":      return "📩";
    default:                 return "🔔";
  }
}

function notifTitle(n: Notification): string {
  const sport = getSport(n.gameSport)?.label ?? n.gameSport;
  switch (n.type) {
    case "request_received":  return `${n.playerName} wants to join your ${sport} game`;
    case "request_sent":      return `You requested to join ${sport} at ${n.gameLocation}`;
    case "request_approved":  return `You're in! Your ${sport} request was approved`;
    case "request_denied":    return `Your request to join ${sport} was not approved`;
    case "you_joined":        return `You joined ${sport} at ${n.gameLocation}`;
    case "you_left":          return `You left ${sport} at ${n.gameLocation}`;
    case "off_waitlist":      return `Spot opened up! You're now in ${sport} at ${n.gameLocation}`;
    case "player_joined":     return `${n.playerName} joined your ${sport} game`;
    case "friend_request":    return `${n.playerName} sent you a friend request`;
    case "friend_accepted":   return `${n.playerName} accepted your friend request`;
    case "game_invite":       return `${n.playerName} invited you to ${sport} at ${n.gameLocation}`;
    default:                  return `${sport} at ${n.gameLocation}`;
  }
}

// Types that should open a game modal when tapped
const GAME_NOTIF_TYPES: Notification["type"][] = [
  "request_received", "request_approved", "you_joined", "off_waitlist",
  "player_joined", "game_invite",
];

export default function NotificationsPage({
  notifications, games, joinedIds, requestedIds, waitlistedIds, balance, username,
  isHost, onMarkRead, onMarkAllRead, onJoin, onLeave, onRequest, onCancel,
  onJoinWaitlist, onLeaveWaitlist, onApprove, onDeny, onGoToWallet, onUnhost, onOpenChat,
}: Props) {
  const [modalGameId, setModalGameId] = useState<number | null>(null);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeGame  = games.find((g) => g.id === modalGameId) ?? null;

  function handleTap(n: Notification) {
    onMarkRead(n.id);
    if (n.gameId && GAME_NOTIF_TYPES.includes(n.type)) {
      setModalGameId(n.gameId);
    }
  }

  if (notifications.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">🔔</div>
        No notifications yet.<br />Join or host a game to get started.
      </div>
    );
  }

  return (
    <>
      <div className="notif-header-row">
        <span className="results-count">{notifications.length} notifications</span>
        {unreadCount > 0 && (
          <button className="mark-all-read" onClick={onMarkAllRead}>Mark all read</button>
        )}
      </div>

      <div className="notif-list">
        {notifications.map((n) => {
          const isClickable = n.gameId && GAME_NOTIF_TYPES.includes(n.type);
          return (
            <div
              key={n.id}
              className={`notif-item ${!n.read ? "unread" : ""}`}
              onClick={() => handleTap(n)}
              style={{ cursor: isClickable ? "pointer" : "default" }}
            >
              <div className="notif-icon-wrap">
                <div className="notif-sport-icon">
                  {n.gameSport ? getSport(n.gameSport)?.icon ?? "🎮" : "👥"}
                </div>
                <span className="notif-type-icon">{notifIcon(n.type)}</span>
              </div>
              <div className="notif-body">
                <div className="notif-title">{notifTitle(n)}</div>
                <div className="notif-sub">
                  {timeAgo(n.timestamp)}
                  {isClickable && <span style={{ color: "var(--green)", marginLeft: 6, fontSize: 11 }}>Tap to view →</span>}
                </div>
              </div>
              {!n.read && <div className="notif-dot" />}
            </div>
          );
        })}
      </div>

      {activeGame && (
        <GameModal
          game={activeGame}
          joined={joinedIds.has(activeGame.id)}
          isHost={isHost(activeGame.id)}
          hasRequested={requestedIds.has(activeGame.id)}
          balance={balance}
          username={username}
          onJoin={() => onJoin(activeGame.id)}
          onLeave={() => onLeave(activeGame.id)}
          onRequest={() => onRequest(activeGame.id)}
          onCancel={() => onCancel(activeGame.id)}
          waitlisted={waitlistedIds.has(activeGame.id)}
          onJoinWaitlist={() => onJoinWaitlist(activeGame.id)}
          onLeaveWaitlist={() => onLeaveWaitlist(activeGame.id)}
          onApprove={(name) => onApprove(activeGame.id, name)}
          onDeny={(name) => onDeny(activeGame.id, name)}
          onGoToWallet={onGoToWallet}
          onUnhost={() => onUnhost(activeGame.id)}
          onClose={() => setModalGameId(null)}
          onOpenChat={() => { setModalGameId(null); onOpenChat(activeGame.id); }}
        />
      )}
    </>
  );
}
