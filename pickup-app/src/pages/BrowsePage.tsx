import React, { useState, useMemo, useEffect } from "react";
import { Game, SearchFilters } from "../types";
import { haversineKm, CITY_COORDS } from "../utils";
import { scoreGamesAsync, ScoredGame, gameToBookingRecord } from "../utils/recommend";
import { BookingRecord } from "../data/history";
import GameCard from "../components/GameCard";
import GameModal from "../components/GameModal";
import SearchBar from "../components/SearchBar";
import FilterDrawer from "../components/FilterDrawer";
import RecommendedSection from "../components/RecommendedSection";
import ChatPage from "./ChatPage";

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
  onRefresh: () => void;
  refreshing: boolean;
}

const DEFAULT_FILTERS: SearchFilters = {
  query: "", city: "", radius: 25, sport: "all", skillLevel: "all", date: "", useMyLocation: false,
};

function activeFilterCount(f: SearchFilters): number {
  let n = 0;
  if (f.useMyLocation || f.city.trim()) n++;
  if (f.sport !== "all")      n++;
  if (f.skillLevel !== "all") n++;
  if (f.date)                 n++;
  return n;
}

export default function BrowsePage({
  games, joinedIds, requestedIds, leftIds, waitlistedIds, balance, username, liveHistory, isHost,
  onJoin, onLeave, onRequest, onCancel, onJoinWaitlist, onLeaveWaitlist, onApprove, onDeny, onGoToWallet,
  onUnhost, onRefresh, refreshing,
}: Props) {
  const [filters, setFilters]           = useState<SearchFilters>(DEFAULT_FILTERS);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [modalId, setModalId]           = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle"|"requesting"|"granted"|"denied">("idle");
  const [scored, setScored]             = useState<ScoredGame[]>([]);
  const [chatGameId, setChatGameId]     = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const joinedGameHistory: BookingRecord[] = games
      .filter((g) => joinedIds.has(g.id) && !leftIds.has(g.id))
      .map((g) => gameToBookingRecord(g));
    const liveOnlyNew = liveHistory.filter(
      (r) => !joinedGameHistory.some((j) => j.gameId === r.gameId)
    );
    const fullHistory = [...joinedGameHistory, ...liveOnlyNew];
    scoreGamesAsync(username, games, joinedIds, leftIds, fullHistory).then((results) => {
      if (!cancelled) setScored(results);
    });
    return () => { cancelled = true; };
  }, [username, games, joinedIds, leftIds, liveHistory]);

  const filtered = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    let result = [...games].filter((g) => g.date >= today);

    if (filters.query.trim()) {
      const q = filters.query.toLowerCase();
      result = result.filter(
        (g) => g.sport.includes(q) || g.location.toLowerCase().includes(q) ||
               g.city.toLowerCase().includes(q) || g.host.toLowerCase().includes(q) ||
               g.note.toLowerCase().includes(q)
      );
    }
    if (filters.sport !== "all")      result = result.filter((g) => g.sport === filters.sport);
    if (filters.skillLevel !== "all") result = result.filter((g) => g.skillLevel === filters.skillLevel || g.skillLevel === "all");
    if (filters.date)                 result = result.filter((g) => g.date === filters.date);
    if (filters.city.trim()) {
      const key = filters.city.trim().toLowerCase();
      const anchor = CITY_COORDS[key];
      if (anchor) {
        const radiusKm = filters.radius * 1.60934;
        result = result.filter((g) => haversineKm(anchor.lat, anchor.lng, g.lat, g.lng) <= radiusKm);
      } else {
        result = result.filter((g) => g.city.toLowerCase().includes(key));
      }
    }
    if (userLocation && filters.useMyLocation) {
      const radiusKm = filters.radius * 1.60934;
      result = result.filter((g) => haversineKm(userLocation.lat, userLocation.lng, g.lat, g.lng) <= radiusKm);
    }
    return result;
  }, [games, filters, userLocation]);

  const activeGame = games.find((g) => g.id === modalId) ?? null;
  const chatGame   = games.find((g) => g.id === chatGameId) ?? null;
  const numActive  = activeFilterCount(filters);

  if (chatGame) {
    return (
      <ChatPage
        game={chatGame}
        username={username}
        isHost={isHost(chatGame.id)}
        onBack={() => setChatGameId(null)}
      />
    );
  }
  const showRec    = scored.length > 0 && numActive === 0 && !filters.query.trim();

  function handleToggleJoin(id: number, game: Game) {
    if (joinedIds.has(id)) return onLeave(id);
    if (requestedIds.has(id)) return onCancel(id);
    if (waitlistedIds.has(id)) return onLeaveWaitlist(id);
    const full = game.players.length >= game.spots;
    if (full && game.waitlistMax > 0 && game.waitlist.length < game.waitlistMax) return onJoinWaitlist(id);
    if (game.privacy === "private") return onRequest(id);
    return onJoin(id);
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <SearchBar
            value={filters.query}
            onChange={(q) => setFilters((f) => ({ ...f, query: q }))}
            onFilterClick={() => setDrawerOpen(true)}
            activeFilterCount={numActive}
          />
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          title="Refresh games"
          style={{
            flexShrink: 0,
            width: 38, height: 38,
            borderRadius: 10,
            border: "1.5px solid var(--border-mid)",
            background: "var(--surface)",
            color: "var(--text-2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: refreshing ? "not-allowed" : "pointer",
            fontSize: 18,
            transition: "transform 0.3s",
            transform: refreshing ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ↺
        </button>
      </div>

      {numActive > 0 && (
        <div className="active-filters">
          {filters.date && (
            <span className="active-filter-chip">
              {new Date(filters.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              <button onClick={() => setFilters((f) => ({ ...f, date: "" }))}>×</button>
            </span>
          )}
          {filters.city.trim() && (
            <span className="active-filter-chip">
              {filters.city} · {filters.radius} mi
              <button onClick={() => setFilters((f) => ({ ...f, city: "" }))}>×</button>
            </span>
          )}
          {filters.sport !== "all" && (
            <span className="active-filter-chip">
              {filters.sport}
              <button onClick={() => setFilters((f) => ({ ...f, sport: "all" }))}>×</button>
            </span>
          )}
          {filters.skillLevel !== "all" && (
            <span className="active-filter-chip">
              {filters.skillLevel}
              <button onClick={() => setFilters((f) => ({ ...f, skillLevel: "all" }))}>×</button>
            </span>
          )}
        </div>
      )}

      {showRec && (
        <RecommendedSection
          scored={scored}
          joinedIds={joinedIds}
          requestedIds={requestedIds}
          balance={balance}
          isHost={isHost}
          onOpen={setModalId}
          onToggleJoin={handleToggleJoin}
        />
      )}

      <div className="results-count">
        {filtered.length} {filtered.length === 1 ? "game" : "games"}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🔍</div>
          No upcoming games.
          <br />
          <span className="empty-link" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Clear all filters
          </span>
        </div>
      ) : (
        filtered.map((g) => (
          <GameCard
            key={g.id}
            game={g}
            joined={joinedIds.has(g.id)}
            isHost={isHost(g.id)}
            requested={requestedIds.has(g.id)}
            waitlisted={waitlistedIds.has(g.id)}
            balance={balance}
            onOpen={setModalId}
            onToggleJoin={(id) => handleToggleJoin(id, g)}
            onUnhost={onUnhost}
          />
        ))
      )}

      {drawerOpen && (
        <FilterDrawer
          filters={filters}
          onChange={setFilters}
          onClose={() => setDrawerOpen(false)}
          onReset={() => setFilters(DEFAULT_FILTERS)}
          userLocation={userLocation}
          locationStatus={locationStatus}
          onRequestLocation={() => {
            if (!navigator.geolocation) {
              setLocationStatus("denied");
              return;
            }
            setLocationStatus("requesting");
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocationStatus("granted");
              },
              () => setLocationStatus("denied")
            );
          }}
        />
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
          onOpenChat={() => { setModalId(null); setChatGameId(activeGame.id); }}
        />
      )}
    </>
  );
}