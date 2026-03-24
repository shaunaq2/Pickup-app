import React, { useState } from "react";
import { Game } from "../types";
import { ScoredGame } from "../utils/recommend";
import { getSport, formatDate, formatTime, spotsLeft } from "../utils";
import SpotsBadge from "./SpotsBadge";
import Avatar from "./Avatar";

interface Props {
  scored: ScoredGame[];
  joinedIds: Set<number>;
  requestedIds: Set<number>;
  balance: number;
  isHost: (id: number) => boolean;
  onOpen: (id: number) => void;
  onToggleJoin: (id: number, game: Game) => void;
}

export default function RecommendedSection({
  scored, joinedIds, requestedIds, isHost, onOpen, onToggleJoin,
}: Props) {
  if (scored.length === 0) return null;

  return (
    <div className="rec-section">
      <div className="rec-header">
        <div className="rec-title">
          <span className="rec-spark">✦</span> Recommended for you
        </div>
        <div className="rec-sub">Based on your booking history</div>
      </div>

      <div className="rec-scroll">
        {scored.map(({ game, score, reasons }) => (
          <RecommendCard
            key={game.id}
            game={game}
            score={score}
            reasons={reasons}
            joined={joinedIds.has(game.id)}
            requested={requestedIds.has(game.id)}
            isHost={isHost(game.id)}
            onOpen={() => onOpen(game.id)}
            onToggleJoin={() => onToggleJoin(game.id, game)}
          />
        ))}
      </div>
    </div>
  );
}

function RecommendCard({
  game, score, reasons, joined, requested, isHost, onOpen, onToggleJoin,
}: {
  game: Game;
  score: number;
  reasons: string[];
  joined: boolean;
  requested: boolean;
  isHost: boolean;
  onOpen: () => void;
  onToggleJoin: () => void;
}) {
  const sport = getSport(game.sport);
  const full  = spotsLeft(game) === 0 && !joined;
  const pct   = Math.min(100, Math.round(score * 250));

  function btnLabel() {
    if (joined)    return "Joined ✓";
    if (requested) return "Requested";
    if (full)      return "Full";
    if (game.privacy === "private") return "Request";
    return "Join";
  }

  return (
    <div className="rec-card" onClick={onOpen}>
      <div className="rec-card-top">
        <div className="rec-sport-icon" style={{ background: sport.bg }}>
          {sport.icon.startsWith("img:") ? <img src={`/${sport.icon.replace("img:", "")}`} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} alt="" /> : sport.icon}
        </div>
        <div className="rec-match-pill">
          <div className="rec-match-bar" style={{ width: `${pct}%` }} />
          <span className="rec-match-label">{pct}% match</span>
        </div>
      </div>

      <div className="rec-card-name">{sport.label}</div>
      <div className="rec-card-loc">{game.location}</div>
      <div className="rec-card-time">
        {formatDate(game.date)} · {formatTime(game.time)}
      </div>

      {reasons.length > 0 && (
        <div className="rec-reasons">
          {reasons.map((r) => (
            <span key={r} className="rec-reason-chip">{r}</span>
          ))}
        </div>
      )}

      <div className="rec-card-footer">
        <SpotsBadge game={game} />
        <button
          className={`rec-join-btn ${joined ? "joined" : ""}`}
          onClick={(e) => { e.stopPropagation(); onToggleJoin(); }}
          disabled={full && !joined}
        >
          {btnLabel()}
        </button>
      </div>
    </div>
  );
}
