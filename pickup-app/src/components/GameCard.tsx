import React from "react";
import { Game } from "../types";
import { getSport, formatDate, formatTime, spotsLeft, canWithdraw } from "../utils";
import Avatar from "./Avatar";
import SpotsBadge from "./SpotsBadge";

const SKILL_COLORS: Record<string, { bg: string; color: string }> = {
  beginner:     { bg: "#E1F5EE", color: "#085041" },
  intermediate: { bg: "#E6F1FB", color: "#0C447C" },
  advanced:     { bg: "#FAECE7", color: "#993C1D" },
  all:          { bg: "#F1EFE8", color: "#5F5E5A" },
};

const SKILL_LABEL: Record<string, string> = {
  all:          "All levels",
  beginner:     "Beginner",
  intermediate: "Intermediate",
  advanced:     "Advanced",
};

interface Props {
  game: Game;
  joined: boolean;
  isHost: boolean;
  requested: boolean;
  waitlisted: boolean;
  balance: number;
  onOpen: (id: number) => void;
  onToggleJoin: (id: number) => void;
  onUnhost?: (id: number) => void;
}

export default function GameCard({ game, joined, isHost, requested, waitlisted, balance, onOpen, onToggleJoin, onUnhost }: Props) {
  const sport      = getSport(game.sport) ?? { id: game.sport, label: game.sport, icon: "🎮", bg: "#E8E8FB", color: "#2C2C8E" };
  const full       = spotsLeft(game) === 0 && !joined;
  const skill      = SKILL_COLORS[game.skillLevel] ?? SKILL_COLORS.all;
  const isPrivate  = game.privacy === "private";
  const pendingCount = game.joinRequests.filter((r) => r.status === "pending").length;
  const canUnhost = isHost && game.players.every((p) => p === game.host);

  function joinLabel() {
    const withdrawOk = canWithdraw(game.date, game.time);
    if (joined && !withdrawOk)    return "Locked 🔒";
    if (joined)                   return "Joined ✓";
    if (requested && !withdrawOk) return "Locked 🔒";
    if (requested)                return "Cancel request";
    if (full)                     return "Full";
    if (!joined && !isPrivate && game.costPerPlayer > 0 && balance < game.costPerPlayer) return "Insufficient funds";
    if (full && !joined && game.waitlistMax > 0 && waitlisted) return "On waitlist ⏳";
    if (full && !joined && game.waitlistMax > 0 && game.waitlist.length < game.waitlistMax) return "Join waitlist";
    if (isPrivate)                return "Request";
    return "Join";
  }

  return (
    <div className="game-card" onClick={() => onOpen(game.id)}>
      <div className="card-top">
        <div className="sport-badge">
          <div className="sport-icon" style={{ background: sport.bg }}>
            {sport.icon}
          </div>
          <div>
            <div className="sport-name-row">
              <span className="sport-name">{sport.label}</span>
              {isPrivate && <LockIcon />}
            </div>
            <div className="sport-count">
              {game.players.length}/{game.spots} players
            </div>
          </div>
        </div>
        <div className="card-top-right">
          <SpotsBadge game={game} />
          <span className="skill-badge" style={{ background: skill.bg, color: skill.color }}>
            {SKILL_LABEL[game.skillLevel]}
          </span>
        </div>
      </div>

      <div className="card-meta">
        <div className="meta-row">
          <CalendarIcon />
          {formatDate(game.date)} · {formatTime(game.time)} · {game.duration} min
        </div>
        <div className="meta-row">
          <PinIcon />
          {game.location}, {game.city}
        </div>
        {game.costPerPlayer > 0 && (
          <div className="meta-row">
            <DollarIcon />
            <span className="cost-meta">${game.costPerPlayer.toFixed(2)} per player</span>
          </div>
        )}
      </div>

      <div className="card-footer">
        <div className="host-info">
          <Avatar name={game.host} idx={game.hostIdx} />
          <span className="host-name">hosted by {game.host}</span>
          {isHost && pendingCount > 0 && (
            <span className="pending-badge">{pendingCount} pending</span>
          )}
        </div>

        {isHost ? (
          canUnhost && onUnhost ? (
            <button
              className="join-btn"
              style={{ background: "var(--surface)", border: "1.5px solid #E24B4A", color: "#E24B4A" }}
              onClick={(e) => { e.stopPropagation(); onUnhost(game.id); }}
            >
              Unhost
            </button>
          ) : (
            <span className="join-btn" style={{
              background: "transparent", border: "1.5px solid var(--border-mid)",
              color: "var(--text-3)", cursor: "default", fontSize: 12,
            }}>
              Your game
            </span>
          )
        ) : (
          <button
            className={`join-btn ${joined ? "joined" : ""} ${requested && !joined ? "cancel-req" : ""} ${waitlisted ? "waitlisted" : ""} ${isPrivate && !joined && !requested && !full ? "request" : ""}`}
            onClick={(e) => { e.stopPropagation(); onToggleJoin(game.id); }}
            disabled={
              ((full && !joined && !requested && !waitlisted && !(game.waitlistMax > 0 && game.waitlist.length < game.waitlistMax)) ||
              (full && !joined && game.waitlistMax === 0)) ||
              ((joined || requested) && !canWithdraw(game.date, game.time)) ||
              (!joined && !isPrivate && !requested && game.costPerPlayer > 0 && balance < game.costPerPlayer)
            }
          >
            {joinLabel()}
          </button>
        )}
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg className="meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <path d="M5 1.5v3M11 1.5v3M2 7h12" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg className="meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.5-2-4.5-4.5-4.5z" />
      <circle cx="8" cy="6" r="1.5" />
    </svg>
  );
}
function DollarIcon() {
  return (
    <svg className="meta-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2v12M5.5 10.5c0 1.1.9 2 2.5 2s2.5-.9 2.5-2-1-1.8-2.5-2.2-2.5-1-2.5-2.1.9-2 2.5-2 2.5.9 2.5 2" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ opacity: 0.45, marginLeft: 4, flexShrink: 0 }}>
      <rect x="3" y="7" width="10" height="7.5" rx="1.5" />
      <path d="M5 7V5a3 3 0 016 0v2" />
    </svg>
  );
}