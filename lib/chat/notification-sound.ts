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
    
    // Configuración para sonido "Glass/Pop" más suave y elegante (Estilo Apple)
    // Usamos una envolvente percusiva con un tono puro
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // Frecuencia base: Nota alta pero suave (ej. Do6 = 1046.50Hz)
    // Deslizamos ligeramente hacia abajo para efecto "gota de agua"
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
    
    // Tipo de onda: Senoidal pura para suavidad
    osc.type = 'sine';
    
    // Envolvente de volumen (ADSR rápido)
    // Ataque muy rápido (pop) y decaimiento suave
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01); // Ataque rápido
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3); // Decaimiento corto
    
    osc.start(now);
    osc.stop(now + 0.3);
    
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
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

