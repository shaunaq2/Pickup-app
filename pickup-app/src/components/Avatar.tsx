import React from "react";
import { avatarPalette, getInitials } from "../utils";

interface Props {
  name: string;
  idx: number;
  size?: number;
  fontSize?: number;
}

export default function Avatar({ name, idx, size = 22, fontSize = 9 }: Props) {
  const [bg, color] = avatarPalette(idx);
  return (
    <div
      style={{
        background: bg,
        color,
        width: size,
        height: size,
        fontSize,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  );
}
