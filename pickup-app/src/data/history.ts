import { Game } from "../types";

export interface BookingRecord {
  gameId: number;
  sport: string;
  host: string;
  location: string;
  city: string;
  neighborhood: string;
  dayOfWeek: number;
  hourOfDay: number;
  skillLevel: string;
}

export const USER_HISTORY: Record<string, BookingRecord[]> = {
  shaunaq: [
    { gameId: 0, sport: "basketball", host: "Alex K",    location: "Vilas Park Courts",    city: "Madison",   neighborhood: "Vilas",       dayOfWeek: 3, hourOfDay: 18, skillLevel: "beginner" },
    { gameId: 0, sport: "basketball", host: "Alex K",    location: "Vilas Park Courts",    city: "Madison",   neighborhood: "Vilas",       dayOfWeek: 3, hourOfDay: 18, skillLevel: "beginner" },
    { gameId: 0, sport: "basketball", host: "Alex K",    location: "Vilas Park Courts",    city: "Madison",   neighborhood: "Vilas",       dayOfWeek: 2, hourOfDay: 17, skillLevel: "beginner" },
    { gameId: 0, sport: "basketball", host: "Drew S",    location: "Riverside Park Courts", city: "Milwaukee", neighborhood: "Riverside",   dayOfWeek: 4, hourOfDay: 19, skillLevel: "advanced" },
    { gameId: 0, sport: "frisbee",    host: "Morgan B",  location: "Picnic Point",         city: "Madison",   neighborhood: "Near West",   dayOfWeek: 5, hourOfDay: 15, skillLevel: "beginner" },
    { gameId: 0, sport: "frisbee",    host: "Morgan B",  location: "Picnic Point",         city: "Madison",   neighborhood: "Near West",   dayOfWeek: 5, hourOfDay: 15, skillLevel: "beginner" },
    { gameId: 0, sport: "soccer",     host: "Taylor N",  location: "Veteran's Park",       city: "Milwaukee", neighborhood: "East Side",   dayOfWeek: 6, hourOfDay: 10, skillLevel: "beginner" },
  ],
  alex: [
    { gameId: 0, sport: "soccer",     host: "Riley P",   location: "Wingra Park Field",    city: "Madison",   neighborhood: "Wingra",      dayOfWeek: 3, hourOfDay: 17, skillLevel: "intermediate" },
    { gameId: 0, sport: "soccer",     host: "Riley P",   location: "Wingra Park Field",    city: "Madison",   neighborhood: "Wingra",      dayOfWeek: 3, hourOfDay: 17, skillLevel: "intermediate" },
    { gameId: 0, sport: "soccer",     host: "Taylor N",  location: "Veteran's Park",       city: "Milwaukee", neighborhood: "East Side",   dayOfWeek: 6, hourOfDay: 10, skillLevel: "beginner" },
    { gameId: 0, sport: "volleyball", host: "Sam T",     location: "UW Shell Beach",       city: "Madison",   neighborhood: "Near East",   dayOfWeek: 4, hourOfDay: 14, skillLevel: "all" },
    { gameId: 0, sport: "volleyball", host: "Sam T",     location: "UW Shell Beach",       city: "Madison",   neighborhood: "Near East",   dayOfWeek: 4, hourOfDay: 14, skillLevel: "all" },
    { gameId: 0, sport: "tennis",     host: "Jordan M",  location: "Tenney Park Courts",   city: "Madison",   neighborhood: "Tenney-Lapham", dayOfWeek: 4, hourOfDay: 10, skillLevel: "advanced" },
  ],
  riley: [
    { gameId: 0, sport: "pickleball", host: "Casey L",   location: "East Side Courts",     city: "Chicago",   neighborhood: "East Side",   dayOfWeek: 5, hourOfDay: 8,  skillLevel: "intermediate" },
    { gameId: 0, sport: "pickleball", host: "Casey L",   location: "East Side Courts",     city: "Chicago",   neighborhood: "East Side",   dayOfWeek: 5, hourOfDay: 8,  skillLevel: "intermediate" },
    { gameId: 0, sport: "pickleball", host: "Casey L",   location: "East Side Courts",     city: "Chicago",   neighborhood: "East Side",   dayOfWeek: 5, hourOfDay: 9,  skillLevel: "intermediate" },
    { gameId: 0, sport: "tennis",     host: "Jordan M",  location: "Tenney Park Courts",   city: "Madison",   neighborhood: "Tenney-Lapham", dayOfWeek: 4, hourOfDay: 10, skillLevel: "advanced" },
    { gameId: 0, sport: "soccer",     host: "Riley P",   location: "Wingra Park Field",    city: "Madison",   neighborhood: "Wingra",      dayOfWeek: 3, hourOfDay: 17, skillLevel: "intermediate" },
  ],
};

export function getHistory(username: string): BookingRecord[] {
  return USER_HISTORY[username.toLowerCase()] ?? [];
}
