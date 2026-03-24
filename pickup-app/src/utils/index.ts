import { Game } from "../types";
import { SPORTS, AVATAR_PALETTES } from "../data/sports";

export function getSport(id: string) {
  return SPORTS.find((s) => s.id === id) ?? {
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    icon: "🏅",
    bg: "#E8E8E8",
    color: "#333333",
  };
}

export function spotsLeft(game: Game): number {
  return game.spots - game.players.length;
}

export function formatDate(dateStr: string): string {
  const dt = new Date(dateStr + "T00:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[dt.getDay()]}, ${months[dt.getMonth()]} ${dt.getDate()}`;
}

export function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  return `${h > 12 ? h - 12 : h || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function getInitials(name: string): string {
  return name.split(" ").map((x) => x[0]).join("");
}

export function avatarPalette(idx: number): [string, string] {
  return AVATAR_PALETTES[idx % AVATAR_PALETTES.length];
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  madison:   { lat: 43.0731, lng: -89.4012 },
  milwaukee: { lat: 43.0389, lng: -87.9065 },
  chicago:   { lat: 41.8781, lng: -87.6298 },
  minneapolis: { lat: 44.9778, lng: -93.2650 },
  detroit:   { lat: 42.3314, lng: -83.0458 },
};

export function hoursUntilGame(dateStr: string, timeStr: string): number {
  const [h, m]    = timeStr.split(":").map(Number);
  const gameDate  = new Date(dateStr + "T00:00:00");
  gameDate.setHours(h, m, 0, 0);
  return (gameDate.getTime() - Date.now()) / (1000 * 60 * 60);
}

export function canWithdraw(dateStr: string, timeStr: string): boolean {
  return hoursUntilGame(dateStr, timeStr) > 12;
}

export function withdrawalDeadline(dateStr: string, timeStr: string): string {
  const [h, m]    = timeStr.split(":").map(Number);
  const gameDate  = new Date(dateStr + "T00:00:00");
  gameDate.setHours(h, m, 0, 0);
  const deadline  = new Date(gameDate.getTime() - 12 * 60 * 60 * 1000);
  const ddays     = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months    = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dh        = deadline.getHours();
  const dm        = deadline.getMinutes();
  const ampm      = dh >= 12 ? "pm" : "am";
  const fh        = dh > 12 ? dh - 12 : dh || 12;
  const fm        = dm.toString().padStart(2, "0");
  return `${ddays[deadline.getDay()]}, ${months[deadline.getMonth()]} ${deadline.getDate()} at ${fh}:${fm} ${ampm}`;
}

export function renderSportIcon(icon: string, size: number = 24): string | null {
  // Returns null for emoji (render as text), or the img src for image icons
  if (icon.startsWith("img:")) return "/" + icon.replace("img:", "");
  return null;
}
