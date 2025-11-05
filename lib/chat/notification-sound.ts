/**
 * Servicio para reproducir sonidos de notificación discretos
 * Usa Web Audio API para generar sonidos tipo "ping" estilo iOS
 */

let audioContext: AudioContext | null = null;

/**
 * Inicializa el AudioContext (requiere interacción del usuario en algunos navegadores)
 */
function initAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('⚠️ Web Audio API no disponible:', e);
      return null;
    }
  }
  
  // Si el contexto está suspendido (requiere interacción del usuario), intentar reanudarlo
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {
      console.warn('⚠️ No se pudo reanudar AudioContext');
    });
  }
  
  return audioContext;
}

/**
 * Genera un sonido tipo "glass" distintivo usando Web Audio API
 * Similar a las notificaciones de iOS/macOS (estilo "Glass" o "Blow")
 * Más audible y con timbre más rico que el anterior
 */
export function playNotificationSound(volume: number = 0.6): void {
  if (typeof window === 'undefined') return;
  
  const ctx = initAudioContext();
  if (!ctx) {
    console.warn('⚠️ AudioContext no disponible para reproducir sonido');
    return;
  }
  
  try {
    const now = ctx.currentTime;
    const duration = 0.4; // 400ms - un poco más largo para ser más perceptible
    
    // Crear múltiples osciladores para un sonido más rico (estilo Apple)
    // Sonido principal: tono medio-alto con armónicos
    const oscillator1 = ctx.createOscillator();
    const oscillator2 = ctx.createOscillator();
    const gainNode1 = ctx.createGain();
    const gainNode2 = ctx.createGain();
    const masterGain = ctx.createGain();
    
    // Configurar oscilador principal (tono base)
    oscillator1.type = 'sine';
    oscillator1.frequency.setValueAtTime(880, now); // La5 - más audible que 800Hz
    
    // Configurar oscilador secundario (armónico para timbre más rico)
    oscillator2.type = 'sine';
    oscillator2.frequency.setValueAtTime(1320, now); // Mi6 - quinta perfecta arriba
    
    // Conectar nodos
    oscillator1.connect(gainNode1);
    oscillator2.connect(gainNode2);
    gainNode1.connect(masterGain);
    gainNode2.connect(masterGain);
    masterGain.connect(ctx.destination);
    
    // Configurar ganancias individuales
    gainNode1.gain.setValueAtTime(0, now);
    gainNode1.gain.linearRampToValueAtTime(volume * 0.7, now + 0.01);
    gainNode1.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    gainNode2.gain.setValueAtTime(0, now);
    gainNode2.gain.linearRampToValueAtTime(volume * 0.3, now + 0.01);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    // Volumen master con fade-out suave
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(volume, now + 0.02);
    masterGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    // Iniciar osciladores
    oscillator1.start(now);
    oscillator2.start(now);
    oscillator1.stop(now + duration);
    oscillator2.stop(now + duration);
    
    // Limpiar después de la reproducción
    oscillator1.onended = () => {
      oscillator1.disconnect();
      gainNode1.disconnect();
    };
    oscillator2.onended = () => {
      oscillator2.disconnect();
      gainNode2.disconnect();
      masterGain.disconnect();
    };
  } catch (e) {
    console.warn('⚠️ Error reproduciendo sonido de notificación:', e);
  }
}

/**
 * Limpia el AudioContext (útil para cleanup)
 */
export function cleanupAudioContext(): void {
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
}

