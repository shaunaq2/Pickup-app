import React from "react";
import { Notification } from "../types";
import { getSport } from "../utils";

interface Props {
  notifications: Notification[];
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
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
    default:                 return "🔔";
  }
}

function notifTitle(n: Notification): string {
  const sport = getSport(n.gameSport)?.label ?? n.gameSport;
  switch (n.type) {
    case "request_received":
      return `${n.playerName} wants to join your ${sport} game`;
    case "request_sent":
      return `You requested to join ${sport} at ${n.gameLocation}`;
    case "request_approved":
      return `You're in! Your ${sport} request was approved`;
    case "request_denied":
      return `Your request to join ${sport} was not approved`;
    case "you_joined":
      return `You joined ${sport} at ${n.gameLocation}`;
    case "you_left":
      return `You left ${sport} at ${n.gameLocation}`;
    case "off_waitlist":
      return `Spot opened up! You're now in ${sport} at ${n.gameLocation}`;
    case "player_joined":
      return `${n.playerName} joined your ${sport} game`;
    default:
      return `${sport} at ${n.gameLocation}`;
  }
}

export default function NotificationsPage({ notifications, onMarkRead, onMarkAllRead }: Props) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  if (notifications.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">🔔</div>
        No notifications yet.
        <br />
        Join or host a game to get started.
      </div>
    );
  }

  return (
    <>
      <div className="notif-header-row">
        <span className="results-count">{notifications.length} notifications</span>
        {unreadCount > 0 && (
          <button className="mark-all-read" onClick={onMarkAllRead}>
            Mark all read
          </button>
        )}
      </div>

      <div className="notif-list">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`notif-item ${!n.read ? "unread" : ""}`}
            onClick={() => onMarkRead(n.id)}
          >
            <div className="notif-icon-wrap">
              <div className="notif-sport-icon">
                {getSport(n.gameSport)?.icon ?? "🎮"}
              </div>
              <span className="notif-type-icon">{notifIcon(n.type)}</span>
            </div>
            <div className="notif-body">
              <div className="notif-title">{notifTitle(n)}</div>
              <div className="notif-sub">{timeAgo(n.timestamp)}</div>
            </div>
            {!n.read && <div className="notif-dot" />}
          </div>
        ))}
      </div>
    </>
  );
}
