import React, { useState } from "react";
import { SearchFilters, SkillLevel } from "../types";
import { PHYSICAL_SPORTS, ESPORTS } from "../data/sports";

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];
const SKILL_OPTIONS: { id: SkillLevel; label: string; desc: string }[] = [
  { id: "all",          label: "Any level",    desc: "Everyone welcome" },
  { id: "beginner",     label: "Beginner",     desc: "Just for fun" },
  { id: "intermediate", label: "Intermediate", desc: "Some experience" },
  { id: "advanced",     label: "Advanced",     desc: "Competitive" },
];

interface Props {
  filters: SearchFilters;
  onChange: (f: SearchFilters) => void;
  onClose: () => void;
  onReset: () => void;
  userLocation: { lat: number; lng: number } | null;
  locationStatus: "idle" | "requesting" | "granted" | "denied";
  onRequestLocation: () => void;
}

export default function FilterDrawer({
  filters, onChange, onClose, onReset,
  userLocation, locationStatus, onRequestLocation,
}: Props) {
  const [sportTab, setSportTab] = useState<"physical" | "esports">("physical");

  function set<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function toggleMyLocation() {
    if (filters.useMyLocation) {
      set("useMyLocation", false);
      return;
    }
    if (locationStatus === "granted" && userLocation) {
      set("useMyLocation", true);
    } else if (locationStatus === "denied") {
      // already denied — can't do anything
    } else {
      onRequestLocation();
      // useMyLocation will be set once granted — handled by effect below
    }
  }

  // Auto-enable useMyLocation once permission granted
  React.useEffect(() => {
    if (locationStatus === "granted" && userLocation && !filters.useMyLocation) {
      set("useMyLocation", true);
    }
  }, [locationStatus, userLocation]);

  return (
    <div className="drawer-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer">
        <div className="modal-handle" />

        <div className="filter-header">
          <span className="filter-title">Filters</span>
          <button className="filter-reset" onClick={onReset}>Reset all</button>
        </div>

        <div className="drawer-scroll">

          {/* ── Location ────────────────────────────── */}
          <div className="filter-section">
            <div className="filter-section-label">Location</div>

            {/* Use my location toggle */}
            <div className="location-toggle-row">
              <div className="location-toggle-left">
                <span className="location-icon">📍</span>
                <div>
                  <div className="location-toggle-label">Use my location</div>
                  <div className="location-toggle-sub">
                    {locationStatus === "idle"     && "Tap to enable"}
                    {locationStatus === "requesting" && "Requesting..."}
                    {locationStatus === "granted"  && userLocation && "Location active"}
                    {locationStatus === "denied"   && "Permission denied — enable in browser settings"}
                  </div>
                </div>
              </div>
              <button
                onClick={toggleMyLocation}
                disabled={locationStatus === "denied" || locationStatus === "requesting"}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: "none",
                  background: filters.useMyLocation && locationStatus === "granted"
                    ? "var(--green)" : "var(--border-mid)",
                  cursor: locationStatus === "denied" ? "not-allowed" : "pointer",
                  position: "relative", transition: "background 0.2s", flexShrink: 0,
                }}
              >
                <span style={{
                  position: "absolute", top: 3, width: 18, height: 18, borderRadius: "50%",
                  background: "white", transition: "left 0.2s",
                  left: filters.useMyLocation && locationStatus === "granted" ? 23 : 3,
                }} />
              </button>
            </div>

            {/* Manual city input — shown when not using location */}
            {!filters.useMyLocation && (
              <input
                className="form-input"
                placeholder="Or type a city — e.g. Madison, Chicago..."
                value={filters.city}
                onChange={(e) => set("city", e.target.value)}
                style={{ marginTop: 10 }}
              />
            )}

            {/* Radius slider — shown when either location source is active */}
            {(filters.useMyLocation || filters.city.trim()) && (
              <div style={{ marginTop: 12 }}>
                <div className="filter-section-label" style={{ marginBottom: 6 }}>
                  Radius
                  <span className="filter-section-val">{filters.radius} mi</span>
                </div>
                <div className="radius-chips">
                  {RADIUS_OPTIONS.map((r) => (
                    <button
                      key={r}
                      className={`radius-chip ${filters.radius === r ? "active" : ""}`}
                      onClick={() => set("radius", r)}
                    >
                      {r} mi
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Date ────────────────────────────────── */}
          <div className="filter-section">
            <div className="filter-section-label">Date</div>
            <input
              className="form-input"
              type="date"
              value={filters.date}
              onChange={(e) => set("date", e.target.value)}
            />
            {filters.date && (
              <button className="date-clear" onClick={() => set("date", "")}>
                Clear date
              </button>
            )}
          </div>

          {/* ── Sport ───────────────────────────────── */}
          <div className="filter-section">
            <div className="filter-section-label">Sport</div>
            <div className="sport-category-tabs" style={{ marginBottom: 10 }}>
              <button
                className={`sport-cat-tab ${sportTab === "physical" ? "active" : ""}`}
                onClick={() => setSportTab("physical")}
              >
                ⚽ Physical
              </button>
              <button
                className={`sport-cat-tab ${sportTab === "esports" ? "active" : ""}`}
                onClick={() => setSportTab("esports")}
              >
                🎮 E-Sports
              </button>
            </div>
            <div className="filter-sport-grid">
              <button
                className={`filter-sport-btn ${filters.sport === "all" ? "active" : ""}`}
                onClick={() => set("sport", "all")}
              >
                <span>🏟️</span>
                <span>Any</span>
              </button>
              {(sportTab === "physical" ? PHYSICAL_SPORTS : ESPORTS).map((s) => (
                <button
                  key={s.id}
                  className={`filter-sport-btn ${filters.sport === s.id ? "active" : ""}`}
                  onClick={() => set("sport", s.id)}
                >
                  {s.icon.startsWith("img:") ? (
                    <img
                      src={`/${s.icon.replace("img:", "")}`}
                      alt={s.label}
                      style={{ width: 28, height: 28, objectFit: "contain" }}
                    />
                  ) : (
                    <span>{s.icon}</span>
                  )}
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Skill level ─────────────────────────── */}
          <div className="filter-section">
            <div className="filter-section-label">Skill level</div>
            <div className="skill-options">
              {SKILL_OPTIONS.map((sk) => (
                <button
                  key={sk.id}
                  className={`skill-option ${filters.skillLevel === sk.id ? "active" : ""}`}
                  onClick={() => set("skillLevel", sk.id)}
                >
                  <div className="skill-option-label">{sk.label}</div>
                  <div className="skill-option-desc">{sk.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button className="submit-btn drawer-submit" onClick={onClose}>
          Show results
        </button>
      </div>
    </div>
  );
}
