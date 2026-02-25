'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type Lang = 'en' | 'de';

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
  const cancelRef = useRef(false);

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

  const speak = useCallback(() => {
    const digits = code.replace(/\D/g, '').split('');
    if (!digits.length || speaking) return;

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
  }, [code, lang, speaking]);

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
    <div className={`bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-4 flex flex-col ${className}`}>

      {/* Header */}
      <div className="flex items-center space-x-2 mb-4">
        <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Lector de Código Vx</h3>
          <p className="text-xs text-gray-500 dark:text-gray-300">Ingresa el código y la voz lo dictará</p>
        </div>
      </div>

      {/* Selector de idioma */}
      <div className="flex gap-2 mb-4">
        {(['en', 'de'] as Lang[]).map(l => (
          <button
            key={l}
            onClick={() => { setLang(l); stop(); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold border transition-all duration-200 ${
              lang === l
                ? 'bg-violet-500 border-violet-500 text-white shadow-sm'
                : 'bg-gray-50 dark:bg-gray-600/40 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600/60'
            }`}
          >
            <span className="text-base">{l === 'en' ? '🇬🇧' : '🇩🇪'}</span>
            {l === 'en' ? 'English' : 'Deutsch'}
          </button>
        ))}
      </div>

      {/* Input del código */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1.5">
          Código a dictar
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={code}
          onChange={e => { setCode(e.target.value.replace(/\D/g, '')); stop(); }}
          placeholder="Ej: 48271"
          maxLength={12}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-lg font-mono tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:ring-violet-400 dark:focus:ring-violet-500 placeholder:tracking-normal placeholder:text-sm placeholder:font-sans"
        />
      </div>

      {/* Visualizador de dígitos */}
      {digits.length > 0 && (
        <div className="flex justify-center gap-2 mb-4 flex-wrap">
          {digits.map((d, i) => (
            <div
              key={i}
              className={`w-9 h-10 flex items-center justify-center rounded-lg border-2 text-lg font-bold font-mono transition-all duration-200 ${
                currentDigit === i
                  ? 'border-violet-500 bg-violet-500 text-white scale-110 shadow-lg shadow-violet-200 dark:shadow-violet-900/40'
                  : currentDigit !== null && i < currentDigit
                  ? 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                  : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40 text-gray-700 dark:text-gray-200'
              }`}
            >
              {d}
            </div>
          ))}
        </div>
      )}

      {/* Botón principal */}
      <button
        onClick={speaking ? stop : speak}
        disabled={!digits.length || !voicesReady}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
          speaking
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-violet-200 dark:shadow-violet-900/40'
        }`}
      >
        {speaking ? (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            Detener
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072M12 9.5v5m0-9l3 3m-3-3L9 8.5M5.464 8.464a9 9 0 000 12.728" />
            </svg>
            {voicesReady ? `Dictar en ${lang === 'en' ? 'inglés' : 'alemán'}` : 'Cargando voces...'}
          </>
        )}
      </button>

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
  );
}
