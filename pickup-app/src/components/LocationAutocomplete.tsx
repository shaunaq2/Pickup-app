import React, { useEffect, useRef, useState } from "react";

interface Suggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (location: string, city: string, lat: number, lng: number) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

const API_KEY = process.env.REACT_APP_GOOGLE_PLACES_KEY ?? "";

export default function LocationAutocomplete({
  value, onChange, onSelect, placeholder = "Search location...", className, style
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [loading, setLoading]             = useState(false);
  const debounceRef                       = useRef<NodeJS.Timeout>();
  const wrapperRef                        = useRef<HTMLDivElement>(null);

  // Load Google Maps script
  useEffect(() => {
    if (!API_KEY) return;
    if ((window as any).google?.maps?.places) return;
    const existing = document.querySelector('script[data-gmaps]');
    if (existing) return;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
    script.async = true;
    script.dataset.gmaps = "true";
    document.head.appendChild(script);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    onChange(q);

    clearTimeout(debounceRef.current);
    if (!q.trim() || q.length < 2) { setSuggestions([]); setShowDropdown(false); return; }

    debounceRef.current = setTimeout(() => fetchSuggestions(q), 300);
  }

  async function fetchSuggestions(query: string) {
    if (!(window as any).google?.maps?.places) return;
    setLoading(true);

    const service = new (window as any).google.maps.places.AutocompleteService();
    service.getPlacePredictions(
      { input: query, types: ["establishment", "geocode"] },
      (predictions: Suggestion[], status: string) => {
        setLoading(false);
        if (status === "OK" && predictions) {
          setSuggestions(predictions.slice(0, 5));
          setShowDropdown(true);
        } else {
          setSuggestions([]);
          setShowDropdown(false);
        }
      }
    );
  }

  async function handleSelect(suggestion: Suggestion) {
    const placesService = new (window as any).google.maps.places.PlacesService(
      document.createElement("div")
    );

    placesService.getDetails(
      { placeId: suggestion.place_id, fields: ["geometry", "address_components", "formatted_address", "name"] },
      (place: any, status: string) => {
        if (status !== "OK" || !place) return;

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        // Extract city from address components
        let city = "";
        for (const comp of place.address_components ?? []) {
          if (comp.types.includes("locality")) { city = comp.long_name; break; }
          if (comp.types.includes("administrative_area_level_1")) city = comp.short_name;
        }

        const locationName = place.name || suggestion.structured_formatting.main_text;
        onChange(locationName);
        setSuggestions([]);
        setShowDropdown(false);
        onSelect(locationName, city, lat, lng);
      }
    );
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative", ...style }}>
      <input
        value={value}
        onChange={handleInput}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        placeholder={placeholder}
        className={className}
        style={{ width: "100%" }}
        autoComplete="off"
      />
      {loading && (
        <div style={{
          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
          fontSize: 11, color: "var(--text-3)",
        }}>...</div>
      )}
      {showDropdown && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
          background: "var(--surface)", border: "1px solid var(--border-mid)",
          borderRadius: 10, marginTop: 4, overflow: "hidden",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        }}>
          {suggestions.map((s) => (
            <div
              key={s.place_id}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
              style={{
                padding: "10px 12px", cursor: "pointer",
                borderBottom: "0.5px solid var(--border)",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                📍 {s.structured_formatting.main_text}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
                {s.structured_formatting.secondary_text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
