import React, { useState, useEffect } from "react";
import { Game, SkillLevel, Privacy } from "../types";
import { PHYSICAL_SPORTS, ESPORTS } from "../data/sports";
import { CITY_COORDS } from "../utils";
import LocationAutocomplete from "../components/LocationAutocomplete";

interface PostForm {
  sport: string;
  location: string;
  city: string;
  lat: number;
  lng: number;
  date: string;
  time: string;
  duration: string;
  spots: string;
  skillLevel: SkillLevel;
  privacy: Privacy;
  groundCost: string;
  recurring: boolean;
  waitlistMax: number;
  note: string;
}

const DEFAULT_FORM: PostForm = {
  sport: "",
  location: "",
  city: "",
  lat: 0,
  lng: 0,
  date: "",
  time: "",
  duration: "60",
  spots: "10",
  skillLevel: "all",
  privacy: "public",
  groundCost: "",
  recurring: false,
  waitlistMax: 0,
  note: "",
};

const SPORT_TABS = [
  { id: "physical", label: "⚽ Physical" },
  { id: "esports",  label: "🎮 E-Sports" },
];

const DURATIONS    = [30, 45, 60, 90, 120, 150, 180];
const SPOT_OPTIONS = [2, 4, 6, 8, 10, 12, 14, 16, 20, 24];

const SKILL_OPTIONS: { id: SkillLevel; label: string; desc: string }[] = [
  { id: "all",          label: "All levels",   desc: "Everyone welcome" },
  { id: "beginner",     label: "Beginner",     desc: "Just for fun" },
  { id: "intermediate", label: "Intermediate", desc: "Some experience" },
  { id: "advanced",     label: "Advanced",     desc: "Competitive" },
];

interface Props {
  onPost: (game: Omit<Game, "id">) => void;
  onSuccess: () => void;
  username: string;
}

export default function PostPage({ onPost, onSuccess, username }: Props) {
  const [form, setForm]       = useState<PostForm>(DEFAULT_FORM);
  const [error, setError]     = useState("");
  const [sportTab, setSportTab] = useState<"physical"|"esports">("physical");
  const [customSport, setCustomSport] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [resolvedCoords, setResolvedCoords] = useState<{lat: number; lng: number} | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const numSpots      = parseInt(form.spots) || 0;
  const groundCostNum = parseFloat(form.groundCost) || 0;
  const costPerPlayer = numSpots > 0 && groundCostNum > 0
    ? parseFloat((groundCostNum / numSpots).toFixed(2))
    : 0;

  function set<K extends keyof PostForm>(key: K, value: PostForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setResolvedCoords(null);
    setResolvedAddress("");
    setError("");
  }

  useEffect(() => {
    if (!form.location.trim() || !form.city.trim()) {
      setResolvedCoords(null);
      setResolvedAddress("");
      return;
    }
    const timer = setTimeout(async () => {
      const coords = await geocodeLocation(form.location.trim(), form.city.trim());
      if (coords) setResolvedCoords(coords);
    }, 800);
    return () => clearTimeout(timer);
  }, [form.location, form.city]);

  async function geocodeLocation(location: string, city: string): Promise<{lat: number; lng: number} | null> {
    try {
      const query = encodeURIComponent(`${location}, ${city}`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      if (data && data[0]) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
      return null;
    } catch {
      return null;
    }
  }

  async function submit() {
    if (!form.sport)           return setError("Pick a sport");
    if (form.sport === "custom" && !customSport.trim()) return setError("Enter a sport or game name");
    if (!form.location.trim()) return setError("Add a location");
    if (!form.city.trim())     return setError("Add a city — search and select from the dropdown");
    if (!form.date)            return setError("Pick a date");
    if (!form.time)            return setError("Pick a time");

    setGeocoding(true);

    // Use coords from autocomplete if available, otherwise fall back to geocoding
    let coords = { lat: form.lat, lng: form.lng };
    if (!coords.lat && !coords.lng) {
      const geocoded = await geocodeLocation(form.location.trim(), form.city.trim());
      if (geocoded) {
        coords = geocoded;
      } else {
        const cityKey = form.city.trim().toLowerCase();
        coords = CITY_COORDS[cityKey] ?? { lat: 0, lng: 0 };
      }
    }

    setGeocoding(false);

    onPost({
      sport:        form.sport === "custom" ? customSport.trim().toLowerCase() || "other" : form.sport,
      location:     form.location.trim(),
      city:         form.city.trim(),
      lat:          coords.lat,
      lng:          coords.lng,
      date:         form.date,
      time:         form.time,
      duration:     parseInt(form.duration),
      spots:        numSpots,
      players:      [username],
      note:         form.note.trim(),
      host:         username,
      hostIdx:      0,
      skillLevel:   form.skillLevel,
      privacy:      form.privacy,
      groundCost:   groundCostNum,
      recurring:    form.recurring,
      waitlistMax:  form.waitlistMax,
      waitlist:     [],
      costPerPlayer,
      joinRequests: [],
    });

    setForm(DEFAULT_FORM);
    onSuccess();
  }

  return (
    <div className="form-section">

      <div className="form-group">
        <label className="form-label">Sport</label>
        <div className="sport-category-tabs">
          {SPORT_TABS.map((t) => (
            <button
              key={t.id}
              className={`sport-cat-tab ${sportTab === t.id ? "active" : ""}`}
              onClick={() => setSportTab(t.id as "physical"|"esports")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="sport-grid">
          {(sportTab === "physical" ? PHYSICAL_SPORTS : ESPORTS).map((s) => (
            <button
              key={s.id}
              className={`sport-select-btn ${form.sport === s.id ? "selected" : ""}`}
              onClick={() => { set("sport", s.id); setCustomSport(""); }}
            >
              {s.icon.startsWith("img:") ? (
                <img
                  src={`/${s.icon.replace("img:", "")}`}
                  alt={s.label}
                  style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 4 }}
                />
              ) : (
                <span className="s-icon">{s.icon}</span>
              )}
              <span className="s-label">{s.label}</span>
            </button>
          ))}
          <button
            className={`sport-select-btn ${form.sport === "custom" ? "selected" : ""}`}
            onClick={() => set("sport", "custom")}
          >
            <span className="s-icon">✏️</span>
            <span className="s-label">Other</span>
          </button>
        </div>
        {form.sport === "custom" && (
          <input
            className="form-input"
            placeholder={sportTab === "esports" ? "e.g. Valorant, Apex Legends..." : "e.g. Lacrosse, Handball..."}
            value={customSport}
            onChange={(e) => setCustomSport(e.target.value)}
            style={{ marginTop: 8 }}
          />
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Recurring</label>
        <div className="privacy-toggle" style={{ marginBottom: 0 }}>
          <button
            className={`privacy-btn ${!form.recurring ? "active" : ""}`}
            onClick={() => set("recurring", false)}
          >
            <div className="privacy-btn-label">One-time</div>
            <div className="privacy-btn-desc">Single game event</div>
          </button>
          <button
            className={`privacy-btn ${form.recurring ? "active" : ""}`}
            onClick={() => set("recurring", true)}
          >
            <div className="privacy-btn-label">Recurring 🔁</div>
            <div className="privacy-btn-desc">Repeats weekly</div>
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Waitlist</label>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <label style={{ fontSize: 13, color: "var(--text-2)" }}>Allow waitlist</label>
          <button
            onClick={() => set("waitlistMax", form.waitlistMax > 0 ? 0 : 3)}
            style={{
              width: 40, height: 22, borderRadius: 11, border: "none",
              background: form.waitlistMax > 0 ? "var(--green)" : "var(--border-mid)",
              cursor: "pointer", position: "relative", transition: "background 0.2s",
            }}
          >
            <span style={{
              position: "absolute", top: 2, width: 18, height: 18, borderRadius: "50%",
              background: "white", transition: "left 0.2s",
              left: form.waitlistMax > 0 ? 20 : 2,
            }} />
          </button>
        </div>
        {form.waitlistMax > 0 && (
          <div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8 }}>
              Max waitlist size: <strong style={{ color: "var(--text)" }}>{form.waitlistMax}</strong>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[1,2,3,4,5].map((n) => (
                <button
                  key={n}
                  onClick={() => set("waitlistMax", n)}
                  className={`radius-chip ${form.waitlistMax === n ? "active" : ""}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Visibility</label>
        <div className="privacy-toggle">
          <button
            className={`privacy-btn ${form.privacy === "public" ? "active" : ""}`}
            onClick={() => set("privacy", "public")}
          >
            <PublicIcon />
            <div>
              <div className="privacy-btn-label">Public</div>
              <div className="privacy-btn-desc">Anyone can join instantly</div>
            </div>
          </button>
          <button
            className={`privacy-btn ${form.privacy === "private" ? "active" : ""}`}
            onClick={() => set("privacy", "private")}
          >
            <LockIcon />
            <div>
              <div className="privacy-btn-label">Private</div>
              <div className="privacy-btn-desc">You approve each request</div>
            </div>
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Skill level</label>
        <div className="skill-options">
          {SKILL_OPTIONS.map((sk) => (
            <button
              key={sk.id}
              className={`skill-option ${form.skillLevel === sk.id ? "active" : ""}`}
              onClick={() => set("skillLevel", sk.id)}
            >
              <div className="skill-option-label">{sk.label}</div>
              <div className="skill-option-desc">{sk.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Location / venue</label>
        <LocationAutocomplete
          value={form.location}
          onChange={(v) => set("location", v)}
          onSelect={(location, city, lat, lng) => {
            set("location", location);
            set("city", city);
            set("lat", lat);
            set("lng", lng);
          }}
          placeholder="Search venue or address..."
          className="form-input"
        />
        {form.city ? (
          <div style={{ fontSize: 11, color: "var(--green)", marginTop: 4 }}>
            📍 {form.city}
          </div>
        ) : null}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Date</label>
          <input
            className="form-input"
            type="date"
            min={tomorrow}
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Time</label>
          <input
            className="form-input"
            type="time"
            value={form.time}
            onChange={(e) => set("time", e.target.value)}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Duration</label>
          <select
            className="form-select"
            value={form.duration}
            onChange={(e) => set("duration", e.target.value)}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>{d} min</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Max players</label>
          <select
            className="form-select"
            value={form.spots}
            onChange={(e) => set("spots", e.target.value)}
          >
            {SPOT_OPTIONS.map((s) => (
              <option key={s} value={s}>{s} players</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Ground cost (optional)</label>
        <div className="cost-row">
          <div className="cost-input-wrap">
            <span className="cost-prefix">$</span>
            <input
              className="form-input cost-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.groundCost}
              onChange={(e) => set("groundCost", e.target.value)}
            />
          </div>
          {costPerPlayer > 0 && (
            <div className="cost-preview">
              <span className="cost-preview-amt">${costPerPlayer.toFixed(2)}</span>
              <span className="cost-preview-label">per player</span>
            </div>
          )}
        </div>
        {groundCostNum > 0 && (
          <div className="cost-note">
            ${groundCostNum.toFixed(2)} total ÷ {numSpots} players = ${costPerPlayer.toFixed(2)} each
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Notes (optional)</label>
        <textarea
          className="form-textarea"
          placeholder="What to bring, any rules..."
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
        />
      </div>

      {error && <div className="form-error">{error}</div>}

      <button className="submit-btn" onClick={submit} disabled={geocoding}>
        {geocoding ? "Finding location..." : "Post game"}
      </button>
    </div>
  );
}

function PublicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 1.5C6 4 5 6 5 8s1 4 3 6.5M8 1.5C10 4 11 6 11 8s-1 4-3 6.5M1.5 8h13" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="7" width="10" height="7.5" rx="1.5" />
      <path d="M5 7V5a3 3 0 016 0v2" />
    </svg>
  );
}
