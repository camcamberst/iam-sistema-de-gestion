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
    50: { title: "Vas a mitad de camino, lo estás logrando" },
    75: { title: "¡Estás muy cerca, vamos! un poco más" },
    100: { title: "Lo lograste, muy bien hecho, ¿vamos por la milla extra?" },
  };

  const data = content[milestone];

  // Paleta sutil tipo Apple: azul en 25/50, morado en 75, esmeralda en 100
  const color =
    milestone === 100
      ? {
          dot: "bg-emerald-500",
          text: "text-emerald-700",
          badgeBg: "bg-emerald-100",
          shadow: "shadow-emerald-100",
        }
      : milestone === 75
      ? {
          dot: "bg-purple-500",
          text: "text-purple-700",
          badgeBg: "bg-purple-100",
          shadow: "shadow-purple-100",
        }
      : {
          dot: "bg-blue-500",
          text: "text-blue-700",
          badgeBg: "bg-blue-100",
          shadow: "shadow-blue-100",
        };

  // Fondo cambia con el progreso
  const bgGradient =
    milestone === 100
      ? "from-emerald-50 to-emerald-100"
      : milestone === 75
      ? "from-purple-50 to-purple-100"
      : "from-blue-50 to-blue-100";

  return (
    <div className="mb-1.5">
      <div
        className={`flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gradient-to-br ${bgGradient} px-3 py-1.5 shadow-sm`}
      >
        <span className={`inline-block h-2 w-2 rounded-full ${color.dot}`} />
        <div className={`text-xs sm:text-[13px] font-semibold ${color.text} truncate`}>{data.title}</div>
        <div className="flex-1" />
        <div className={`text-[10px] sm:text-[11px] font-semibold ${color.text} ${color.badgeBg} px-2 py-0.5 rounded-full`}>{progress}%</div>
      </div>
    </div>
  );
};

export default ProgressMilestone;


