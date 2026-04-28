"use client";

import React from "react";

interface ProgressMilestoneProps {
  progress: number; // 0-100
}

function getMilestone(progress: number): 0 | 25 | 50 | 75 | 100 {
  if (progress >= 100) return 100;
  if (progress >= 75) return 75;
  if (progress >= 50) return 50;
  if (progress >= 25) return 25;
  return 0;
}

export const ProgressMilestone: React.FC<ProgressMilestoneProps> = ({ progress }) => {
  const milestone = getMilestone(progress);

  const content: Record<0 | 25 | 50 | 75 | 100, { title: string }> = {
    0: { title: "Aquí comienza el camino" },
    25: { title: "¡Ya lograste el primer cuarto!" },
    50: { title: "Vas a mitad de camino" },
    75: { title: "¡Estás muy cerca!" },
    100: { title: "Lo lograste, muy bien hecho" },
  };

  const data = content[milestone];

  // 🌌 Paleta Boreal Apple Fluida (2 tonos dinámicos)
  const color =
    milestone === 100
      ? {
          dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
          text: "text-emerald-300 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]",
          badgeBg: "bg-[linear-gradient(90deg,rgba(52,211,153,0.3),rgba(34,211,238,0.3),rgba(52,211,153,0.3))] bg-[length:200%_100%] animate-boreal-fluid border border-emerald-500/50 shadow-[0_0_8px_rgba(52,211,153,0.3)_inset]",
          containerBorder: "border-emerald-500/40",
          containerBg: "bg-[linear-gradient(90deg,rgba(52,211,153,0.15),rgba(34,211,238,0.1),rgba(52,211,153,0.15))] bg-[length:200%_100%] animate-boreal-fluid shadow-[0_0_15px_rgba(52,211,153,0.1)_inset]",
        }
      : milestone >= 50
      ? {
          dot: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]",
          text: "text-cyan-300 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]",
          badgeBg: "bg-[linear-gradient(90deg,rgba(34,211,238,0.3),rgba(168,85,247,0.3),rgba(34,211,238,0.3))] bg-[length:200%_100%] animate-boreal-fluid border border-cyan-500/50 shadow-[0_0_8px_rgba(34,211,238,0.3)_inset]",
          containerBorder: "border-cyan-500/40",
          containerBg: "bg-[linear-gradient(90deg,rgba(34,211,238,0.15),rgba(168,85,247,0.1),rgba(34,211,238,0.15))] bg-[length:200%_100%] animate-boreal-fluid shadow-[0_0_15px_rgba(34,211,238,0.1)_inset]",
        }
      : {
          dot: "bg-fuchsia-400 shadow-[0_0_8px_rgba(217,70,239,0.8)]",
          text: "text-fuchsia-300 drop-shadow-[0_0_5px_rgba(217,70,239,0.5)]",
          badgeBg: "bg-[linear-gradient(90deg,rgba(217,70,239,0.3),rgba(34,211,238,0.3),rgba(217,70,239,0.3))] bg-[length:200%_100%] animate-boreal-fluid border border-fuchsia-500/50 shadow-[0_0_8px_rgba(217,70,239,0.3)_inset]",
          containerBorder: "border-fuchsia-500/40",
          containerBg: "bg-[linear-gradient(90deg,rgba(217,70,239,0.15),rgba(34,211,238,0.15),rgba(217,70,239,0.15))] bg-[length:200%_100%] animate-boreal-fluid shadow-[0_0_15px_rgba(217,70,239,0.1)_inset]",
        };

  return (
    <div className="mb-2 w-full">
      <div className="flex items-center gap-1.5 py-1 w-full relative">
        <span className={`hidden sm:inline-block h-1.5 w-1.5 rounded-full ${color.dot} animate-pulse`} />
        <div className={`hidden sm:block text-[12px] font-medium tracking-wide ${color.text} leading-tight`}>{data.title}</div>
        <div className="flex-1" />
      </div>
    </div>
  );
};

export default ProgressMilestone;


