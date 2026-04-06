import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { User, WalletTx } from "../types";
import FriendsPage from "./FriendsPage";
import Avatar from "../components/Avatar";

interface Props {
  user: User;
  balance: number;
  transactions: WalletTx[];
  onTopUp: (amount: number) => void;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

type Section = "main" | "wallet" | "topup" | "friends" | "notifications" | "privacy";

const TOP_UP_AMOUNTS = [5, 10, 20, 50];
const PAYMENT_METHODS = [
  { id: "card",   label: "Credit / Debit Card", icon: "💳" },
  { id: "apple",  label: "Apple Pay",            icon: "🍎" },
  { id: "paypal", label: "PayPal",               icon: "🅿️" },
  { id: "venmo",  label: "Venmo",                icon: "💙" },
];

// Notification preferences stored in localStorage
type NotifPrefs = {
  gameJoined: boolean;
  gameLeft: boolean;
  requestReceived: boolean;
  requestApproved: boolean;
  requestDenied: boolean;
  offWaitlist: boolean;
  friendRequest: boolean;
  friendAccepted: boolean;
  gameInvite: boolean;
  emailAlerts: boolean;
};

const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  gameJoined:      true,
  gameLeft:        true,
  requestReceived: true,
  requestApproved: true,
  requestDenied:   true,
  offWaitlist:     true,
  friendRequest:   true,
  friendAccepted:  true,
  gameInvite:      true,
  emailAlerts:     true,
};

function loadNotifPrefs(): NotifPrefs {
  try {
    const stored = localStorage.getItem("notif_prefs");
    return stored ? { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(stored) } : DEFAULT_NOTIF_PREFS;
  } catch { return DEFAULT_NOTIF_PREFS; }
}

function saveNotifPrefs(prefs: NotifPrefs) {
  localStorage.setItem("notif_prefs", JSON.stringify(prefs));
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 26, borderRadius: 13, flexShrink: 0,
        background: value ? "var(--green)" : "var(--border-mid)",
        position: "relative", cursor: "pointer",
        transition: "background 0.2s",
      }}
    >
      <div style={{
        position: "absolute", top: 3,
        left: value ? 21 : 3,
        width: 20, height: 20, borderRadius: "50%",
        background: "#fff",
        transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </div>
  );
}

function NotifRow({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 0", borderBottom: "1px solid var(--border)",
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 1 }}>{sub}</div>}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

export default function SettingsPage({ user, balance, transactions, onTopUp, onLogout, darkMode, onToggleDarkMode }: Props) {
  const [section, setSection]         = useState<Section>("main");
  const [topUpAmount, setTopUpAmount] = useState(10);
  const [payMethod, setPayMethod]     = useState("card");
  const [confirming, setConfirming]   = useState(false);
  const [notifPrefs, setNotifPrefs]   = useState<NotifPrefs>(loadNotifPrefs);
  const [installPrompt, setInstallPrompt] = React.useState<any>(null);
  const [installed, setInstalled] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setInstallPrompt(null);
  }

  function updatePref(key: keyof NotifPrefs, value: boolean) {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    saveNotifPrefs(updated);
    // Sync show_games_joined to Supabase so friends can read it
    if (key === "gameJoined") {
      supabase.from("user_prefs").upsert(
        { username: user.username, show_games_joined: value },
        { onConflict: "username" }
      );
    }
  }

  // Sync on mount
  useEffect(() => {
    supabase.from("user_prefs").upsert(
      { username: user.username, show_games_joined: notifPrefs.gameJoined },
      { onConflict: "username" }
    );
  }, [user.username]);

  function doTopUp() {
    onTopUp(topUpAmount);
    setConfirming(false);
    setSection("wallet");
  }

  // ── Friends ──────────────────────────────────────────────
  if (section === "friends") {
    return (
      <div className="settings-section">
        <FriendsPage username={user.username} onBackToSettings={() => setSection("main")} />
      </div>
    );
  }

  // ── Notification Prefs ───────────────────────────────────
  if (section === "notifications") {
    return (
      <div className="settings-section">
        <button className="settings-back" onClick={() => setSection("main")}>← Back</button>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Notifications</div>
        <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 20 }}>
          Choose what you get notified about.
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
          Email
        </div>
        <NotifRow label="Email alerts" sub="Get notified by email for key activity" value={notifPrefs.emailAlerts} onChange={(v) => updatePref("emailAlerts", v)} />

        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 20, marginBottom: 4 }}>
          Games
        </div>
        <NotifRow label="You joined a game"      value={notifPrefs.gameJoined}      onChange={(v) => updatePref("gameJoined", v)} />
        <NotifRow label="You left a game"        value={notifPrefs.gameLeft}        onChange={(v) => updatePref("gameLeft", v)} />
        <NotifRow label="Join request received"  sub="When someone requests to join your game" value={notifPrefs.requestReceived} onChange={(v) => updatePref("requestReceived", v)} />
        <NotifRow label="Request approved"       value={notifPrefs.requestApproved} onChange={(v) => updatePref("requestApproved", v)} />
        <NotifRow label="Request denied"         value={notifPrefs.requestDenied}   onChange={(v) => updatePref("requestDenied", v)} />
        <NotifRow label="Off the waitlist"       sub="When a spot opens up for you" value={notifPrefs.offWaitlist} onChange={(v) => updatePref("offWaitlist", v)} />
        <NotifRow label="Game invite"            sub="When a friend invites you to a game" value={notifPrefs.gameInvite} onChange={(v) => updatePref("gameInvite", v)} />

        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 20, marginBottom: 4 }}>
          Friends
        </div>
        <NotifRow label="Friend request"         value={notifPrefs.friendRequest}   onChange={(v) => updatePref("friendRequest", v)} />
        <NotifRow label="Friend request accepted" value={notifPrefs.friendAccepted} onChange={(v) => updatePref("friendAccepted", v)} />
      </div>
    );
  }

  // ── Privacy ──────────────────────────────────────────────
  if (section === "privacy") {
    return (
      <div className="settings-section">
        <button className="settings-back" onClick={() => setSection("main")}>← Back</button>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Privacy</div>
        <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 20 }}>
          Control who can see your profile and activity.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {[
            { label: "Profile visible to players", sub: "Other players can see your username" },
            { label: "Show in search results",     sub: "People can find you by username" },
            { label: "Show games I've joined",     sub: "Visible to your friends" },
          ].map(({ label, sub }) => (
            <div key={label} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 0", borderBottom: "1px solid var(--border)",
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{label}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 1 }}>{sub}</div>
              </div>
              <Toggle value={true} onChange={() => {}} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Top-up confirm ───────────────────────────────────────
  if (section === "topup") {
    if (confirming) {
      return (
        <div className="settings-section">
          <button className="settings-back" onClick={() => setConfirming(false)}>← Back</button>
          <div className="wallet-confirm-card">
            <div className="wallet-confirm-icon">✅</div>
            <div className="wallet-confirm-title">Confirm top-up</div>
            <div className="wallet-confirm-amount">${topUpAmount.toFixed(2)}</div>
            <div className="wallet-confirm-method">
              {PAYMENT_METHODS.find((m) => m.id === payMethod)?.icon}{" "}
              {PAYMENT_METHODS.find((m) => m.id === payMethod)?.label}
            </div>
            <button className="submit-btn" style={{ marginTop: 20 }} onClick={doTopUp}>Confirm</button>
            <button className="settings-back" style={{ textAlign: "center", marginTop: 10, display: "block" }} onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      );
    }
    return (
      <div className="settings-section">
        <button className="settings-back" onClick={() => setSection("wallet")}>← Back</button>
        <div className="form-group">
          <label className="form-label">Amount</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TOP_UP_AMOUNTS.map((a) => (
              <button key={a} className={`radius-chip ${topUpAmount === a ? "active" : ""}`}
                style={{ fontSize: 14, padding: "8px 16px" }} onClick={() => setTopUpAmount(a)}>
                ${a}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Payment method</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PAYMENT_METHODS.map((m) => (
              <button key={m.id} onClick={() => setPayMethod(m.id)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10,
                border: `1.5px solid ${payMethod === m.id ? "var(--green)" : "var(--border)"}`,
                background: payMethod === m.id ? "var(--green-light)" : "var(--surface)",
                cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}>
                <span style={{ fontSize: 20 }}>{m.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{m.label}</span>
                {payMethod === m.id && <span style={{ marginLeft: "auto", color: "var(--green)" }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
        <button className="submit-btn" onClick={() => setConfirming(true)}>Add ${topUpAmount.toFixed(2)}</button>
      </div>
    );
  }

  // ── Wallet ───────────────────────────────────────────────
  if (section === "wallet") {
    return (
      <div className="settings-section">
        <button className="settings-back" onClick={() => setSection("main")}>← Back</button>
        <div className="wallet-balance-card">
          <div className="wallet-balance-label">Available balance</div>
          <div className="wallet-balance-amount">${balance.toFixed(2)}</div>
          <button className="wallet-topup-btn" onClick={() => setSection("topup")}>+ Add credits</button>
        </div>
        <div className="form-label" style={{ marginTop: 20, marginBottom: 10 }}>Transaction history</div>
        {transactions.length === 0 ? (
          <div className="empty" style={{ paddingTop: 20 }}>
            <div className="empty-icon">💳</div>
            No transactions yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {transactions.map((tx) => (
              <div key={tx.id} className={`tx-row ${tx.type}`}>
                <div>
                  <div className="tx-label">{tx.label}</div>
                  <div className="tx-date">{formatDate(tx.timestamp)}</div>
                </div>
                <div className={`tx-amount ${tx.type === "topup" || tx.type === "refund" ? "credit" : "debit"}`}>
                  {tx.type === "topup" || tx.type === "refund" ? "+" : "-"}${tx.amount.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Main ─────────────────────────────────────────────────
  return (
    <div className="settings-section">

      {/* Profile card */}
      <div className="settings-profile-card">
        <div className="settings-avatar">{user.username[0].toUpperCase()}</div>
        <div>
          <div className="settings-username">@{user.username}</div>
          <div className="settings-member">PickUp member</div>
        </div>
      </div>

      {/* Social */}
      <div className="settings-group-label">Social</div>
      <button className="settings-row" onClick={() => setSection("friends")}>
        <span className="settings-row-icon">👥</span>
        <div className="settings-row-body">
          <div className="settings-row-label">Friends</div>
          <div className="settings-row-sub">Add friends, share QR code</div>
        </div>
        <span className="settings-row-arrow">›</span>
      </button>

      <div className="settings-divider" />

      {/* Install app */}
      {(installPrompt || installed) && (
        <>
          <div className="settings-group-label">App</div>
          <div className="settings-row static">
            <span className="settings-row-icon">📲</span>
            <div className="settings-row-body">
              <div className="settings-row-label">Install RunIt</div>
              <div className="settings-row-sub">{installed ? "App installed on your device" : "Add to your home screen"}</div>
            </div>
            {!installed && (
              <button onClick={handleInstall} style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12,
                border: "none", background: "var(--green)", color: "#fff",
                cursor: "pointer", fontWeight: 600, fontFamily: "inherit",
              }}>Install</button>
            )}
            {installed && <span style={{ fontSize: 18 }}>✓</span>}
          </div>
          <div className="settings-divider" />
        </>
      )}

      {/* Wallet */}
      <div className="settings-group-label">Finance</div>
      <button className="settings-row" onClick={() => setSection("wallet")}>
        <span className="settings-row-icon">💰</span>
        <div className="settings-row-body">
          <div className="settings-row-label">Wallet</div>
          <div className="settings-row-sub">Balance: <strong>${balance.toFixed(2)}</strong></div>
        </div>
        <span className="settings-row-arrow">›</span>
      </button>

      <div className="settings-divider" />

      {/* Preferences */}
      <div className="settings-group-label">Preferences</div>
      <div className="settings-row static">
        <span className="settings-row-icon">{darkMode ? "🌙" : "☀️"}</span>
        <div className="settings-row-body">
          <div className="settings-row-label">Dark mode</div>
          <div className="settings-row-sub">{darkMode ? "On" : "Off"}</div>
        </div>
        <div onClick={onToggleDarkMode} style={{
          width: 44, height: 26, borderRadius: 13,
          background: darkMode ? "var(--green)" : "var(--border-mid)",
          position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
        }}>
          <div style={{
            position: "absolute", top: 3,
            left: darkMode ? 21 : 3,
            width: 20, height: 20, borderRadius: "50%",
            background: "#fff", transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }} />
        </div>
      </div>
      <button className="settings-row" onClick={() => setSection("notifications")}>
        <span className="settings-row-icon">🔔</span>
        <div className="settings-row-body">
          <div className="settings-row-label">Notifications</div>
          <div className="settings-row-sub">
            {Object.values(notifPrefs).filter(Boolean).length} of {Object.keys(notifPrefs).length} enabled
          </div>
        </div>
        <span className="settings-row-arrow">›</span>
      </button>
      <button className="settings-row" onClick={() => setSection("privacy")}>
        <span className="settings-row-icon">🔒</span>
        <div className="settings-row-body">
          <div className="settings-row-label">Privacy</div>
          <div className="settings-row-sub">Profile visibility and data</div>
        </div>
        <span className="settings-row-arrow">›</span>
      </button>

      <div className="settings-divider" />

      {/* About */}
      <div className="settings-group-label">About</div>
      <div className="settings-row static">
        <span className="settings-row-icon">📱</span>
        <div className="settings-row-body">
          <div className="settings-row-label">App version</div>
          <div className="settings-row-sub">PickUp 1.0.0</div>
        </div>
      </div>

      <div className="settings-divider" />

      <button className="settings-logout-btn" onClick={onLogout}>Log out</button>
    </div>
  );
}
