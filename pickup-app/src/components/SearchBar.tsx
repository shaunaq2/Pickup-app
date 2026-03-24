import React from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onFilterClick: () => void;
  activeFilterCount: number;
}

export default function SearchBar({ value, onChange, onFilterClick, activeFilterCount }: Props) {
  return (
    <div className="search-row">
      <div className="search-input-wrap">
        <SearchIcon />
        <input
          className="search-input"
          placeholder="Search games, locations..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button className="search-clear" onClick={() => onChange("")}>
            ×
          </button>
        )}
      </div>
      <button className="filter-btn" onClick={onFilterClick}>
        <FilterIcon />
        {activeFilterCount > 0 && (
          <span className="filter-count">{activeFilterCount}</span>
        )}
      </button>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="search-icon">
      <circle cx="6.5" cy="6.5" r="4.5" />
      <path d="M10.5 10.5l3 3" strokeLinecap="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 4h12M4 8h8M6 12h4" strokeLinecap="round" />
    </svg>
  );
}
