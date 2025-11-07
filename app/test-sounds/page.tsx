'use client';

import { useState } from 'react';

export default function TestSoundsPage() {
  const [playingSound, setPlayingSound] = useState<string | null>(null);

  const soundOptions = [
    {
      id: 'notification-1',
      name: 'Notificación Suave',
      description: 'Sonido suave y discreto (800Hz → 600Hz)',
      generate: () => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      }
    },
    {
      id: 'notification-2',
      name: 'Notificación Clásica',
      description: 'Sonido tipo "ding" tradicional',
      generate: () => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.05);
        oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      }
    },
    {
      id: 'notification-3',
      name: 'Notificación Moderna',
      description: 'Sonido corto y nítido',
      generate: () => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.08);
        
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);
      }
    },
    {
      id: 'notification-4',
      name: 'Notificación Melódica',
      description: 'Secuencia de 3 tonos ascendentes',
      generate: () => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const frequencies = [600, 800, 1000];
        
        frequencies.forEach((freq, index) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + index * 0.1);
          
          gainNode.gain.setValueAtTime(0.25, audioContext.currentTime + index * 0.1);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + index * 0.1 + 0.1);
          
          oscillator.start(audioContext.currentTime + index * 0.1);
          oscillator.stop(audioContext.currentTime + index * 0.1 + 0.1);
        });
      }
    },
    {
      id: 'notification-5',
      name: 'Notificación Vibrante',
      description: 'Sonido con vibrato sutil',
      generate: () => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const lfo = audioContext.createOscillator();
        const lfoGain = audioContext.createGain();
        
        lfo.frequency.setValueAtTime(5, audioContext.currentTime);
        lfoGain.gain.setValueAtTime(50, audioContext.currentTime);
        
        lfo.connect(lfoGain);
        lfoGain.connect(oscillator.frequency);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(900, audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        
        lfo.start(audioContext.currentTime);
        oscillator.start(audioContext.currentTime);
        lfo.stop(audioContext.currentTime + 0.4);
        oscillator.stop(audioContext.currentTime + 0.4);
      }
    },
    {
      id: 'notification-6',
      name: 'Notificación Minimalista',
      description: 'Sonido muy corto y discreto',
      generate: () => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(700, audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
      }
    }
  ];

  const playSound = async (soundId: string, generateFunction: () => void) => {
    try {
      setPlayingSound(soundId);
      generateFunction();
      
      // Reset después de un tiempo
      setTimeout(() => {
        setPlayingSound(null);
      }, 500);
    } catch (error) {
      console.error('Error playing sound:', error);
      setPlayingSound(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">🎵 Prueba de Sonidos de Notificación</h1>
          <p className="text-gray-600 mb-6">
            Escucha las diferentes opciones de sonidos para las notificaciones del chat. 
            Elige el que más te guste y te diré cómo implementarlo.
          </p>

          <div className="grid gap-4">
            {soundOptions.map((sound) => (
              <div
                key={sound.id}
                className={`p-4 border rounded-lg transition-all ${
                  playingSound === sound.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{sound.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{sound.description}</p>
                  </div>
                  <button
                    onClick={() => playSound(sound.id, sound.generate)}
                    disabled={playingSound !== null}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      playingSound === sound.id
                        ? 'bg-blue-500 text-white'
                        : playingSound !== null
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    {playingSound === sound.id ? '🔊 Reproduciendo...' : '▶️ Probar'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">💡 Instrucciones:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Haz clic en &quot;Probar&quot; para escuchar cada sonido</li>
              <li>• Los sonidos se reproducen automáticamente cuando llegan mensajes del bot o admin</li>
              <li>• Una vez que elijas tu favorito, puedo implementarlo en el chat</li>
              <li>• Los sonidos son generados usando Web Audio API (sin archivos externos)</li>
            </ul>
          </div>

          <div className="mt-6 text-center">
            <a
              href="/admin/dashboard"
              className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              ← Volver al Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
