import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { FriendStatus } from "../types";
import Avatar from "../components/Avatar";
import { getSport, formatDate, formatTime } from "../utils";

interface Friend {
  username: string;
  status: FriendStatus;
  friendshipId?: number;
}

interface PastGame {
  id: number;
  sport: string;
  location: string;
  city: string;
  date: string;
  time: string;
  spots: number;
  players: string[];
}

interface Props {
  username: string;
}

type Section = "friends" | "search" | "qr";

// ─── Friend Profile View ──────────────────────────────────

function FriendProfile({ friendUsername, myUsername, friendshipId, onBack, onRemove }: {
  friendUsername: string;
  myUsername: string;
  friendshipId: number;
  onBack: () => void;
  onRemove: () => void;
}) {
  const [pastGames, setPastGames]       = useState<PastGame[]>([]);
  const [mutuals, setMutuals]           = useState<string[]>([]);
  const [privacyAllowed, setPrivacyAllowed] = useState<boolean | null>(null);
  const [loading, setLoading]           = useState(true);
  const [removing, setRemoving]         = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Check friend's privacy setting
      const theirPrefs = await fetch(`/api/notif-prefs?username=${friendUsername}`)
        .then(() => null).catch(() => null);

      // Read from localStorage won't work cross-user, so we store prefs in Supabase
      // Check user_prefs table; if not found, default to allowed
      const { data: prefRow } = await supabase
        .from("user_prefs")
        .select("show_games_joined")
        .eq("username", friendUsername)
        .maybeSingle();

      const allowed = prefRow ? prefRow.show_games_joined !== false : true;
      if (!cancelled) setPrivacyAllowed(allowed);

      // Load mutual friends
      const [{ data: myFriends }, { data: theirFriends }] = await Promise.all([
        supabase.from("friendships").select("requester, recipient")
          .or(`requester.eq.${myUsername},recipient.eq.${myUsername}`)
          .eq("status", "accepted"),
        supabase.from("friendships").select("requester, recipient")
          .or(`requester.eq.${friendUsername},recipient.eq.${friendUsername}`)
          .eq("status", "accepted"),
      ]);

      const mySet = new Set(
        (myFriends ?? []).map((r) => r.requester === myUsername ? r.recipient : r.requester)
      );
      const theirSet = (theirFriends ?? [])
        .map((r) => r.requester === friendUsername ? r.recipient : r.requester)
        .filter((u) => u !== myUsername);

      const mutual = theirSet.filter((u) => mySet.has(u));
      if (!cancelled) setMutuals(mutual);

      // Load past games if allowed
      if (allowed) {
        const { data: playerRows } = await supabase
          .from("game_players")
          .select("game_id")
          .eq("username", friendUsername);

        const gameIds = (playerRows ?? []).map((r) => r.game_id);

        if (gameIds.length > 0) {
          const today = new Date().toISOString().split("T")[0];
          const { data: gamesData } = await supabase
            .from("games")
            .select("id, sport, location, city, date, time, spots, game_players(username)")
            .in("id", gameIds)
            .lt("date", today)
            .order("date", { ascending: false })
            .limit(10);

          const games: PastGame[] = (gamesData ?? []).map((g: any) => ({
            id: g.id,
            sport: g.sport,
            location: g.location,
            city: g.city,
            date: g.date,
            time: g.time,
            spots: g.spots,
            players: (g.game_players ?? []).map((p: any) => p.username),
          }));

          if (!cancelled) setPastGames(games);
        }
      }

      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [friendUsername, myUsername]);

  async function handleRemove() {
    setRemoving(true);
    await supabase.from("friendships").delete().eq("id", friendshipId);
    onRemove();
  }

  return (
    <div>
      {/* Back */}
      <button onClick={onBack} style={{
        background: "none", border: "none", cursor: "pointer",
        color: "var(--green)", fontWeight: 600, fontSize: 14,
        padding: "0 0 16px 0", fontFamily: "inherit",
      }}>← Back</button>

      {/* Profile header */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 10, paddingBottom: 20, borderBottom: "1px solid var(--border)",
        marginBottom: 20,
      }}>
        <Avatar name={friendUsername} idx={friendUsername.charCodeAt(0) % 6} size={72} fontSize={28} />
        <div style={{ fontWeight: 700, fontSize: 20, color: "var(--text)" }}>@{friendUsername}</div>
        {mutuals.length > 0 && (
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            {mutuals.length} mutual friend{mutuals.length > 1 ? "s" : ""}
            {mutuals.length <= 3 && `: ${mutuals.join(", ")}`}
          </div>
        )}

        {/* Remove friend */}
        {!confirmRemove ? (
          <button onClick={() => setConfirmRemove(true)} style={{
            padding: "7px 16px", borderRadius: 10, fontSize: 12,
            border: "1px solid var(--border-mid)", background: "var(--surface)",
            color: "var(--text-3)", cursor: "pointer", fontFamily: "inherit",
          }}>
            Remove friend
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmRemove(false)} style={{
              padding: "7px 14px", borderRadius: 10, fontSize: 12,
              border: "1px solid var(--border-mid)", background: "var(--surface)",
              color: "var(--text-2)", cursor: "pointer",
            }}>Cancel</button>
            <button onClick={handleRemove} disabled={removing} style={{
              padding: "7px 14px", borderRadius: 10, fontSize: 12,
              border: "none", background: "#E24B4A",
              color: "#fff", cursor: "pointer", fontWeight: 600,
            }}>{removing ? "Removing..." : "Confirm remove"}</button>
          </div>
        )}
      </div>

      {/* Past games */}
      {loading ? (
        <div style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", paddingTop: 20 }}>
          Loading...
        </div>
      ) : privacyAllowed === false ? (
        <div style={{
          textAlign: "center", padding: "24px 0",
          color: "var(--text-3)", fontSize: 13,
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
          {friendUsername} keeps their game history private.
        </div>
      ) : pastGames.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "24px 0",
          color: "var(--text-3)", fontSize: 13,
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🏅</div>
          No past games yet.
        </div>
      ) : (
        <>
          <div style={{
            fontSize: 11, fontWeight: 700, color: "var(--text-3)",
            textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10,
          }}>
            Past games ({pastGames.length})
          </div>
          {pastGames.map((g) => {
            const sport = getSport(g.sport);
            const playedTogether = g.players.includes(myUsername);
            return (
              <div key={g.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 12,
                background: "var(--surface)", border: "1px solid var(--border-mid)",
                marginBottom: 8,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: sport.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, flexShrink: 0,
                }}>
                  {sport.icon.startsWith("img:")
                    ? <img src={`/${sport.icon.replace("img:", "")}`} alt={sport.label} style={{ width: "80%", height: "80%", objectFit: "contain" }} />
                    : sport.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{sport.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                    {g.location}, {g.city} · {formatDate(g.date)}
                  </div>
                </div>
                {playedTogether && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "var(--green)",
                    background: "rgba(0,200,120,0.1)", borderRadius: 6,
                    padding: "3px 7px", flexShrink: 0,
                  }}>
                    Played together
                  </span>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ─── Main FriendsPage ─────────────────────────────────────

export default function FriendsPage({ username }: Props) {
  const [section, setSection]             = useState<Section>("friends");
  const [friends, setFriends]             = useState<Friend[]>([]);
  const [pendingIn, setPendingIn]         = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [searching, setSearching]         = useState(false);
  const [loading, setLoading]             = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<Friend | null>(null);

  useEffect(() => { loadFriends(); }, [username]);

  async function loadFriends() {
    setLoading(true);
    const { data } = await supabase.from("friendships").select("*")
      .or(`requester.eq.${username},recipient.eq.${username}`);
    const rows = data ?? [];
    const accepted: Friend[] = [];
    const inbound: Friend[] = [];
    for (const row of rows) {
      const other = row.requester === username ? row.recipient : row.requester;
      if (row.status === "accepted") {
        accepted.push({ username: other, status: "friends", friendshipId: row.id });
      } else if (row.status === "pending" && row.recipient === username) {
        inbound.push({ username: row.requester, status: "pending_received", friendshipId: row.id });
      }
    }
    setFriends(accepted);
    setPendingIn(inbound);
    setLoading(false);
  }

  async function searchUsers(q: string) {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const { data: users } = await supabase.from("users").select("username")
      .ilike("username", `%${q.trim()}%`).neq("username", username).limit(10);
    const { data: existing } = await supabase.from("friendships").select("*")
      .or(`requester.eq.${username},recipient.eq.${username}`);
    const rows = existing ?? [];
    const results: Friend[] = (users ?? []).map((u) => {
      const row = rows.find(
        (r) => (r.requester === username && r.recipient === u.username) ||
               (r.recipient === username && r.requester === u.username)
      );
      let status: FriendStatus = "none";
      if (row) {
        if (row.status === "accepted") status = "friends";
        else if (row.status === "pending")
          status = row.requester === username ? "pending_sent" : "pending_received";
      }
      return { username: u.username, status, friendshipId: row?.id };
    });
    setSearchResults(results);
    setSearching(false);
  }

  useEffect(() => {
    const t = setTimeout(() => searchUsers(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  async function sendFriendRequest(toUsername: string) {
    setActionLoading(toUsername);
    await supabase.from("friendships").insert({ requester: username, recipient: toUsername, status: "pending" });
    setSearchResults((prev) => prev.map((u) => u.username === toUsername ? { ...u, status: "pending_sent" as FriendStatus } : u));
    setActionLoading(null);
  }

  async function acceptRequest(friendshipId: number, fromUsername: string) {
    setActionLoading(fromUsername);
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
    setPendingIn((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
    setFriends((prev) => [...prev, { username: fromUsername, status: "friends", friendshipId }]);
    setActionLoading(null);
  }

  async function declineRequest(friendshipId: number, fromUsername: string) {
    setActionLoading(fromUsername);
    await supabase.from("friendships").update({ status: "declined" }).eq("id", friendshipId);
    setPendingIn((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
    setActionLoading(null);
  }

  const profileUrl = `${window.location.origin}?add=${username}`;

  // Show friend profile view
  if (viewingProfile) {
    return (
      <FriendProfile
        friendUsername={viewingProfile.username}
        myUsername={username}
        friendshipId={viewingProfile.friendshipId!}
        onBack={() => setViewingProfile(null)}
        onRemove={() => {
          setFriends((prev) => prev.filter((f) => f.username !== viewingProfile.username));
          setViewingProfile(null);
        }}
      />
    );
  }

  return (
    <div>
      {/* Section tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["friends", "search", "qr"] as Section[]).map((s) => (
          <button key={s} onClick={() => setSection(s)} style={{
            flex: 1, padding: "9px 0", borderRadius: 10,
            border: "1.5px solid",
            borderColor: section === s ? "var(--green)" : "var(--border-mid)",
            background: section === s ? "var(--green)" : "var(--surface)",
            color: section === s ? "#fff" : "var(--text-2)",
            fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}>
            {s === "friends" ? `👥 Friends${friends.length > 0 ? ` (${friends.length})` : ""}` :
             s === "search"  ? "🔍 Search" : "📱 QR Code"}
          </button>
        ))}
      </div>

      {/* Friends list */}
      {section === "friends" && (
        <>
          {loading ? (
            <div style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", paddingTop: 32 }}>Loading...</div>
          ) : (
            <>
              {pendingIn.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                    Friend Requests ({pendingIn.length})
                  </div>
                  {pendingIn.map((f) => (
                    <div key={f.username} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 12,
                      background: "var(--surface)", border: "1px solid var(--border-mid)", marginBottom: 8,
                    }}>
                      <Avatar name={f.username} idx={f.username.charCodeAt(0) % 6} size={36} fontSize={14} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>@{f.username}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>Wants to be friends</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => declineRequest(f.friendshipId!, f.username)}
                          disabled={actionLoading === f.username}
                          style={{ padding: "6px 10px", borderRadius: 8, fontSize: 12, border: "1px solid var(--border-mid)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" }}>
                          ✕
                        </button>
                        <button onClick={() => acceptRequest(f.friendshipId!, f.username)}
                          disabled={actionLoading === f.username}
                          style={{ padding: "6px 10px", borderRadius: 8, fontSize: 12, border: "none", background: "var(--green)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                          {actionLoading === f.username ? "..." : "Accept"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {friends.length === 0 && pendingIn.length === 0 ? (
                <div className="empty" style={{ paddingTop: 32 }}>
                  <div className="empty-icon">👥</div>
                  No friends yet.<br />Search for players or share your QR code.
                </div>
              ) : (
                <>
                  {friends.length > 0 && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                      Your Friends ({friends.length})
                    </div>
                  )}
                  {friends.map((f) => (
                    <div key={f.username}
                      onClick={() => setViewingProfile(f)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                        background: "var(--surface)", border: "1px solid var(--border-mid)", marginBottom: 8,
                      }}>
                      <Avatar name={f.username} idx={f.username.charCodeAt(0) % 6} size={36} fontSize={14} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>@{f.username}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>Tap to view profile</div>
                      </div>
                      <span style={{ fontSize: 16, color: "var(--text-3)" }}>›</span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Search */}
      {section === "search" && (
        <>
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by username..." autoFocus
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 12,
              border: "1.5px solid var(--border-mid)", background: "var(--surface)",
              color: "var(--text)", fontSize: 14, outline: "none",
              fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12,
            }} />
          {searching && <div style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center" }}>Searching...</div>}
          {!searching && searchQuery.trim() && searchResults.length === 0 && (
            <div style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", paddingTop: 20 }}>
              No users found for "{searchQuery}"
            </div>
          )}
          {searchResults.map((u) => (
            <div key={u.username} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 12,
              background: "var(--surface)", border: "1px solid var(--border-mid)", marginBottom: 8,
            }}>
              <Avatar name={u.username} idx={u.username.charCodeAt(0) % 6} size={36} fontSize={14} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>@{u.username}</div>
              </div>
              {u.status === "friends" && <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 600 }}>✓ Friends</span>}
              {u.status === "pending_sent" && <span style={{ fontSize: 12, color: "var(--text-3)" }}>Requested</span>}
              {u.status === "pending_received" && (
                <button onClick={() => acceptRequest(u.friendshipId!, u.username)} disabled={actionLoading === u.username}
                  style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, border: "none", background: "var(--green)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                  Accept
                </button>
              )}
              {u.status === "none" && (
                <button onClick={() => sendFriendRequest(u.username)} disabled={actionLoading === u.username}
                  style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, border: "none", background: "var(--green)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                  {actionLoading === u.username ? "..." : "Add"}
                </button>
              )}
            </div>
          ))}
        </>
      )}

      {/* QR Code */}
      {section === "qr" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, gap: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", textAlign: "center" }}>@{username}</div>
          <div style={{ fontSize: 13, color: "var(--text-3)", textAlign: "center" }}>Share this QR code or link to add friends</div>
          <div style={{ background: "#fff", padding: 16, borderRadius: 16, border: "1px solid var(--border-mid)", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(profileUrl)}`}
              alt="QR code" style={{ width: 180, height: 180, display: "block" }} />
          </div>
          <div style={{ width: "100%", padding: "10px 14px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border-mid)", fontSize: 12, color: "var(--text-3)", wordBreak: "break-all", textAlign: "center" }}>
            {profileUrl}
          </div>
          <button onClick={() => navigator.clipboard.writeText(profileUrl)}
            style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", background: "var(--green)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
            Copy invite link
          </button>
        </div>
      )}
    </div>
  );
}
