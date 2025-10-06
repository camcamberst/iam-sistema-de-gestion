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

  const content: Record<0 | 25 | 50 | 75 | 100, { title: string; subtitle: string }> = {
    0: {
      title: "Preparada para empezar",
      subtitle: "Comienza a sumar para alcanzar tu objetivo",
    },
    25: {
      title: "¡Primer 25% alcanzado!",
      subtitle: "Ya hay progreso visible, continúa así",
    },
    50: {
      title: "Vas a la mitad",
      subtitle: "Lo estás logrando, mantén el ritmo",
    },
    75: {
      title: "Impulso final",
      subtitle: "Estás muy cerca, un poco más",
    },
    100: {
      title: "¡Objetivo alcanzado!",
      subtitle: "Excelente trabajo, ¿vamos por la milla extra?",
    },
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

  return (
    <div className="mb-3">
      <div className={`flex items-start gap-3 rounded-xl border border-gray-200 bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm px-4 py-3 shadow-sm hover:shadow-md transition-shadow duration-200 ${color.shadow}`}>
        {/* Punto de estado */}
        <span className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${color.dot}`} />
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold ${color.text} leading-tight truncate`}>{data.title}</div>
          <div className="text-xs text-gray-600 leading-tight mt-0.5 truncate">{data.subtitle}</div>
        </div>
        {/* Insignia de progreso */}
        <div className={`text-[10px] font-semibold ${color.text} ${color.badgeBg} px-2 py-1 rounded-full`}>{progress}%</div>
      </div>
    </div>
  );
};

export default ProgressMilestone;


