'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import PillTabs from '@/components/ui/PillTabs';

type Lang = 'en' | 'de';

const MAX_DIGITS = 5;

/**
 * Prefijos de telefonía móvil en Colombia (primeros 3 dígitos de un número local)
 * + 573 = código internacional de Colombia (57) seguido del inicio de móvil (3)
 */
const CO_MOBILE_PREFIXES = new Set([
  // Claro
  '300','301','302','303','304','305',
  '310','311','312','313','314','315','316','317','318','319',
  // Tigo / Movistar
  '320','321','322','323','324','325',
  // ETB Móvil
  '330',
  // Tigo / otros
  '335',
  // Avantel / Novatel
  '350','351',
  // Formato internacional Colombia
  '573',
]);

function isColombianMobilePrefix(digits: string): boolean {
  if (digits.length < 3) return false;
  return CO_MOBILE_PREFIXES.has(digits.slice(0, 3));
}

const DIGIT_WORDS: Record<Lang, string[]> = {
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
  de: ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'],
};

const LANG_CODES: Record<Lang, string[]> = {
  en: ['en-US', 'en-GB', 'en-AU', 'en'],
  de: ['de-DE', 'de-AT', 'de-CH', 'de'],
};

/** Nombres de voces femeninas conocidas por motor/SO */
const FEMALE_VOICE_HINTS = [
  'female', 'woman',
  // macOS / iOS
  'samantha', 'victoria', 'karen', 'moira', 'tessa', 'allison', 'ava', 'susan', 'zoe',
  // macOS German
  'anna', 'petra', 'yannick',
  // Microsoft
  'zira', 'hedda', 'jenny', 'aria', 'natasha',
  // Google
  'google us english', 'google deutsch',
];

function pickFemaleVoice(lang: Lang): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const codes   = LANG_CODES[lang];

  const byLang = voices.filter(v => codes.some(c => v.lang.startsWith(c)));
  if (!byLang.length) return voices.find(v => v.lang.startsWith('en')) ?? null;

  // Prioridad 1: voz que contenga algún indicio femenino en el nombre
  const female = byLang.find(v =>
    FEMALE_VOICE_HINTS.some(h => v.name.toLowerCase().includes(h))
  );
  if (female) return female;

  // Prioridad 2: primera voz del idioma (suele ser femenina en Google/Apple)
  return byLang[0];
}

interface VoiceCodeReaderProps {
  className?: string;
}

export default function VoiceCodeReader({ className = '' }: VoiceCodeReaderProps) {
  const [code,        setCode]        = useState('');
  const [lang,        setLang]        = useState<Lang>('en');
  const [speaking,    setSpeaking]    = useState(false);
  const [currentDigit, setCurrentDigit] = useState<number | null>(null);
  const [voicesReady, setVoicesReady] = useState(false);
  const [supported,   setSupported]   = useState(true);
  const [leakAlert,   setLeakAlert]   = useState(false);
  const cancelRef = useRef(false);

  const handleCodeChange = (raw: string) => {
    const clean = raw.replace(/\D/g, '').slice(0, MAX_DIGITS);
    setCode(clean);
    setLeakAlert(isColombianMobilePrefix(clean));
    stop();
  };

  // Esperar a que el navegador cargue las voces
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSupported(false);
      return;
    }
    const load = () => setVoicesReady(true);
    if (window.speechSynthesis.getVoices().length) {
      setVoicesReady(true);
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', load);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
    }
  }, []);

  const reportLeakToAdmins = useCallback(async (suspiciousCode: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await fetch('/api/security/vx-leak-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code: suspiciousCode }),
      });
    } catch {
      // silencioso — no interrumpir el flujo de la modelo
    }
  }, []);

  const speak = useCallback(() => {
    const digits = code.replace(/\D/g, '').split('');
    if (!digits.length || speaking) return;

    if (leakAlert) {
      reportLeakToAdmins(code);
    }

    window.speechSynthesis.cancel();
    cancelRef.current = false;
    setSpeaking(true);
    setCurrentDigit(0);

    const voice = pickFemaleVoice(lang);
    const words = DIGIT_WORDS[lang];

    let idx = 0;
    const sayNext = () => {
      if (cancelRef.current || idx >= digits.length) {
        setSpeaking(false);
        setCurrentDigit(null);
        return;
      }
      setCurrentDigit(idx);
      const utter = new SpeechSynthesisUtterance(words[Number(digits[idx])]);
      utter.lang  = LANG_CODES[lang][0];
      utter.rate  = 0.85;   // ligeramente más lento para claridad
      utter.pitch = 1.1;    // tono femenino reforzado
      if (voice) utter.voice = voice;

      utter.onend = () => {
        idx++;
        setTimeout(sayNext, 280); // pausa entre dígitos
      };
      utter.onerror = () => {
        setSpeaking(false);
        setCurrentDigit(null);
      };
      window.speechSynthesis.speak(utter);
    };

    sayNext();
  }, [code, lang, speaking, leakAlert, reportLeakToAdmins]);

  const stop = () => {
    cancelRef.current = true;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setCurrentDigit(null);
  };

  const digits = code.replace(/\D/g, '').split('');

  if (!supported) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/40 rounded-xl text-sm text-yellow-700 dark:text-yellow-300">
        Tu navegador no soporta síntesis de voz. Prueba con Chrome o Safari.
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 sm:gap-2 h-full ${className}`}>

      {/* TÍTULO MINIMALISTA POR FUERA DE LA CAJA */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-1 sm:space-x-1.5 min-w-0">
          <div className="flex items-center justify-center text-violet-500 drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]">
            <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-[0_0_8px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
            Lector de Código Vx
          </h2>
        </div>
      </div>

      <div className="flex-1 glass-card bg-black/[0.08] dark:bg-white/[0.08] backdrop-blur-3xl rounded-[1.25rem] sm:rounded-2xl border border-white/40 dark:border-white/[0.08] max-sm:dark:border-white/8 shadow-sm shadow-black/5 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset,0_4px_20px_rgba(0,0,0,0.4)] p-3 sm:p-4 flex flex-col">
      {/* Selector de idioma */}
      <div className="mb-2 sm:mb-2">
        <PillTabs
          tabs={[
            { id: 'en', label: 'English' },
            { id: 'de', label: 'Alemán' },
          ]}
          activeTab={lang}
          onTabChange={(l) => { setLang(l as Lang); stop(); }}
          fullWidth
        />
      </div>

      {/* Input del código */}
      <div className="mb-2 sm:mb-3">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1.5 flex items-center justify-between">
          <span>Código a dictar</span>
          <span className="text-gray-400 dark:text-gray-500 font-normal">{code.length}/{MAX_DIGITS}</span>
        </label>
        <div className="relative w-full">
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={e => handleCodeChange(e.target.value)}
            placeholder="Ej: 48271"
            maxLength={MAX_DIGITS}
            className={`w-full pl-4 pr-12 py-3 rounded-2xl border bg-white/60 dark:bg-white/[0.04] text-gray-900 dark:text-gray-100 text-lg font-semibold tracking-wider text-center focus:outline-none focus:ring-2 shadow-[inset_0_2px_10px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)] placeholder:font-normal placeholder:tracking-normal placeholder:text-sm transition-all duration-300 ${
              leakAlert
                ? 'border-red-400 dark:border-red-500 focus:ring-red-400'
                : 'border-gray-200 dark:border-white/10 focus:ring-violet-400 dark:focus:ring-violet-500/50'
            }`}
          />
          
          <button
            onClick={speaking ? stop : speak}
            disabled={!digits.length || !voicesReady}
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-[10px] sm:rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
              speaking 
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
                : 'bg-violet-500 hover:bg-violet-600 dark:bg-violet-600 dark:hover:bg-violet-500 text-white shadow-[0_0_10px_rgba(139,92,246,0.3)]'
            }`}
            title={speaking ? "Detener" : `Dictar en ${lang === 'en' ? 'Inglés' : 'Alemán'}`}
          >
            {speaking ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg className="w-4 h-4 translate-x-[1px]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Alerta de posible filtración */}
      {leakAlert && (
        <div className="mb-3 sm:mb-4 rounded-lg border border-red-300 dark:border-red-500/60 bg-red-50 dark:bg-red-900/25 px-2.5 py-1.5 sm:px-3 sm:py-2.5 flex items-start gap-1.5 sm:gap-2">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-xs font-bold text-red-700 dark:text-red-400 leading-tight">
            Posible filtración de información sensible
          </p>
        </div>
      )}

      {/* Visualizador de dígitos */}
      {digits.length > 0 && (
        <div className="flex justify-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 flex-wrap">
          {digits.map((d, i) => (
            <div
              key={i}
              className={`w-7 h-8 sm:w-9 sm:h-10 flex items-center justify-center rounded-lg border-2 text-sm sm:text-lg font-bold font-mono transition-all duration-200 ${
                currentDigit === i
                  ? 'border-violet-500 bg-violet-500 text-white scale-110 shadow-lg shadow-violet-200 dark:shadow-violet-900/40'
                  : currentDigit !== null && i < currentDigit
                  ? 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                  : 'border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] text-gray-700 dark:text-gray-300'
              }`}
            >
              {d}
            </div>
          ))}
        </div>
      )}


      {/* Indicador de palabra actual */}
      {speaking && currentDigit !== null && digits[currentDigit] !== undefined && (
        <div className="mt-3 text-center">
          <span className="text-xs text-gray-500 dark:text-gray-400">Diciendo: </span>
          <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">
            {DIGIT_WORDS[lang][Number(digits[currentDigit])]}
          </span>
        </div>
      )}
      </div>
    </div>
  );
}
