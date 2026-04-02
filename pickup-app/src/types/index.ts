export interface Sport {
  id: string;
  label: string;
  icon: string;
  bg: string;
  color: string;
}

export type SkillLevel = "all" | "beginner" | "intermediate" | "advanced";
export type Privacy    = "public" | "private";
export type RequestStatus = "pending" | "approved" | "denied";

export interface JoinRequest {
  name: string;
  status: RequestStatus;
}

export interface Game {
  id: number;
  sport: string;
  location: string;
  city: string;
  lat: number;
  lng: number;
  date: string;
  time: string;
  duration: number;
  spots: number;
  players: string[];
  note: string;
  host: string;
  hostIdx: number;
  skillLevel: SkillLevel;
  privacy: Privacy;
  groundCost: number;
  costPerPlayer: number;
  joinRequests: JoinRequest[];
  recurring: boolean;
  waitlistMax: number;
  waitlist: string[];
}

export interface SearchFilters {
  query: string;
  city: string;
  radius: number;
  sport: string;
  skillLevel: SkillLevel;
  date: string;
  useMyLocation: boolean;
}

export type NotifType =
  | "request_received"
  | "request_approved"
  | "request_denied"
  | "request_sent"
  | "you_joined"
  | "you_left"
  | "player_joined"
  | "off_waitlist"
  | "friend_request"
  | "friend_accepted"
  | "game_invite";

export interface Notification {
  id: number;
  type: NotifType;
  gameId: number;
  gameSport: string;
  gameLocation: string;
  playerName: string;
  timestamp: Date;
  read: boolean;
}

export type TxType = "topup" | "join" | "refund";

export interface WalletTx {
  id: number;
  type: TxType;
  amount: number;
  label: string;
  timestamp: Date;
}

export interface User {
  username: string;
}

export type TabId = "browse" | "post" | "mine" | "notifications" | "wallet" | "friends";

export type FriendStatus = "none" | "pending_sent" | "pending_received" | "friends";

export interface Friendship {
  id: number;
  requester: string;
  recipient: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
}

export interface GameInvite {
  id: number;
  game_id: number;
  inviter: string;
  invitee: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
}
