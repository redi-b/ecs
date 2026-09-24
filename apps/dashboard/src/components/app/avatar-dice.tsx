"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const diceFaceAngles: Record<number, { rx: number; ry: number }> = {
  1: { rx: -22, ry: 32 },
  2: { rx: -112, ry: 32 },
  3: { rx: -22, ry: -58 },
  4: { rx: -22, ry: 122 },
  5: { rx: 68, ry: 32 },
  6: { rx: -22, ry: 212 },
};
const fallbackDiceAngles = { rx: -22, ry: 32 };

const diceFacePips: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const diceFaces = [1, 2, 3, 4, 5, 6] as const;
type Vector = [number, number, number];
type Pose = { rx: number; ry: number; rz: number; scale: number };
const surfaces: Record<number, [Vector, Vector, Vector]> = {
  1: [
    [0, 0, 1],
    [1, 0, 0],
    [0, 1, 0],
  ],
  2: [
    [0, -1, 0],
    [1, 0, 0],
    [0, 0, 1],
  ],
  3: [
    [1, 0, 0],
    [0, 0, -1],
    [0, 1, 0],
  ],
  4: [
    [-1, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
  ],
  5: [
    [0, 1, 0],
    [1, 0, 0],
    [0, 0, -1],
  ],
  6: [
    [0, 0, -1],
    [-1, 0, 0],
    [0, 1, 0],
  ],
};
function restingPose(face: number): Pose {
  return { ...(diceFaceAngles[face] ?? fallbackDiceAngles), rz: 0, scale: 1 };
}
// Project vectors rather than scaling a rasterized CSS 3D layer.
function rotate([x, y, z]: Vector, pose: Pose): Vector {
  const r = Math.PI / 180;
  const cx = Math.cos(pose.rx * r),
    sx = Math.sin(pose.rx * r);
  const cy = Math.cos(pose.ry * r),
    sy = Math.sin(pose.ry * r);
  const cz = Math.cos(pose.rz * r),
    sz = Math.sin(pose.rz * r);
  const zx = x * cz - y * sz,
    zy = x * sz + y * cz;
  const yx = zx * cy + z * sy,
    yz = -zx * sy + z * cy;
  return [yx, zy * cx - yz * sx, zy * sx + yz * cx];
}
function rollPose(progress: number, start: Pose, end: Pose): Pose {
  const frames: [number, Pose][] = [
    [0, start],
    [0.22, { rx: 210, ry: 250, rz: 90, scale: 0.9 }],
    [0.48, { rx: 440, ry: 510, rz: 180, scale: 1.14 }],
    [0.72, { rx: 640, ry: 710, rz: 270, scale: 0.96 }],
    [0.88, { rx: 728 + end.rx, ry: 714 + end.ry, rz: 365, scale: 1.03 }],
    [1, { rx: 720 + end.rx, ry: 720 + end.ry, rz: 360, scale: 1 }],
  ];
  for (let i = 1; i < frames.length; i++) {
    const before = frames[i - 1],
      after = frames[i];
    if (!before || !after || progress > after[0]) continue;
    const t = (progress - before[0]) / (after[0] - before[0]);
    const eased = t * t * (3 - 2 * t);
    const value = (key: keyof Pose) => before[1][key] + (after[1][key] - before[1][key]) * eased;
    return { rx: value("rx"), ry: value("ry"), rz: value("rz"), scale: value("scale") };
  }
  return end;
}

export interface AvatarDiceProps {
  face: number;
  prevFace?: number;
  rolling: boolean;
  className?: string;
}

export function AvatarDice({ face, prevFace = face, rolling, className }: AvatarDiceProps) {
  const [animatedPose, setAnimatedPose] = useState(() => restingPose(prevFace));
  useEffect(() => {
    if (!rolling) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const start = restingPose(prevFace),
      end = restingPose(face);
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = preference.matches ? 1 : Math.min(1, (now - started) / 660);
      setAnimatedPose(rollPose(progress, start, end));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    tick(started);
    return () => cancelAnimationFrame(frame);
  }, [face, prevFace, rolling]);
  const pose = rolling ? animatedPose : restingPose(face);
  const visible = diceFaces
    .flatMap((id) => {
      const surface = surfaces[id];
      if (!surface) return [];
      const [n, u, v] = surface.map((vector) => rotate(vector, pose));
      return n && u && v && n[2] > 0.001 ? [{ id, n, u, v }] : [];
    })
    .sort((a, b) => a.n[2] - b.n[2]);

  return (
    <svg
      aria-hidden="true"
      className={cn("size-[26px] shrink-0 overflow-visible", className)}
      viewBox="0 0 34 34"
      fill="none"
    >
      {visible.map(({ id, n, u, v }) => (
        <g
          key={id}
          transform={`matrix(${u[0] * pose.scale} ${u[1] * pose.scale} ${v[0] * pose.scale} ${v[1] * pose.scale} ${17 + n[0] * 13 * pose.scale} ${17 + n[1] * 13 * pose.scale})`}
        >
          <rect
            x="-13"
            y="-13"
            width="26"
            height="26"
            rx="4"
            fill={`color-mix(in oklch, var(--primary) ${Math.max(70, Math.min(100, 86 - n[0] * 10 - n[1] * 14))}%, black)`}
            stroke="color-mix(in oklch, var(--primary-foreground) 22%, transparent)"
            strokeWidth="1"
          />
          {diceFacePips[id]?.map((pip) => (
            <circle
              key={pip}
              cx={((pip % 3) - 1) * 7}
              cy={(Math.floor(pip / 3) - 1) * 7}
              r="2"
              fill="var(--primary-foreground)"
            />
          ))}
        </g>
      ))}
    </svg>
  );
}
