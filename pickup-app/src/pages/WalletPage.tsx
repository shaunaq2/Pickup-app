import React, { useState } from "react";
import { WalletTx } from "../types";

const TOP_UP_OPTIONS = [5, 10, 20, 50];

type PayMethod = "card" | "apple" | "paypal" | "venmo";

interface PayOption {
  id: PayMethod;
  label: string;
  icon: string;
  detail: string;
}

const PAY_OPTIONS: PayOption[] = [
  { id: "card",   label: "Credit / Debit card", icon: "💳", detail: "Visa, Mastercard, Amex" },
  { id: "apple",  label: "Apple Pay",            icon: "🍎", detail: "Touch ID or Face ID" },
  { id: "paypal", label: "PayPal",               icon: "🅿️", detail: "Pay with your PayPal balance" },
  { id: "venmo",  label: "Venmo",                icon: "✌️", detail: "Pay with Venmo" },
];

interface Props {
  balance: number;
  transactions: WalletTx[];
  onTopUp: (amount: number) => void;
}

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

type Step = "amount" | "method" | "confirm";

export default function WalletPage({ balance, transactions, onTopUp }: Props) {
  const [step, setStep]         = useState<Step>("amount");
  const [amount, setAmount]     = useState<number | null>(null);
  const [method, setMethod]     = useState<PayMethod | null>(null);
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);

  function goToMethod() {
    if (!amount) return;
    setStep("method");
  }

  function goToConfirm() {
    if (!method) return;
    setStep("confirm");
  }

  function handlePay() {
    if (!amount) return;
    setLoading(true);
    setTimeout(() => {
      onTopUp(amount);
      setLoading(false);
      setSuccess(true);
      setAmount(null);
      setMethod(null);
      setStep("amount");
      setTimeout(() => setSuccess(false), 2500);
    }, 900);
  }

  const selectedMethod = PAY_OPTIONS.find((p) => p.id === method);

  return (
    <>
      <div className="wallet-balance-card">
        <div className="wallet-balance-label">Available credits</div>
        <div className="wallet-balance-amount">${balance.toFixed(2)}</div>
        <div className="wallet-balance-sub">Use credits to book spots in paid games</div>
      </div>

      <div className="wallet-section">
        <div className="wallet-section-title">Add credits</div>

        {success ? (
          <div className="topup-success">
            ✓ ${amount ?? ""} added to your wallet
          </div>
        ) : step === "amount" ? (
          <>
            <div className="topup-grid">
              {TOP_UP_OPTIONS.map((amt) => (
                <button
                  key={amt}
                  className={`topup-btn ${amount === amt ? "active" : ""}`}
                  onClick={() => setAmount(amt === amount ? null : amt)}
                >
                  <span className="topup-amt">${amt}</span>
                  <span className="topup-credits">{amt * 10} pts</span>
                </button>
              ))}
            </div>
            <button
              className={`submit-btn ${!amount ? "disabled-btn" : ""}`}
              onClick={goToMethod}
              disabled={!amount}
            >
              {amount ? `Continue with $${amount}` : "Select an amount"}
            </button>
          </>
        ) : step === "method" ? (
          <>
            <div className="pay-method-list">
              {PAY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  className={`pay-method-btn ${method === opt.id ? "active" : ""}`}
                  onClick={() => setMethod(opt.id)}
                >
                  <span className="pay-method-icon">{opt.icon}</span>
                  <div className="pay-method-body">
                    <div className="pay-method-label">{opt.label}</div>
                    <div className="pay-method-detail">{opt.detail}</div>
                  </div>
                  <div className={`pay-method-radio ${method === opt.id ? "checked" : ""}`} />
                </button>
              ))}
            </div>
            <div className="topup-step-actions">
              <button className="step-back-btn" onClick={() => { setStep("amount"); setMethod(null); }}>
                Back
              </button>
              <button
                className={`submit-btn step-continue ${!method ? "disabled-btn" : ""}`}
                onClick={goToConfirm}
                disabled={!method}
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="confirm-card">
              <div className="confirm-row">
                <span className="confirm-label">Amount</span>
                <span className="confirm-val">${amount?.toFixed(2)}</span>
              </div>
              <div className="confirm-row">
                <span className="confirm-label">Payment</span>
                <span className="confirm-val">
                  {selectedMethod?.icon} {selectedMethod?.label}
                </span>
              </div>
              <div className="confirm-row confirm-total">
                <span className="confirm-label">Credits added</span>
                <span className="confirm-val confirm-green">${amount?.toFixed(2)}</span>
              </div>
            </div>
            <div className="topup-step-actions">
              <button className="step-back-btn" onClick={() => setStep("method")}>
                Back
              </button>
              <button
                className={`submit-btn step-continue ${loading ? "disabled-btn" : ""}`}
                onClick={handlePay}
                disabled={loading}
              >
                {loading ? "Processing..." : "Confirm payment"}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="wallet-section">
        <div className="wallet-section-title">Transaction history</div>
        {transactions.length === 0 ? (
          <div className="wallet-empty">No transactions yet.</div>
        ) : (
          <div className="tx-list">
            {transactions.map((tx) => (
              <div key={tx.id} className="tx-row">
                <div className="tx-icon-wrap">
                  <div className={`tx-icon tx-${tx.type}`}>
                    {tx.type === "topup" ? "+" : tx.type === "refund" ? "↩" : "−"}
                  </div>
                </div>
                <div className="tx-body">
                  <div className="tx-label">{tx.label}</div>
                  <div className="tx-time">{timeAgo(tx.timestamp)}</div>
                </div>
                <div className={`tx-amount tx-amount-${tx.type}`}>
                  {tx.type === "join" ? "−" : "+"}${Math.abs(tx.amount).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
