import React, { useState } from "react";
import { User, WalletTx } from "../types";

interface Props {
  user: User;
  balance: number;
  transactions: WalletTx[];
  onTopUp: (amount: number) => void;
  onLogout: () => void;
}

type Section = "main" | "wallet" | "topup";

const TOP_UP_AMOUNTS = [5, 10, 20, 50];
const PAYMENT_METHODS = [
  { id: "card",    label: "Credit / Debit Card", icon: "💳" },
  { id: "apple",   label: "Apple Pay",            icon: "🍎" },
  { id: "paypal",  label: "PayPal",               icon: "🅿️" },
  { id: "venmo",   label: "Venmo",                icon: "💙" },
];

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function SettingsPage({ user, balance, transactions, onTopUp, onLogout }: Props) {
  const [section, setSection]       = useState<Section>("main");
  const [topUpAmount, setTopUpAmount] = useState(10);
  const [payMethod, setPayMethod]   = useState("card");
  const [confirming, setConfirming] = useState(false);

  function doTopUp() {
    onTopUp(topUpAmount);
    setConfirming(false);
    setSection("wallet");
  }

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
            <button className="submit-btn" style={{ marginTop: 20 }} onClick={doTopUp}>
              Confirm
            </button>
            <button className="settings-back" style={{ textAlign: "center", marginTop: 10, display: "block" }}
              onClick={() => setConfirming(false)}>
              Cancel
            </button>
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
              <button key={a}
                className={`radius-chip ${topUpAmount === a ? "active" : ""}`}
                style={{ fontSize: 14, padding: "8px 16px" }}
                onClick={() => setTopUpAmount(a)}>
                ${a}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Payment method</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PAYMENT_METHODS.map((m) => (
              <button key={m.id}
                onClick={() => setPayMethod(m.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 10,
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
        <button className="submit-btn" onClick={() => setConfirming(true)}>
          Add ${topUpAmount.toFixed(2)}
        </button>
      </div>
    );
  }

  if (section === "wallet") {
    return (
      <div className="settings-section">
        <button className="settings-back" onClick={() => setSection("main")}>← Back</button>
        <div className="wallet-balance-card">
          <div className="wallet-balance-label">Available balance</div>
          <div className="wallet-balance-amount">${balance.toFixed(2)}</div>
          <button className="wallet-topup-btn" onClick={() => setSection("topup")}>
            + Add credits
          </button>
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

  // Main settings
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

      {/* Wallet row */}
      <button className="settings-row" onClick={() => setSection("wallet")}>
        <span className="settings-row-icon">💰</span>
        <div className="settings-row-body">
          <div className="settings-row-label">Wallet</div>
          <div className="settings-row-sub">Balance: <strong>${balance.toFixed(2)}</strong></div>
        </div>
        <span className="settings-row-arrow">›</span>
      </button>

      {/* Divider */}
      <div className="settings-divider" />

      {/* Preferences */}
      <div className="settings-group-label">Preferences</div>
      <div className="settings-row static">
        <span className="settings-row-icon">🔔</span>
        <div className="settings-row-body">
          <div className="settings-row-label">Notifications</div>
          <div className="settings-row-sub">Email alerts enabled</div>
        </div>
      </div>
      <div className="settings-row static">
        <span className="settings-row-icon">🔒</span>
        <div className="settings-row-body">
          <div className="settings-row-label">Privacy</div>
          <div className="settings-row-sub">Profile visible to other players</div>
        </div>
      </div>

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

      {/* Logout */}
      <button className="settings-logout-btn" onClick={onLogout}>
        Log out
      </button>
    </div>
  );
}
