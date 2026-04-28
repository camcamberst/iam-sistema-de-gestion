'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';

interface AppleDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
}

const ITEM_HEIGHT = 44; // 44px for better touch target (Apple standard)
const VISIBLE_ITEMS = 3;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

function ScrollColumn({ 
  options, 
  selectedIndex, 
  onChange 
}: { 
  options: { value: number, label: string }[], 
  selectedIndex: number, 
  onChange: (index: number) => void 
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout>();

  // Drag-to-scroll refs
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);

  // Init scroll pos
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Quitamos temporalmente el snap para evitar que el motor CSS pelee con JS
    el.style.scrollSnapType = 'none';
    
    // Inyección inicial directa
    el.scrollTop = selectedIndex * ITEM_HEIGHT;

    const timer = setTimeout(() => {
      if (el && !isDragging.current) {
        // Reaseguro tras el layout paint
        el.scrollTop = selectedIndex * ITEM_HEIGHT;
        el.style.scrollSnapType = 'y mandatory';
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [selectedIndex]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isDragging.current) return; // Si el usuario está arrastrando, ignorar esto temporalmente
    
    isScrolling.current = true;
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);

    const scrollTop = e.currentTarget.scrollTop;
    const index = Math.round(scrollTop / ITEM_HEIGHT);

    scrollTimeout.current = setTimeout(() => {
      isScrolling.current = false;
      if (index !== selectedIndex && index >= 0 && index < options.length) {
        onChange(index);
      }
    }, 150);
  };

  // Drag to scroll
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.pageY;
    if (scrollRef.current) {
      startScrollTop.current = scrollRef.current.scrollTop;
      scrollRef.current.style.scrollSnapType = 'none'; // Quitar snap mientras se arrastra
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const y = e.pageY;
    const walk = (startY.current - y); // Distancia movida (invertida para que el scroll siga el cursor)
    if (scrollRef.current) {
      scrollRef.current.scrollTop = startScrollTop.current + walk;
    }
  };

  const handleMouseUpOrLeave = () => {
    if (isDragging.current) {
      isDragging.current = false;
      if (scrollRef.current) {
        // Restaurar snap-mandatory y permitir que el navegador acomode el elemento más cercano
        scrollRef.current.style.scrollSnapType = 'y mandatory';
        
        // Disparar el onChange con la posición en la que el usuario soltó el mouse
        const index = Math.round(scrollRef.current.scrollTop / ITEM_HEIGHT);
        if (index !== selectedIndex && index >= 0 && index < options.length) {
          onChange(index);
        } else {
          // Si soltó el mouse cerca del mismo índice, forzamos la animación de vuelta al centro
          scrollRef.current.scrollTop = selectedIndex * ITEM_HEIGHT;
        }
      }
    }
  };

  return (
    <div 
      ref={scrollRef}
      onScroll={handleScroll}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
      className="flex-1 h-full overflow-y-auto snap-y snap-mandatory relative select-none cursor-grab active:cursor-grabbing"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        div::-webkit-scrollbar { display: none; }
      `}} />
      <div style={{ height: ITEM_HEIGHT }} className="shrink-0" />
      {options.map((opt, i) => {
        const isSelected = i === selectedIndex;
        // Distancia relativa para opacidad
        const dist = Math.abs(i - selectedIndex);
        
        let opacityClass = 'opacity-20';
        if (dist === 0) opacityClass = 'opacity-100 font-bold scale-110';
        else if (dist === 1) opacityClass = 'opacity-50 font-medium scale-100';

        return (
          <div 
            key={i} 
            style={{ height: ITEM_HEIGHT }}
            className={`flex items-center justify-center snap-center text-[15px] transition-all duration-300 ${
              isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
            } ${opacityClass}`}
          >
            {opt.label}
          </div>
        );
      })}
      <div style={{ height: ITEM_HEIGHT }} className="shrink-0" />
    </div>
  );
}

export default function AppleDatePicker({ value, onChange, placeholder = "Seleccionar fecha...", className = "" }: AppleDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Internal state for the wheel picker
  const [day, setDay] = useState(1);
  const [month, setMonth] = useState(0); // 0-11
  const [year, setYear] = useState(new Date().getFullYear());

  const currentYear = new Date().getFullYear();

  // Initialize from value when opening
  useEffect(() => {
    if (isOpen) {
      if (value) {
        const [y, m, d] = value.split('-');
        if (y && m && d) {
          setYear(parseInt(y, 10));
          setMonth(parseInt(m, 10) - 1);
          setDay(parseInt(d, 10));
        }
      } else {
        const today = new Date();
        setYear(today.getFullYear());
        setMonth(today.getMonth());
        setDay(today.getDate());
      }
    }
  }, [isOpen, value]);

  // Handle outside click to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Ensure day is valid if month/year changes
  useEffect(() => {
    if (day > daysInMonth) {
      setDay(daysInMonth);
    }
  }, [month, year, day, daysInMonth]);

  const handleConfirm = () => {
    const yStr = year.toString();
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    onChange(`${yStr}-${mStr}-${dStr}`);
    setIsOpen(false);
  };

  const daysOptions = Array.from({ length: daysInMonth }, (_, i) => ({ value: i + 1, label: String(i + 1).padStart(2, '0') }));
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const monthsOptions = monthNames.map((m, i) => ({ value: i, label: m }));
  const yearsOptions = Array.from({ length: 30 }, (_, i) => ({ value: currentYear + i, label: String(currentYear + i) }));

  const dayIndex = daysOptions.findIndex(o => o.value === day);
  const monthIndex = monthsOptions.findIndex(o => o.value === month);
  const yearIndex = yearsOptions.findIndex(o => o.value === year);

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    if (!y || !m || !d) return dateStr;
    const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    return dateObj.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="relative w-full" ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 text-[13px] rounded-xl focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 px-4 py-2.5 transition-colors ${isOpen ? 'ring-2 ring-cyan-500/50 border-cyan-500' : ''} ${className}`}
      >
        <span className={value ? "text-gray-900 dark:text-white font-medium capitalize" : "text-gray-500 dark:text-gray-400"}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute z-[100] top-full mt-2 w-full sm:w-[320px] left-0 sm:left-auto right-0 sm:right-auto p-4 sm:p-5 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-[20px] sm:rounded-[24px] border border-gray-200/50 dark:border-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] animate-fade-in origin-top overflow-hidden">
          
          {/* Wheel Container */}
          <div 
            className="relative flex mx-auto bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden"
            style={{ height: CONTAINER_HEIGHT }}
          >
            {/* Lupa / Highlight Bar */}
            <div 
              className="absolute left-0 right-0 pointer-events-none bg-black/[0.03] dark:bg-white/[0.04] border-y border-black/[0.05] dark:border-white/10"
              style={{ top: ITEM_HEIGHT, height: ITEM_HEIGHT }}
            />
            
            {/* Gradientes de atenuación para bordes suaves (arriba y abajo) */}
            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-gray-50 to-transparent dark:from-[#151926] pointer-events-none z-10" />
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-50 to-transparent dark:from-[#151926] pointer-events-none z-10" />

            {/* Wheels */}
            <ScrollColumn 
              options={daysOptions} 
              selectedIndex={dayIndex >= 0 ? dayIndex : 0} 
              onChange={(i) => setDay(daysOptions[i].value)} 
            />
            <ScrollColumn 
              options={monthsOptions} 
              selectedIndex={monthIndex >= 0 ? monthIndex : 0} 
              onChange={(i) => setMonth(monthsOptions[i].value)} 
            />
            <ScrollColumn 
              options={yearsOptions} 
              selectedIndex={yearIndex >= 0 ? yearIndex : 0} 
              onChange={(i) => setYear(yearsOptions[i].value)} 
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 sm:space-x-3 mt-4">
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2.5 text-[13px] font-bold rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_25px_rgba(232,121,249,0.5)] active:scale-95 transition-all w-full tracking-wide uppercase"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => { onChange(''); setIsOpen(false); }}
              className="px-4 py-2.5 text-[13px] font-bold rounded-full bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/20 active:scale-95 transition-all w-full tracking-wide uppercase"
            >
              Borrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
