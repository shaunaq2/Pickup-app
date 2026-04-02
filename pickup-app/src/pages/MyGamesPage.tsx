import React, { useState } from "react";
import { Game } from "../types";
import { BookingRecord } from "../data/history";
import { getSport, formatDate, formatTime, spotsLeft } from "../utils";
import GameCard from "../components/GameCard";
import GameModal from "../components/GameModal";
import SpotsBadge from "../components/SpotsBadge";
import Avatar from "../components/Avatar";

interface Props {
  games: Game[];
  joinedIds: Set<number>;
  requestedIds: Set<number>;
  leftIds: Set<number>;
  waitlistedIds: Set<number>;
  balance: number;
  username: string;
  liveHistory: BookingRecord[];
  isHost: (id: number) => boolean;
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
}

type TopTab = "playing" | "hosting";
type SubTab = "upcoming" | "past";

export default function MyGamesPage({
  games, joinedIds, requestedIds, leftIds, waitlistedIds, balance, username, liveHistory, isHost,
  onJoin, onLeave, onRequest, onCancel, onJoinWaitlist, onLeaveWaitlist, onApprove, onDeny, onGoToWallet, onUnhost,
}: Props) {
  const [topTab,  setTopTab]  = useState<TopTab>("playing");
  const [subTab,  setSubTab]  = useState<SubTab>("upcoming");
  const [modalId, setModalId] = useState<number | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const playingGames = games.filter((g) => joinedIds.has(g.id) && !isHost(g.id));
  const hostingGames = games.filter((g) => isHost(g.id));

  const playUpcoming = playingGames.filter((g) => g.date >= today);
  const playPast     = playingGames.filter((g) => g.date < today && !leftIds.has(g.id));

  const hostUpcoming = hostingGames.filter((g) => g.date >= today);
  const hostPast     = hostingGames.filter((g) => g.date < today);

  const activeGame   = games.find((g) => g.id === modalId) ?? null;

  const totalPlaying = playUpcoming.length + playPast.length + liveHistory.length;
  const totalHosting = hostUpcoming.length + hostPast.length;

  const isEmpty = totalPlaying === 0 && totalHosting === 0;

  if (isEmpty) {
    return (
      <div className="empty">
        <div className="empty-icon">📋</div>
        Nothing here yet.
        <br />
        Browse games to join one, or post your own.
      </div>
    );
  }

  return (
    <>
      <div className="top-tabs">
        <button
          className={`top-tab ${topTab === "playing" ? "active" : ""}`}
          onClick={() => { setTopTab("playing"); setSubTab("upcoming"); }}
        >
          Playing
          {totalPlaying > 0 && <span className="sub-tab-count">{totalPlaying}</span>}
        </button>
        <button
          className={`top-tab ${topTab === "hosting" ? "active" : ""}`}
          onClick={() => { setTopTab("hosting"); setSubTab("upcoming"); }}
        >
          Hosting
          {totalHosting > 0 && <span className="sub-tab-count">{totalHosting}</span>}
        </button>
      </div>

      <div className="sub-tabs" style={{ marginTop: 10 }}>
        <button
          className={`sub-tab ${subTab === "upcoming" ? "active" : ""}`}
          onClick={() => setSubTab("upcoming")}
        >
          Upcoming
          {topTab === "playing" && playUpcoming.length > 0 && (
            <span className="sub-tab-count">{playUpcoming.length}</span>
          )}
          {topTab === "hosting" && hostUpcoming.length > 0 && (
            <span className="sub-tab-count">{hostUpcoming.length}</span>
          )}
        </button>
        <button
          className={`sub-tab ${subTab === "past" ? "active" : ""}`}
          onClick={() => setSubTab("past")}
        >
          Past
          {topTab === "playing" && (playPast.length + liveHistory.length) > 0 && (
            <span className="sub-tab-count">{playPast.length + liveHistory.length}</span>
          )}
          {topTab === "hosting" && hostPast.length > 0 && (
            <span className="sub-tab-count">{hostPast.length}</span>
          )}
        </button>
      </div>

      {topTab === "playing" && subTab === "upcoming" && (
        <>
          {playUpcoming.length === 0 ? (
            <EmptyState icon="📅" text="No upcoming games." sub="Browse to find one." />
          ) : (
            playUpcoming.map((g) => (
              <GameCard
                key={g.id}
                game={g}
                joined={joinedIds.has(g.id)}
                isHost={false}
                requested={requestedIds.has(g.id)}
                waitlisted={waitlistedIds.has(g.id)}
                balance={balance}
                onOpen={setModalId}
                onToggleJoin={(id) => {
                  if (joinedIds.has(id)) return onLeave(id);
                  if (requestedIds.has(id)) return onCancel(id);
                  if (g.privacy === "private") return onRequest(id);
                  return onJoin(id);
                }}
              />
            ))
          )}
        </>
      )}

      {topTab === "playing" && subTab === "past" && (
        <>
          {playPast.length === 0 && liveHistory.length === 0 ? (
            <EmptyState icon="🏅" text="No past games yet." sub="Games you've played will appear here." />
          ) : (
            <>
              {playPast.map((g) => (
                <PastGameRow key={g.id} game={g} label="Played" />
              ))}
              {liveHistory.map((record, i) => (
                <PastRecordRow key={i} record={record} />
              ))}
            </>
          )}
        </>
      )}

      {topTab === "hosting" && subTab === "upcoming" && (
        <>
          {hostUpcoming.length === 0 ? (
            <EmptyState icon="📣" text="No active games." sub="Post a game to see it here." />
          ) : (
            hostUpcoming.map((g) => (
              <HostGameRow key={g.id} game={g} onOpen={setModalId} />
            ))
          )}
        </>
      )}

      {topTab === "hosting" && subTab === "past" && (
        <>
          {hostPast.length === 0 ? (
            <EmptyState icon="📋" text="No past hosted games yet." sub="Games you've hosted will appear here." />
          ) : (
            hostPast.map((g) => (
              <PastGameRow key={g.id} game={g} label="Hosted" />
            ))
          )}
        </>
      )}

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
          onClose={() => setModalId(null)}
        />
      )}
    </>
  );
}

function EmptyState({ icon, text, sub }: { icon: string; text: string; sub: string }) {
  return (
    <div className="empty" style={{ paddingTop: 36 }}>
      <div className="empty-icon">{icon}</div>
      {text}
      <br />
      {sub}
    </div>
  );
}

function PastGameRow({ game, label }: { game: Game; label: string }) {
  const sport = getSport(game.sport) ?? { id: game.sport, label: game.sport, icon: "🎮", bg: "#E8E8FB", color: "#2C2C8E" };
  return (
    <div className="past-game-row">
      <div className="past-game-icon" style={{ background: sport.bg }}>
        {sport.icon.startsWith("img:") ? (
          <img src={`/${sport.icon.replace("img:", "")}`} alt={sport.label}
            style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : sport.icon}
      </div>
      <div className="past-game-body">
        <div className="past-game-name">{sport.label}</div>
        <div className="past-game-meta">{game.location} · {formatDate(game.date)}</div>
      </div>
      <span className="past-game-label">{label}</span>
    </div>
  );
}

function HostGameRow({ game, onOpen }: { game: Game; onOpen: (id: number) => void }) {
  const sport   = getSport(game.sport);
  const pending = game.joinRequests.filter((r) => r.status === "pending").length;

  return (
    <div className="host-game-row" onClick={() => onOpen(game.id)}>
      <div className="host-game-top">
        <div className="sport-badge">
          <div className="sport-icon" style={{ background: sport.bg }}>
            {sport.icon.startsWith("img:") ? (
              <img src={`/${sport.icon.replace("img:", "")}`} alt={sport.label}
                style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : sport.icon}
          </div>
          <div>
            <div className="sport-name">{sport.label}</div>
            <div className="sport-count">{game.players.length}/{game.spots} players</div>
          </div>
        </div>
        <SpotsBadge game={game} />
      </div>

      <div className="host-game-meta">
        <div className="meta-row">
          <CalIcon />
          {formatDate(game.date)} · {formatTime(game.time)} · {game.duration} min
        </div>
        <div className="meta-row">
          <PinIcon />
          {game.location}, {game.city}
        </div>
      </div>

      <div className="host-game-footer">
        <div className="host-game-players">
          {game.players.slice(0, 5).map((p, i) => (
            <div key={p} className="stacked-avatar" style={{ zIndex: 10 - i, marginLeft: i === 0 ? 0 : -8 }}>
              <Avatar name={p} idx={i} size={22} fontSize={9} />
            </div>
          ))}
          {game.players.length > 5 && (
            <div className="stacked-more">+{game.players.length - 5}</div>
          )}
        </div>
        {pending > 0 && (
          <span className="pending-badge">{pending} pending</span>
        )}
        <span className="host-manage-btn">Manage →</span>
      </div>
    </div>
  );
}

function PastRecordRow({ record }: { record: BookingRecord }) {
  const sport = getSport(record.sport);
  const days  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const h     = record.hourOfDay > 12 ? record.hourOfDay - 12 : record.hourOfDay || 12;
  const ampm  = record.hourOfDay >= 12 ? "pm" : "am";
  return (
    <div className="past-game-row">
      <div className="past-game-icon" style={{ background: sport?.bg ?? "#eee" }}>
        {sport?.icon ?? "🏅"}
      </div>
      <div className="past-game-body">
        <div className="past-game-name">{sport?.label ?? record.sport}</div>
        <div className="past-game-meta">
          {record.location} · {days[record.dayOfWeek]}s · {h}:00 {ampm}
        </div>
      </div>
      <span className="past-game-label" style={{ textTransform: "capitalize" }}>{record.skillLevel}</span>
    </div>
  );
}

function CalIcon() {
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