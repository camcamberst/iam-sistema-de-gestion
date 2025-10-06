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

  return (
    <div className="mb-3">
      <div className="rounded-xl bg-white/80 text-gray-900 border border-gray-200 shadow-sm px-4 py-3">
        <div className="text-sm font-extrabold tracking-wide">{data.title}</div>
        <div className="text-xs opacity-80">{data.subtitle}</div>
      </div>
    </div>
  );
};

export default ProgressMilestone;


