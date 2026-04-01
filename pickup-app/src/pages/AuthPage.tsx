import React, { useState, useEffect } from "react";
import { User } from "../types";
import { supabase } from "../lib/supabase";

interface Props {
  onAuth: (user: User) => void;
}

type Mode = "login" | "signup";
type SignupStep = "details" | "verify" | "password" | "done";

const EMAIL_API = "https://pickup-api-n8uj.onrender.com";

function validatePassword(p: string): string | null {
  if (p.length < 7)        return "At least 7 characters";
  if (!/[A-Z]/.test(p))   return "At least one uppercase letter";
  if (!/[a-z]/.test(p))   return "At least one lowercase letter";
  if (!/[0-9]/.test(p))   return "At least one number";
  return null;
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { label: "7+ chars",   pass: password.length >= 7 },
    { label: "Uppercase",  pass: /[A-Z]/.test(password) },
    { label: "Lowercase",  pass: /[a-z]/.test(password) },
    { label: "Number",     pass: /[0-9]/.test(password) },
  ];
  const passed = checks.filter((c) => c.pass).length;
  const color  = passed <= 1 ? "#E24B4A" : passed <= 2 ? "#EF9F27" : passed <= 3 ? "#5DCAA5" : "#1D9E75";
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
        {checks.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2,
            background: i < passed ? color : "var(--border-mid)", transition: "background 0.2s" }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px" }}>
        {checks.map((c) => (
          <span key={c.label} style={{ fontSize: 10, color: c.pass ? "#1D9E75" : "var(--text-3)",
            display: "flex", alignItems: "center", gap: 3 }}>
            {c.pass ? "✓" : "○"} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ margin: "16px 0" }}>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={value}
        placeholder="Enter 6-digit code"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        style={{
          width: "100%",
          height: 52,
          textAlign: "center",
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: 12,
          border: "1.5px solid var(--border-mid)",
          borderRadius: 8,
          background: "var(--surface)",
          color: "var(--text)",
          outline: "none",
          fontFamily: "inherit",
          boxSizing: "border-box",
          padding: "0 16px",
        }}
      />
    </div>
  );
}

export default function AuthPage({ onAuth }: Props) {
  const [mode, setMode]               = useState<Mode>("login");
  const [step, setStep]               = useState<SignupStep>("details");

  const [username, setUsername]       = useState("");
  const [email, setEmail]             = useState("");
  const [code, setCode]               = useState("");
  const [generatedCode, setGenerated] = useState("");
  const [password, setPassword]       = useState("");
  const [confirmPw, setConfirmPw]     = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loginUser, setLoginUser]     = useState("");
  const [loginPw, setLoginPw]         = useState("");

  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer((n) => n - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  function clear() { setError(""); }

  async function sendCode(em: string) {
    setResendTimer(30);
    try {
      const res = await fetch(`${EMAIL_API}/send-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      if (!res.ok) throw new Error("API error");
      setGenerated("");
    } catch {
      const c = Math.floor(100000 + Math.random() * 900000).toString();
      setGenerated(c);
      console.log(`[PickUp fallback] Code for ${em}: ${c}`);
    }
  }

  async function submitDetails() {
    const u  = username.trim().toLowerCase();
    const em = email.trim().toLowerCase();
    if (!u)                        return setError("Enter a username");
    if (!em || !em.includes("@")) return setError("Enter a valid email");

    setLoading(true);

    const { data: takenUser } = await supabase
      .from("users").select("username").eq("username", u).maybeSingle();
    if (takenUser) { setLoading(false); return setError("Username already taken"); }

    const { data: takenEmail } = await supabase
      .from("users").select("email").eq("email", em).maybeSingle();
    if (takenEmail) { setLoading(false); return setError("An account with this email already exists"); }

    await sendCode(em);
    setLoading(false);
    setStep("verify");
    setError("");
  }

  async function submitCode() {
    if (code.length < 6) return setError("Enter the full 6-digit code");

    if (!generatedCode) {
      try {
        const res  = await fetch(`${EMAIL_API}/verify-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code }),
        });
        const data = await res.json();
        if (!data.valid) return setError("Incorrect code — check and try again");
        setStep("password");
        setCode("");
        setError("");
        return;
      } catch {
        return setError("Could not verify — check server is running");
      }
    }

    if (code !== generatedCode) return setError("Incorrect code — check and try again");
    setStep("password");
    setCode("");
    setError("");
  }

  async function submitPassword() {
    const pwErr = validatePassword(password);
    if (pwErr)                  return setError(pwErr);
    if (password !== confirmPw) return setError("Passwords don't match");

    setLoading(true);

    const { error: insertErr } = await supabase.from("users").insert({
      username:      username.trim().toLowerCase(),
      email:         email.trim().toLowerCase(),
      password_hash: password,
    });

    setLoading(false);

    if (insertErr) {
      if (insertErr.code === "23505") return setError("Username or email already taken");
      return setError("Could not create account — try again");
    }

    setStep("done");
  }

  function finishSignup() {
    onAuth({ username: username.trim().toLowerCase() });
  }

  async function submitLogin() {
    const u = loginUser.trim().toLowerCase();
    const p = loginPw;
    if (!u) return setError("Enter your username");
    if (!p) return setError("Enter your password");

    setLoading(true);

    const { data } = await supabase
      .from("users")
      .select("username, password_hash")
      .eq("username", u)
      .maybeSingle();

    setLoading(false);

    if (!data)                    return setError("Account not found");
    if (data.password_hash !== p) return setError("Wrong password");
    onAuth({ username: u });
  }

  function switchMode(m: Mode) {
    setMode(m);
    setStep("details");
    setError("");
    setUsername(""); setEmail(""); setCode(""); setPassword(""); setConfirmPw("");
    setLoginUser(""); setLoginPw("");
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo">Pick<em>Up</em></div>
      <div className="auth-tagline">Find your next game.</div>

      <div className="auth-card">
        <div className="auth-tabs">
          <button className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => switchMode("login")}>Log in</button>
          <button className={`auth-tab ${mode === "signup" ? "active" : ""}`}
            onClick={() => switchMode("signup")}>Create account</button>
        </div>

        {mode === "login" && (
          <>
            <div className="auth-fields">
              <div className="auth-field-group">
                <label className="auth-label">Username</label>
                <input className="auth-input" placeholder="your username"
                  value={loginUser} autoCapitalize="none" autoCorrect="off"
                  onChange={(e) => { setLoginUser(e.target.value); clear(); }}
                  onKeyDown={(e) => e.key === "Enter" && submitLogin()} />
              </div>
              <div className="auth-field-group">
                <label className="auth-label">Password</label>
                <div style={{ position: "relative" }}>
                  <input className="auth-input" type={showPw ? "text" : "password"}
                    placeholder="••••••••" value={loginPw}
                    onChange={(e) => { setLoginPw(e.target.value); clear(); }}
                    onKeyDown={(e) => e.key === "Enter" && submitLogin()}
                    style={{ paddingRight: 40 }} />
                  <button onClick={() => setShowPw(!showPw)} style={eyeBtn}>
                    {showPw ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className={`auth-submit ${loading ? "loading" : ""}`}
              onClick={submitLogin} disabled={loading}>
              {loading ? "..." : "Log in"}
            </button>
          </>
        )}

        {mode === "signup" && step === "details" && (
          <>
            <div className="auth-step-indicator">
              <StepDots total={3} current={0} />
            </div>
            <div className="auth-fields">
              <div className="auth-field-group">
                <label className="auth-label">Username</label>
                <input className="auth-input" placeholder="e.g. jordan23"
                  value={username} autoCapitalize="none" autoCorrect="off"
                  onChange={(e) => { setUsername(e.target.value); clear(); }} />
              </div>
              <div className="auth-field-group">
                <label className="auth-label">Email</label>
                <input className="auth-input" placeholder="you@example.com"
                  type="email" value={email}
                  onChange={(e) => { setEmail(e.target.value); clear(); }}
                  onKeyDown={(e) => e.key === "Enter" && submitDetails()} />
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className={`auth-submit ${loading ? "loading" : ""}`}
              onClick={submitDetails} disabled={loading}>
              {loading ? "Checking..." : "Continue"}
            </button>
          </>
        )}

        {mode === "signup" && step === "verify" && (
          <>
            <div className="auth-step-indicator">
              <StepDots total={3} current={1} />
            </div>
            <div className="auth-verify-title">Check your email</div>
            <div className="auth-verify-sub">
              We sent a 6-digit code to <strong>{email}</strong>
            </div>
            {generatedCode && (
              <div className="auth-verify-demo">
                Demo code: <strong>{generatedCode}</strong>
              </div>
            )}
            <CodeInput value={code} onChange={(v) => { setCode(v); clear(); }} />
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-submit" onClick={submitCode} disabled={code.length < 6}>
              Verify
            </button>
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button
                onClick={() => { sendCode(email); setCode(""); clear(); }}
                disabled={resendTimer > 0}
                style={{ background: "none", border: "none", cursor: resendTimer > 0 ? "not-allowed" : "pointer",
                  fontSize: 12, color: resendTimer > 0 ? "var(--text-3)" : "var(--green)",
                  fontFamily: "inherit" }}>
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
              </button>
            </div>
          </>
        )}

        {mode === "signup" && step === "password" && (
          <>
            <div className="auth-step-indicator">
              <StepDots total={3} current={2} />
            </div>
            <div className="auth-fields">
              <div className="auth-field-group">
                <label className="auth-label">Password</label>
                <div style={{ position: "relative" }}>
                  <input className="auth-input" type={showPw ? "text" : "password"}
                    placeholder="••••••••" value={password}
                    onChange={(e) => { setPassword(e.target.value); clear(); }}
                    style={{ paddingRight: 40 }} />
                  <button onClick={() => setShowPw(!showPw)} style={eyeBtn}>
                    {showPw ? "🙈" : "👁️"}
                  </button>
                </div>
                <PasswordStrength password={password} />
              </div>
              <div className="auth-field-group">
                <label className="auth-label">Confirm password</label>
                <div style={{ position: "relative" }}>
                  <input className="auth-input" type={showConfirm ? "text" : "password"}
                    placeholder="••••••••" value={confirmPw}
                    onChange={(e) => { setConfirmPw(e.target.value); clear(); }}
                    onKeyDown={(e) => e.key === "Enter" && submitPassword()}
                    style={{ paddingRight: 40 }} />
                  <button onClick={() => setShowConfirm(!showConfirm)} style={eyeBtn}>
                    {showConfirm ? "🙈" : "👁️"}
                  </button>
                </div>
                {confirmPw && (
                  <div style={{ fontSize: 11, marginTop: 5,
                    color: confirmPw === password ? "#1D9E75" : "#E24B4A" }}>
                    {confirmPw === password ? "✓ Passwords match" : "✗ Passwords don't match"}
                  </div>
                )}
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className={`auth-submit ${loading ? "loading" : ""}`}
              onClick={submitPassword} disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </>
        )}

        {mode === "signup" && step === "done" && (
          <div className="auth-done">
            <div className="auth-done-icon">🎉</div>
            <div className="auth-done-title">You're all set!</div>
            <div className="auth-done-sub">Welcome to PickUp, <strong>{username}</strong></div>
            <button className="auth-submit" onClick={finishSignup} style={{ marginTop: 20 }}>
              Start playing
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 14 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 20 : 7, height: 7, borderRadius: 4,
          background: i <= current ? "var(--green)" : "var(--border-mid)",
          transition: "all 0.2s",
        }} />
      ))}
    </div>
  );
}

const eyeBtn: React.CSSProperties = {
  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
  background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 0,
};