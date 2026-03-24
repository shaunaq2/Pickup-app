import { Sport, Game } from "../types";

export const SPORTS: Sport[] = [
  { id: "basketball", label: "Basketball", icon: "🏀", bg: "#FAEEDA", color: "#633806" },
  { id: "soccer",     label: "Soccer",     icon: "⚽", bg: "#E1F5EE", color: "#085041" },
  { id: "volleyball", label: "Volleyball", icon: "🏐", bg: "#E6F1FB", color: "#0C447C" },
  { id: "tennis",     label: "Tennis",     icon: "🎾", bg: "#EAF3DE", color: "#3B6D11" },
  { id: "football",   label: "Football",   icon: "🏈", bg: "#FAECE7", color: "#993C1D" },
  { id: "baseball",   label: "Baseball",   icon: "⚾", bg: "#FBEAF0", color: "#72243E" },
  { id: "frisbee",    label: "Frisbee",    icon: "🥏", bg: "#EEEDFE", color: "#3C3489" },
  { id: "pickleball", label: "Pickleball", icon: "img:pickleball.png", bg: "#111111", color: "#FFFFFF" },
  { id: "hockey",     label: "Hockey",     icon: "🏒", bg: "#E6F1FB", color: "#0C447C" },
  { id: "rugby",      label: "Rugby",      icon: "🏉", bg: "#FAECE7", color: "#993C1D" },
  { id: "badminton",  label: "Badminton",  icon: "🏸", bg: "#E1F5EE", color: "#085041" },
  { id: "cricket",    label: "Cricket",    icon: "🏏", bg: "#EAF3DE", color: "#3B6D11" },
  { id: "fifa",       label: "FIFA",        icon: "🎮", bg: "#E8E8FB", color: "#2C2C8E" },
  { id: "madden",     label: "Madden",      icon: "🏈", bg: "#FAEEDA", color: "#633806" },
  { id: "cod",        label: "Call of Duty",icon: "🔫", bg: "#E5EFE5", color: "#1A4D1A" },
  { id: "fortnite",   label: "Fortnite",    icon: "⛏️", bg: "#FEF0E7", color: "#7A3D00" },
  { id: "league",     label: "League of Legends", icon: "⚔️", bg: "#E6EEF8", color: "#0C3A7A" },
  { id: "dbd",        label: "Dead by Daylight",  icon: "🔪", bg: "#F5E8E8", color: "#7A1A1A" },
  { id: "rocket",     label: "Rocket League",     icon: "🚀", bg: "#E8F0FE", color: "#1A3A7A" },
  { id: "nba2k",      label: "NBA 2K",      icon: "🏀", bg: "#FAEEDA", color: "#633806" },
  { id: "chess",      label: "Chess",       icon: "♟️", bg: "#F0F0F0", color: "#333333" },
];

export const ESPORT_IDS = new Set([
  "fifa", "madden", "cod", "fortnite", "league", "dbd", "rocket", "nba2k", "chess"
]);

export const PHYSICAL_SPORTS = SPORTS.filter((s) => !ESPORT_IDS.has(s.id));
export const ESPORTS         = SPORTS.filter((s) =>  ESPORT_IDS.has(s.id));

export const AVATAR_PALETTES: [string, string][] = [
  ["#EEEDFE", "#3C3489"],
  ["#E1F5EE", "#085041"],
  ["#FAEEDA", "#633806"],
  ["#E6F1FB", "#0C447C"],
  ["#FAECE7", "#993C1D"],
  ["#EAF3DE", "#3B6D11"],
];

export const SEED_GAMES: Game[] = [
  {
    id: 1, sport: "basketball", skillLevel: "beginner", privacy: "public",
    groundCost: 20, costPerPlayer: 2,
    location: "Vilas Park Courts", city: "Madison", lat: 43.0634, lng: -89.4176,
    date: "2026-04-05", time: "18:00", duration: 90, spots: 10,
    players: ["Alex K", "Sam T", "Jordan M"],
    note: "3v3, all skill levels welcome!", host: "Alex K", hostIdx: 0,
    joinRequests: [], recurring: false, waitlistMax: 3, waitlist: [],
  },
  {
    id: 2, sport: "soccer", skillLevel: "intermediate", privacy: "private",
    groundCost: 60, costPerPlayer: 5,
    location: "Wingra Park Field", city: "Madison", lat: 43.0481, lng: -89.4063,
    date: "2026-04-05", time: "17:00", duration: 60, spots: 14,
    players: ["Riley P", "Casey L", "Drew S", "Taylor N", "Morgan B"],
    note: "Bring cleats if you have them.", host: "Riley P", hostIdx: 3,
    joinRequests: [
      { name: "Chris W", status: "pending" },
      { name: "Jamie O", status: "pending" },
    ],
    recurring: false, waitlistMax: 3, waitlist: [],
  },
  {
    id: 3, sport: "volleyball", skillLevel: "all", privacy: "public",
    groundCost: 0, costPerPlayer: 0,
    location: "UW Shell Beach", city: "Madison", lat: 43.0766, lng: -89.3966,
    date: "2026-04-07", time: "14:00", duration: 120, spots: 12,
    players: ["Sam T"],
    note: "Beach volleyball, all skill levels.", host: "Sam T", hostIdx: 1,
    joinRequests: [], recurring: false, waitlistMax: 3, waitlist: [],
  },
  {
    id: 4, sport: "tennis", skillLevel: "advanced", privacy: "private",
    groundCost: 40, costPerPlayer: 10,
    location: "Tenney Park Courts", city: "Madison", lat: 43.0869, lng: -89.3612,
    date: "2026-04-07", time: "10:00", duration: 60, spots: 4,
    players: ["Jordan M", "Casey L", "Drew S", "Taylor N"],
    note: "Singles or doubles, come as you are.", host: "Jordan M", hostIdx: 2,
    joinRequests: [], recurring: false, waitlistMax: 3, waitlist: [],
  },
  {
    id: 5, sport: "frisbee", skillLevel: "beginner", privacy: "public",
    groundCost: 0, costPerPlayer: 0,
    location: "Picnic Point", city: "Madison", lat: 43.0893, lng: -89.4249,
    date: "2026-04-09", time: "15:30", duration: 90, spots: 16,
    players: [],
    note: "Ultimate frisbee, beginners welcome.", host: "Morgan B", hostIdx: 7,
    joinRequests: [], recurring: false, waitlistMax: 3, waitlist: [],
  },
  {
    id: 6, sport: "basketball", skillLevel: "advanced", privacy: "public",
    groundCost: 30, costPerPlayer: 3,
    location: "Riverside Park Courts", city: "Milwaukee", lat: 43.0614, lng: -87.9097,
    date: "2026-04-07", time: "19:00", duration: 60, spots: 10,
    players: ["Drew S", "Alex K"],
    note: "Competitive 5v5, bring your A-game.", host: "Drew S", hostIdx: 4,
    joinRequests: [], recurring: false, waitlistMax: 3, waitlist: [],
  },
  {
    id: 7, sport: "soccer", skillLevel: "beginner", privacy: "public",
    groundCost: 0, costPerPlayer: 0,
    location: "Veteran's Park", city: "Milwaukee", lat: 43.0491, lng: -87.9028,
    date: "2026-04-12", time: "10:00", duration: 90, spots: 18,
    players: ["Taylor N"],
    note: "Casual Sunday morning kickabout.", host: "Taylor N", hostIdx: 5,
    joinRequests: [], recurring: false, waitlistMax: 3, waitlist: [],
  },
  {
    id: 8, sport: "pickleball", skillLevel: "intermediate", privacy: "private",
    groundCost: 24, costPerPlayer: 3,
    location: "East Side Courts", city: "Chicago", lat: 41.8952, lng: -87.6271,
    date: "2026-04-09", time: "08:00", duration: 60, spots: 8,
    players: ["Casey L", "Morgan B", "Sam T"],
    note: "Bring your own paddle if you have one.", host: "Casey L", hostIdx: 2,
    joinRequests: [{ name: "Pat M", status: "pending" }],
    recurring: false, waitlistMax: 3, waitlist: [],
  },
];
