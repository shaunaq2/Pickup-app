import React, { useState, useEffect, useCallback, useRef } from "react";
import { Game, TabId, Notification, NotifType, User, WalletTx } from "./types";
import { BookingRecord } from "./data/history";
import { gameToBookingRecord } from "./utils/recommend";
import { supabase } from "./lib/supabase";
import BrowsePage from "./pages/BrowsePage";
import PostPage from "./pages/PostPage";
import MyGamesPage from "./pages/MyGamesPage";
import NotificationsPage from "./pages/NotificationsPage";
import WalletPage from "./pages/WalletPage";
import SettingsPage from "./pages/SettingsPage";
import AuthPage from "./pages/AuthPage";
import FriendsPage from "./pages/FriendsPage";
import "./App.css";

let nextNotifId = 1;
let nextTxId    = 1;

function rowToGame(row: any): Game {
  return {
    id:            row.id,
    sport:         row.sport,
    location:      row.location,
    city:          row.city,
    lat:           row.lat ?? 0,
    lng:           row.lng ?? 0,
    date:          row.date,
    time:          row.time,
    duration:      row.duration,
    spots:         row.spots,
    note:          row.note ?? "",
    host:          row.host,
    hostIdx:       0,
    skillLevel:    row.skill_level ?? "all",
    privacy:       row.privacy ?? "public",
    groundCost:    row.ground_cost ?? 0,
    costPerPlayer: row.cost_per_player ?? 0,
    recurring:     row.recurring ?? false,
    waitlistMax:   row.waitlist_max ?? 0,
    players:       (row.game_players ?? []).map((p: any) => p.username),
    joinRequests:  (row.join_requests ?? []).map((r: any) => ({
      name: r.username,
      status: r.status,
    })),
    waitlist:      (row.waitlist ?? [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((w: any) => w.username),
  };
}

async function fetchAllGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select(`*, game_players(*), join_requests(*), waitlist(*)`)
    .order("created_at", { ascending: false });
  if (error) { console.error("fetchAllGames:", error); return []; }
  return (data ?? []).map(rowToGame);
}

export default function App() {
  const [user, setUser]                   = useState<User | null>(null);
  const [tab, setTab]                     = useState<TabId>("browse");
  const [games, setGames]                 = useState<Game[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [joinedIds, setJoinedIds]         = useState<Set<number>>(new Set());
  const [requestedIds, setRequestedIds]   = useState<Set<number>>(new Set());
  const [leftIds, setLeftIds]             = useState<Set<number>>(new Set());
  const [waitlistedIds, setWaitlistedIds] = useState<Set<number>>(new Set());
  const [liveHistory, setLiveHistory]     = useState<BookingRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [balance, setBalance]             = useState<number>(0);
  const [transactions, setTransactions]   = useState<WalletTx[]>([]);
  const [hostGameIds, setHostGameIds]     = useState<Set<number>>(new Set());

  const userRef = useRef<User | null>(null);
  userRef.current = user;

  // Keep Render email API alive
  useEffect(() => {
    const ping = () => fetch("https://pickup-api-n8uj.onrender.com/health").catch(() => {});
    ping();
    const interval = setInterval(ping, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function loadUserGameState(username: string) {
    const [{ data: playerRows }, { data: requestRows }, { data: waitlistRows }] = await Promise.all([
      supabase.from("game_players").select("game_id").eq("username", username),
      supabase.from("join_requests").select("game_id, status").eq("username", username),
      supabase.from("waitlist").select("game_id").eq("username", username),
    ]);
    setJoinedIds(new Set((playerRows ?? []).map((r: any) => r.game_id)));
    setRequestedIds(new Set(
      (requestRows ?? [])
        .filter((r: any) => r.status === "pending")
        .map((r: any) => r.game_id)
    ));
    setWaitlistedIds(new Set((waitlistRows ?? []).map((r: any) => r.game_id)));
  }

  // Poll for friend requests and game invites and surface as notifications
  async function loadSocialNotifs(username: string) {
    const [{ data: friendReqs }, { data: gameInvites }] = await Promise.all([
      supabase
        .from("friendships")
        .select("*")
        .eq("recipient", username)
        .eq("status", "pending"),
      supabase
        .from("game_invites")
        .select("*, games(sport, location)")
        .eq("invitee", username)
        .eq("status", "pending"),
    ]);

    const newNotifs: Notification[] = [];

    for (const req of friendReqs ?? []) {
      newNotifs.push({
        id: nextNotifId++,
        type: "friend_request",
        gameId: 0,
        gameSport: "",
        gameLocation: "",
        playerName: req.requester,
        timestamp: new Date(req.created_at),
        read: false,
      });
    }

    for (const inv of gameInvites ?? []) {
      newNotifs.push({
        id: nextNotifId++,
        type: "game_invite",
        gameId: inv.game_id,
        gameSport: inv.games?.sport ?? "",
        gameLocation: inv.games?.location ?? "",
        playerName: inv.inviter,
        timestamp: new Date(inv.created_at),
        read: false,
      });
    }

    if (newNotifs.length > 0) {
      setNotifications((prev) => {
        // Don't duplicate — check by type+playerName+gameId
        const filtered = newNotifs.filter(
          (n) => !prev.some(
            (p) => p.type === n.type && p.playerName === n.playerName && p.gameId === n.gameId
          )
        );
        return [...filtered, ...prev];
      });
    }
  }

  const refreshGames = useCallback(async (showSpinner = false, username?: string) => {
    if (showSpinner) setRefreshing(true);
    const all = await fetchAllGames();
    setGames(all);
    setLoading(false);
    if (showSpinner) setRefreshing(false);
    if (username) {
      await loadUserGameState(username);
      await loadSocialNotifs(username);
    }
  }, []);

  useEffect(() => { refreshGames(); }, [refreshGames]);

  // Poll social notifs every 30s
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => loadSocialNotifs(user.username), 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Supabase Realtime
  useEffect(() => {
    const channel = supabase
      .channel("db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, () => {
        const u = userRef.current;
        if (u) refreshGames(false, u.username);
        else refreshGames();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_players" }, () => {
        const u = userRef.current;
        if (u) refreshGames(false, u.username);
        else refreshGames();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "join_requests" }, () => {
        const u = userRef.current;
        if (u) refreshGames(false, u.username);
        else refreshGames();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, () => {
        const u = userRef.current;
        if (u) refreshGames(false, u.username);
        else refreshGames();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
        const u = userRef.current;
        if (u) loadSocialNotifs(u.username);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_invites" }, () => {
        const u = userRef.current;
        if (u) loadSocialNotifs(u.username);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refreshGames]);

  function resetForNewSession() {
    setTab("browse");
    setJoinedIds(new Set());
    setRequestedIds(new Set());
    setNotifications([]);
    setBalance(0);
    setTransactions([]);
    setLiveHistory([]);
    setLeftIds(new Set());
    setWaitlistedIds(new Set());
    setHostGameIds(new Set());
  }

  async function handleLogin(u: User) {
    resetForNewSession();
    setUser(u);
    await Promise.all([refreshGames(), loadUserGameState(u.username)]);
    await loadSocialNotifs(u.username);
  }

  function handleLogout() {
    resetForNewSession();
    setUser(null);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  function isHost(gameId: number): boolean {
    const game = games.find((g) => g.id === gameId);
    return game?.host === user?.username;
  }

  function addNotif(type: NotifType, gameId: number, gameSport: string, gameLocation: string, playerName: string) {
    setNotifications((prev) => [
      { id: nextNotifId++, type, gameId, gameSport, gameLocation, playerName, timestamp: new Date(), read: false },
      ...prev,
    ]);
  }

  function addTx(type: WalletTx["type"], amount: number, label: string) {
    setTransactions((prev) => [
      { id: nextTxId++, type, amount, label, timestamp: new Date() },
      ...prev,
    ]);
  }

  async function joinWaitlist(id: number) {
    const game = games.find((g) => g.id === id);
    if (!game || waitlistedIds.has(id) || game.waitlist.length >= game.waitlistMax) return;
    const position = game.waitlist.length + 1;
    const { error } = await supabase.from("waitlist").insert({ game_id: id, username: user!.username, position });
    if (error) { console.error("joinWaitlist:", error); return; }
    setWaitlistedIds((prev) => new Set(prev).add(id));
    await refreshGames();
    addNotif("request_sent", id, game.sport, game.location, user!.username);
  }

  async function leaveWaitlist(id: number) {
    const { error } = await supabase.from("waitlist").delete().eq("game_id", id).eq("username", user!.username);
    if (error) { console.error("leaveWaitlist:", error); return; }
    setWaitlistedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    await refreshGames();
  }

  async function promoteFromWaitlist(gameId: number) {
    const game = games.find((g) => g.id === gameId);
    if (!game || game.waitlist.length === 0) return;
    const nextPlayer = game.waitlist[0];
    await supabase.from("game_players").insert({ game_id: gameId, username: nextPlayer });
    await supabase.from("waitlist").delete().eq("game_id", gameId).eq("username", nextPlayer);
    addNotif("off_waitlist", gameId, game.sport, game.location, nextPlayer);
    await refreshGames();
  }

  async function joinGame(id: number) {
    const game = games.find((g) => g.id === id);
    if (!game) return;
    if (game.costPerPlayer > 0) {
      if (balance < game.costPerPlayer) return;
      setBalance((b) => parseFloat((b - game.costPerPlayer).toFixed(2)));
      addTx("join", game.costPerPlayer, `Joined ${game.sport} at ${game.location}`);
    }
    const { error } = await supabase.from("game_players").insert({ game_id: id, username: user!.username });
    if (error) { console.error("joinGame:", error); return; }
    setJoinedIds((prev) => new Set(prev).add(id));
    setLiveHistory((prev) => [...prev, gameToBookingRecord(game)]);
    if (!isHost(id)) addNotif("you_joined", id, game.sport, game.location, user!.username);
    // Mark any invite for this game as accepted
    await supabase.from("game_invites").update({ status: "accepted" })
      .eq("game_id", id).eq("invitee", user!.username);
    await refreshGames();
  }

  async function leaveGame(id: number) {
    const game = games.find((g) => g.id === id);
    if (game && game.costPerPlayer > 0 && joinedIds.has(id)) {
      setBalance((b) => parseFloat((b + game.costPerPlayer).toFixed(2)));
      addTx("refund", game.costPerPlayer, `Left ${game.sport} at ${game.location}`);
    }
    await supabase.from("game_players").delete().eq("game_id", id).eq("username", user!.username);
    await supabase.from("join_requests").delete().eq("game_id", id).eq("username", user!.username);
    setJoinedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setRequestedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setLeftIds((prev) => new Set(prev).add(id));
    setLiveHistory((prev) => prev.filter((r) => r.gameId !== id));
    if (game) {
      addNotif("you_left", id, game.sport, game.location, user!.username);
      await promoteFromWaitlist(id);
    }
    await refreshGames();
  }

  async function requestJoin(id: number) {
    if (requestedIds.has(id)) return;
    const game = games.find((g) => g.id === id);
    const { error } = await supabase.from("join_requests").insert({ game_id: id, username: user!.username, status: "pending" });
    if (error) { console.error("requestJoin:", error); return; }
    setRequestedIds((prev) => new Set(prev).add(id));
    if (game) addNotif("request_sent", id, game.sport, game.location, user!.username);
    await refreshGames();
  }

  async function cancelRequest(id: number) {
    await supabase.from("join_requests").delete().eq("game_id", id).eq("username", user!.username);
    setRequestedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    await refreshGames();
  }

  async function approveRequest(gameId: number, playerName: string) {
    const game = games.find((g) => g.id === gameId);
    await supabase.from("join_requests").update({ status: "approved" }).eq("game_id", gameId).eq("username", playerName);
    await supabase.from("game_players").insert({ game_id: gameId, username: playerName });
    if (game) addNotif("request_approved", gameId, game.sport, game.location, playerName);
    await refreshGames();
  }

  async function denyRequest(gameId: number, playerName: string) {
    const game = games.find((g) => g.id === gameId);
    await supabase.from("join_requests").update({ status: "denied" }).eq("game_id", gameId).eq("username", playerName);
    if (game) addNotif("request_denied", gameId, game.sport, game.location, playerName);
    await refreshGames();
  }

  async function addGame(partial: Omit<Game, "id">) {
    const { data, error } = await supabase.from("games").insert({
      sport:           partial.sport,
      location:        partial.location,
      city:            partial.city,
      lat:             partial.lat,
      lng:             partial.lng,
      date:            partial.date,
      time:            partial.time,
      duration:        partial.duration,
      spots:           partial.spots,
      note:            partial.note,
      host:            partial.host,
      host_id:         null,
      skill_level:     partial.skillLevel,
      privacy:         partial.privacy,
      ground_cost:     partial.groundCost,
      cost_per_player: partial.costPerPlayer,
      recurring:       partial.recurring,
      waitlist_max:    partial.waitlistMax,
    }).select().single();

    if (error || !data) { console.error("addGame:", error); return; }

    const newId = data.id;
    await supabase.from("game_players").insert({ game_id: newId, username: partial.host });
    setJoinedIds((prev) => new Set(prev).add(newId));
    setHostGameIds((prev) => new Set(prev).add(newId));
    await refreshGames();
  }

  async function deleteGame(id: number) {
    await supabase.from("game_players").delete().eq("game_id", id);
    await supabase.from("join_requests").delete().eq("game_id", id);
    await supabase.from("waitlist").delete().eq("game_id", id);
    await supabase.from("games").delete().eq("id", id);
    setJoinedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setHostGameIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    await refreshGames();
  }

  function topUp(amount: number) {
    setBalance((b) => parseFloat((b + amount).toFixed(2)));
    addTx("topup", amount, "Credits added");
  }

  function markRead(id: number) {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  if (!user) {
    return (
      <div className="phone-shell">
        <div className="app">
          <AuthPage onAuth={handleLogin} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="phone-shell">
        <div className="app" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <p style={{ color: "#888" }}>Loading games...</p>
        </div>
      </div>
    );
  }

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "browse",        label: "Browse",   icon: <BrowseIcon /> },
    { id: "post",          label: "Post",     icon: <PostIcon /> },
    { id: "mine",          label: "My games", icon: <MyIcon /> },
    { id: "friends",       label: "Friends",  icon: <FriendsIcon /> },
    { id: "notifications", label: "Inbox",    icon: <NotifIcon /> },
    { id: "wallet",        label: "Settings", icon: <SettingsIcon /> },
  ];

  const sharedGameProps = {
    games, joinedIds, requestedIds, leftIds, waitlistedIds, isHost,
    balance,
    username: user.username,
    liveHistory,
    onJoin:          joinGame,
    onLeave:         leaveGame,
    onRequest:       requestJoin,
    onCancel:        cancelRequest,
    onJoinWaitlist:  joinWaitlist,
    onLeaveWaitlist: leaveWaitlist,
    onApprove:       approveRequest,
    onDeny:          denyRequest,
    onGoToWallet:    () => setTab("wallet"),
    onRefresh:       () => refreshGames(true, user.username),
    onUnhost:        deleteGame,
    refreshing,
  };

  return (
    <div className="phone-shell">
      <div className="app">
        <header className="header">
          <div className="logo">Run<em>It</em></div>
          <div className="header-user">
            <button className="header-avatar-btn" onClick={() => setTab("wallet")} title="Settings">
              <div className="header-avatar">{user.username[0].toUpperCase()}</div>
            </button>
            <span className="header-balance">${balance.toFixed(2)}</span>
          </div>
        </header>

        <main className="content">
          {tab === "browse"        && <BrowsePage {...sharedGameProps} />}
          {tab === "post"          && <PostPage onPost={addGame} onSuccess={() => setTab("browse")} username={user.username} />}
          {tab === "mine"          && <MyGamesPage {...sharedGameProps} />}
          {tab === "friends"       && <FriendsPage username={user.username} />}
          {tab === "notifications" && (
            <NotificationsPage notifications={notifications} onMarkRead={markRead} onMarkAllRead={markAllRead} />
          )}
          {tab === "wallet" && (
            <SettingsPage user={user} balance={balance} transactions={transactions} onTopUp={topUp} onLogout={handleLogout} />
          )}
        </main>

        <nav className="bottom-nav">
          {TABS.map((t) => (
            <button key={t.id} className={`bottom-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <div className="bottom-tab-icon-wrap">
                {t.icon}
                {t.id === "notifications" && unreadCount > 0 && (
                  <span className="bottom-notif-dot">{unreadCount > 9 ? "9+" : unreadCount}</span>
                )}
              </div>
              <span className="bottom-tab-label">{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function BrowseIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5l4 4" /></svg>;
}
function PostIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>;
}
function MyIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 9h8M8 13h5" /></svg>;
}
function FriendsIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="7" r="3" /><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" /><path d="M16 3.13a4 4 0 010 7.75" /><path d="M21 21v-2a4 4 0 00-3-3.85" /></svg>;
}
function NotifIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 10a6 6 0 0112 0v3l2 3H4l2-3v-3z" /><path d="M10 19a2 2 0 004 0" /></svg>;
}
function SettingsIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>;
}
