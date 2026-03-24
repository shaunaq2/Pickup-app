import React from "react";
import { Game } from "../types";
import { spotsLeft } from "../utils";

interface Props {
  game: Game;
}

export default function SpotsBadge({ game }: Props) {
  const left = spotsLeft(game);

  if (left === 0) {
    return <span className="spots-badge spots-full">Full</span>;
  }
  if (left <= 2) {
    return <span className="spots-badge spots-few">{left} left</span>;
  }
  return <span className="spots-badge spots-open">{left} open</span>;
}
