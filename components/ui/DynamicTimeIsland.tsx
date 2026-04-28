'use client';

import React, { useState, useEffect } from 'react';
import { getEuropeanCentralMidnightInColombia, getColombiaDate } from '@/utils/period-closure-dates';

interface DynamicTimeIslandProps {
  className?: string;
  /** Objetivo básico en USD (cuota mínima bruta). Si se pasa junto con facturadoPeriodoUsd, se muestran mensajes de promedio diario. */
  objetivoUsd?: number;
  /** Total facturado USD Bruto (para cálculo interno del objetivo). */
  facturadoPeriodoUsd?: number;
  /** Total facturado USD Modelo (para mostrar al usuario). Si no se pasa, se usa facturadoPeriodoUsd. */
  facturadoDisplayUsd?: number;
}

export default function DynamicTimeIsland({ className = '', objetivoUsd, facturadoPeriodoUsd, facturadoDisplayUsd }: DynamicTimeIslandProps) {
  const [times, setTimes] = useState({
    europe: '',
    japan: '',
    uk: '',
    colombia: ''
  });
  
  const [tickerIndex, setTickerIndex] = useState(0);
  const [messages, setMessages] = useState<Array<{ text: string; urgent: boolean; closed: boolean }>>([]);

  useEffect(() => {
    const updateTimes = () => {
      const now = new Date();
      
      const formatTime = (tz: string) => {
        return new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).format(now).toUpperCase();
      };

      setTimes({
        europe: formatTime('Europe/Berlin'),
        japan: formatTime('Asia/Tokyo'),
        uk: formatTime('Europe/London'),
        colombia: formatTime('America/Bogota')
      });

      // Lógica de mensajes para el ticker
      const colDate = getColombiaDate();
      const [year, month, day] = colDate.split('-').map(Number);
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      
      const isClosureDay = day === 15 || day === lastDayOfMonth;
      const nextClosureDay = day < 15 ? 15 : lastDayOfMonth;
      const daysLeft = Math.max(0, nextClosureDay - day);
      
      const newMessages: Array<{ text: string; urgent: boolean; closed: boolean }> = [];

      const formatDiff = (diff: number) => {
        if (diff <= 0) return 'Periodo cerrado';
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        return `${h}h ${m}m`;
      };

      const THIRTY_MINUTES = 30 * 60 * 1000;

      if (isClosureDay) {
        const dxTarget = new Date(now);
        dxTarget.setHours(10, 0, 0, 0);
        const diffDx = dxTarget.getTime() - now.getTime();
        const dxStatus = formatDiff(diffDx);
        const dxUrgent = diffDx > 0 && diffDx <= THIRTY_MINUTES;
        const dxClosed = diffDx <= 0;
        newMessages.push({ 
          text: dxClosed ? 'Periodo cerrado para dxlive' : `${dxStatus} para cierre de periodo dxlive`, 
          urgent: dxUrgent,
          closed: dxClosed
        });

        const europeMidnight = getEuropeanCentralMidnightInColombia(now);
        let eurTarget = europeMidnight.colombiaDateTime;
        const eurTargetColDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Bogota',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(eurTarget);
        if (eurTargetColDate < colDate) {
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowMidnight = getEuropeanCentralMidnightInColombia(tomorrow);
          eurTarget = tomorrowMidnight.colombiaDateTime;
        }
        const diffEur = eurTarget.getTime() - now.getTime();
        const eurStatus = formatDiff(diffEur);
        const eurUrgent = diffEur > 0 && diffEur <= THIRTY_MINUTES;
        const eurClosed = diffEur <= 0;
        newMessages.push({ 
          text: eurClosed ? 'Periodo cerrado para páginas Eur' : `${eurStatus} para cierre de periodo páginas Eur`, 
          urgent: eurUrgent,
          closed: eurClosed
        });

        const totalTarget = new Date(now);
        totalTarget.setHours(24, 0, 0, 0);
        const diffTotal = totalTarget.getTime() - now.getTime();
        const totalStatus = formatDiff(diffTotal);
        const totalUrgent = diffTotal > 0 && diffTotal <= THIRTY_MINUTES;
        const totalClosed = diffTotal <= 0;
        newMessages.push({ 
          text: totalClosed ? 'Periodo cerrado (total)' : `${totalStatus} para cierre total de periodo`, 
          urgent: totalUrgent,
          closed: totalClosed
        });
      } else {
        newMessages.push({ 
          text: `${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} para el próximo cierre de periodo`, 
          urgent: false,
          closed: false
        });
      }

      // Mensajes de objetivo (solo si hay datos y quedan días): rotan en el mismo espacio
      const goal = typeof objetivoUsd === 'number' && objetivoUsd > 0;
      const billed = typeof facturadoPeriodoUsd === 'number';
      if (goal && billed && !isClosureDay && daysLeft > 0) {
        // Cálculo del objetivo usa USD Bruto (misma métrica que cuotaMinima)
        const remaining = Math.max(0, objetivoUsd - facturadoPeriodoUsd);
        const dailyAvg = remaining / daysLeft;
        // Display usa USD Modelo (lo que la modelo reconoce como su facturado)
        const displayValue = typeof facturadoDisplayUsd === 'number' ? facturadoDisplayUsd : facturadoPeriodoUsd;
        const formatUsd = (n: number) => n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        newMessages.push({ 
          text: `Facturado: US$ ${formatUsd(displayValue)}`, 
          urgent: false, 
          closed: false 
        });
        if (remaining > 0) {
          newMessages.push({ 
            text: `Meta diaria: US$ ${formatUsd(dailyAvg)}`, 
            urgent: true, 
            closed: false 
          });
        }
      }

      setMessages(newMessages);
    };

    updateTimes();
    const timer = setInterval(updateTimes, 1000);
    return () => clearInterval(timer);
  }, [objetivoUsd, facturadoPeriodoUsd, facturadoDisplayUsd]);

  // Rotar el ticker cada 7 segundos para que el texto informativo se lea con calma
  useEffect(() => {
    if (messages.length <= 1) return;
    const tickerTimer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % messages.length);
    }, 7000);
    return () => clearInterval(tickerTimer);
  }, [messages.length]);

  const currentMessage = messages[tickerIndex];

  const trackContent = (
    <>
      {/* Relojes */}
      <div className="flex items-center gap-3 sm:gap-4 border-r border-gray-200/80 dark:border-white/10 pr-3 sm:pr-4 h-full flex-shrink-0">
        <ClockItem label="EUR" time={times.europe} flagCode="eu" color="blue" />
        <ClockItem label="UK" time={times.uk} flagCode="gb" color="purple" />
        <ClockItem label="JPN" time={times.japan} flagCode="jp" color="gray" />
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 bg-white/60 dark:bg-white/[0.03] rounded-lg border border-gray-200 dark:border-white/10">
          <img src="https://flagcdn.com/w20/co.png" alt="" className="w-5 h-3.5 object-cover rounded-sm flex-shrink-0" width={20} height={14} />
          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">COL</span>
          <span className="text-[13px] font-bold tabular-nums tracking-tight text-gray-800 dark:text-gray-200">{times.colombia}</span>
        </div>
      </div>

      {/* Ticker: mismo espacio, mensajes rotativos */}
      <div className="flex-1 flex items-center overflow-hidden sm:overflow-visible h-full relative min-w-0 flex-shrink-0 ml-4 sm:ml-0">
        {currentMessage && (
          <div 
            key={tickerIndex}
            className="flex items-center gap-3 animate-fade-in-smooth whitespace-nowrap min-w-0 pointer-events-none"
          >
            <span className={`flex h-[5px] w-[5px] rounded-full flex-shrink-0 shadow-sm ${
              currentMessage.closed
                ? 'bg-purple-500 dark:bg-[#c488fc] shadow-[0_0_8px_rgba(196,136,252,0.6)]'
                : currentMessage.urgent 
                ? 'bg-teal-500 dark:bg-[#2dd4bf] shadow-[0_0_8px_rgba(45,212,191,0.6)] animate-pulse-fast' 
                : 'bg-emerald-500 dark:bg-[#34d399] shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse-slow'
            }`} />
            <p className={`text-[11px] sm:text-[12px] font-bold tracking-wide whitespace-nowrap ${
              currentMessage.closed
                ? 'text-purple-400 dark:text-[#c488fc] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(196,136,252,0.4)]'
                : currentMessage.urgent 
                ? 'text-[rgba(74,188,150,0.9)] dark:text-[#2dd4bf] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(45,212,191,0.4)]' 
                : 'text-[rgba(74,188,150,0.9)] dark:text-[#34d399] drop-shadow-none dark:drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]'
            }`}>
              {currentMessage.text}
            </p>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className={`w-full max-w-full mx-auto mb-6 px-2 sm:px-0 ${className}`}>
      <div className="relative mx-0 w-full">
        <div className="relative overflow-hidden bg-black/[0.08] dark:bg-white/[0.08] backdrop-blur-3xl rounded-full border border-white/40 dark:border-white/[0.08] shadow-sm shadow-black/5 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset,0_2px_12px_rgba(0,0,0,0.3)] py-1.5 h-11 mobile-marquee-viewport px-0 sm:px-6">
          <div className="mobile-marquee-wrapper flex items-center h-full w-full sm:w-auto">
            {/* Primera copia (siempre visible) */}
            <div className="mobile-marquee-track flex items-center sm:justify-between w-max sm:w-full h-full sm:gap-3 px-6 sm:px-0 flex-shrink-0">
              {trackContent}
            </div>
            {/* Segunda copia para bucle contínuo sin pausas (solo móvil) */}
            <div className="mobile-marquee-track flex sm:hidden items-center w-max h-full px-6 flex-shrink-0" aria-hidden="true">
              {trackContent}
            </div>
          </div>
        </div>
      </div>

      {/* Estilos para animaciones */}
      <style jsx global>{`
        @keyframes fadeInSmooth {
          from { opacity: 0; transform: translateX(15px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in-smooth {
          animation: fadeInSmooth 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes marquee-seamless {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        @media (max-width: 639px) { 
          .mobile-marquee-viewport {
            width: 100%;
            display: flex;
            align-items: center;
          }
          .mobile-marquee-wrapper {
            display: flex;
            width: max-content;
            animation: marquee-seamless 20s linear infinite;
            will-change: transform;
          }
          .mobile-marquee-track {
            flex-shrink: 0;
            display: flex;
          }
        }
        
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .animate-blink {
          animation: blink 1s ease-in-out infinite;
        }
        
        @keyframes pulseSlow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.95); }
        }
        .animate-pulse-slow {
          animation: pulseSlow 2s ease-in-out infinite;
        }
        
        @keyframes pulseFast {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.9); }
        }
        .animate-pulse-fast {
          animation: pulseFast 0.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function ClockItem({ label, time, flagCode, color }: { label: string; time: string; flagCode: string; color: 'blue' | 'purple' | 'red' | 'gray' }) {
  const colorMap = {
    blue: 'from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500',
    purple: 'from-purple-500 to-purple-600 dark:from-purple-400 dark:to-purple-500',
    red: 'from-rose-400 to-rose-500 dark:from-rose-300 dark:to-rose-400',
    gray: 'from-gray-600 to-gray-700 dark:from-gray-300 dark:to-gray-500'
  };

  const parts = time.split(' ');
  const mainTime = parts[0] || time;
  const ampm = parts[1] || '';

  return (
    <div className="flex items-center gap-2">
      {/* Imagen de bandera (se ve en todos los sistemas; los emojis en Windows muestran EU/GB/JP) */}
      <img
        src={`https://flagcdn.com/w20/${flagCode}.png`}
        alt=""
        className="w-4 h-3 object-cover rounded-[2px] flex-shrink-0 opacity-90"
        width={16}
        height={12}
      />
      <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`text-[12px] sm:text-[13px] font-bold tabular-nums tracking-tight text-transparent bg-clip-text bg-gradient-to-r ${colorMap[color]}`}>
          {mainTime}
        </span>
        <span className="text-[8px] font-bold text-gray-400 dark:text-gray-500">
          {ampm}
        </span>
      </div>
    </div>
  );
}
