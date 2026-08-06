/**
 * LocationAutocomplete — Google Places-powered location input for RunIt
 *
 * USAGE in PostPage.tsx:
 *   <LocationAutocomplete
 *     value={form.location}
 *     onChange={(v) => set("location", v)}
 *     onSelect={(location, city, lat, lng) => {
 *       set("location", location);
 *       set("city", city);
 *       set("lat", lat);
 *       set("lng", lng);
 *     }}
 *     placeholder="Search street address..."
 *   />
 *
 * REQUIRES: Google Maps script in index.html with libraries=places:
 *   <script src="https://maps.googleapis.com/maps/api/js?key=%REACT_APP_GOOGLE_PLACES_KEY%&libraries=places" async defer></script>
 */

import { useState, useRef, useEffect, useCallback } from "react";

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (location: string, city: string, lat: number, lng: number) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface Suggestion {
  description: string;
  placeId: string;
  mainText: string;
  secondaryText: string;
}

function extractCity(components: any[]): string {
  const order = ["locality", "sublocality", "administrative_area_level_2", "administrative_area_level_1"];
  for (const type of order) {
    const match = components.find((c: any) => c.types.includes(type));
    if (match) return match.long_name;
  }
  return "";
}

export default function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Search location...",
  disabled = false,
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteService = useRef<any>(null);
  const geocoder = useRef<any>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const init = () => {
      const g = (window as any).google;
      if (g?.maps?.places) {
        autocompleteService.current = new g.maps.places.AutocompleteService();
        geocoder.current = new g.maps.Geocoder();
      }
    };
    if ((window as any).google?.maps?.places) {
      init();
    } else {
      const interval = setInterval(() => {
        if ((window as any).google?.maps?.places) { init(); clearInterval(interval); }
      }, 300);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = useCallback((input: string) => {
    if (!autocompleteService.current || input.trim().length < 2) {
      setSuggestions([]); setOpen(false); return;
    }
    setLoading(true);
    autocompleteService.current.getPlacePredictions(
      { input, types: ["establishment", "geocode"] },
      (predictions: any[], status: string) => {
        setLoading(false);
        const OK = (window as any).google?.maps?.places?.PlacesServiceStatus?.OK ?? "OK";
        if (status === OK && predictions?.length) {
          setSuggestions(predictions.map((p: any) => ({
            description: p.description,
            placeId: p.place_id,
            mainText: p.structured_formatting?.main_text ?? p.description,
            secondaryText: p.structured_formatting?.secondary_text ?? "",
          })));
          setOpen(true);
          setHighlightedIndex(-1);
        } else {
          setSuggestions([]); setOpen(false);
        }
      }
    );
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const handleSelect = (suggestion: Suggestion) => {
    onChange(suggestion.description);
    setOpen(false);
    setSuggestions([]);
    if (geocoder.current) {
      geocoder.current.geocode(
        { placeId: suggestion.placeId },
        (results: any[], status: string) => {
          if (status === "OK" && results?.[0]) {
            const loc = results[0].geometry.location;
            const city = extractCity(results[0].address_components ?? []);
            onSelect(suggestion.description, city, loc.lat(), loc.lng());
          } else {
            onSelect(suggestion.description, "", 0, 0);
          }
        }
      );
    } else {
      onSelect(suggestion.description, "", 0, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightedIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (highlightedIndex >= 0) handleSelect(suggestions[highlightedIndex]); }
    else if (e.key === "Escape") { setOpen(false); setHighlightedIndex(-1); }
  };

  const handleClear = () => {
    onChange(""); setSuggestions([]); setOpen(false); inputRef.current?.focus();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 36,
    paddingRight: value ? 36 : 14,
    fontSize: 14,
    borderRadius: 10,
    border: "1.5px solid var(--border, #333)",
    background: "var(--input-bg, var(--card, #1a1a1a))",
    color: "var(--text, #eee)",
    outline: "none",
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "not-allowed" : "text",
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div style={{ position: "relative" }}>
        {/* Pin */}
        <span style={{
          position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
          pointerEvents: "none", fontSize: 15, lineHeight: 1, zIndex: 1,
        }}>
          📍
        </span>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          style={inputStyle}
        />

        {/* Right side: spinner or clear */}
        <span style={{
          position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)",
          display: "flex", alignItems: "center",
        }}>
          {loading ? (
            <svg style={{ width: 16, height: 16, opacity: 0.4, animation: "la-spin 0.8s linear infinite" }}
              viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
              <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : value ? (
            <button
              onMouseDown={(e) => { e.preventDefault(); handleClear(); }}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: "2px 4px",
                color: "var(--text-3, #888)", fontSize: 13, lineHeight: 1, borderRadius: 4,
              }}
              aria-label="Clear"
            >
              ✕
            </button>
          ) : null}
        </span>
      </div>

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <ul style={{
          position: "absolute", zIndex: 100, top: "calc(100% + 4px)", left: 0, right: 0,
          background: "var(--card, #1e1e1e)",
          border: "1.5px solid var(--border, #333)",
          borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          maxHeight: 224, overflowY: "auto",
          listStyle: "none", padding: 0, margin: 0,
        }}>
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              onMouseDown={() => handleSelect(s)}
              onMouseEnter={() => setHighlightedIndex(i)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", cursor: "pointer", fontSize: 13,
                borderBottom: i < suggestions.length - 1 ? "1px solid var(--border, #333)" : "none",
                background: i === highlightedIndex ? "rgba(255,255,255,0.06)" : "transparent",
                color: "var(--text, #eee)",
              }}
            >
              <span style={{ opacity: 0.4, flexShrink: 0, fontSize: 12 }}>📍</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                <span style={{ fontWeight: 500 }}>{s.mainText}</span>
                {s.secondaryText && (
                  <span style={{ marginLeft: 4, opacity: 0.45, fontSize: 11 }}>{s.secondaryText}</span>
                )}
              </span>
            </li>
          ))}
          {/* Required by Google Places ToS */}
          <li style={{
            padding: "6px 14px", display: "flex", justifyContent: "flex-end",
            borderTop: "1px solid var(--border, #333)",
          }}>
            <img
              src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"
              alt="Powered by Google"
              style={{ height: 14, opacity: 0.35, filter: "invert(1)" }}
            />
          </li>
        </ul>
      )}

      {/* No results */}
      {open && !loading && value.length >= 2 && suggestions.length === 0 && (
        <div style={{
          position: "absolute", zIndex: 100, top: "calc(100% + 4px)", left: 0, right: 0,
          background: "var(--card, #1e1e1e)", border: "1.5px solid var(--border, #333)",
          borderRadius: 10, padding: "12px 14px", fontSize: 13,
          color: "var(--text-3, #888)",
        }}>
          No locations found for "{value}"
        </div>
      )}
    </div>
  );
}
