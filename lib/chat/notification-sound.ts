/**
 * Servicio para reproducir sonidos de notificación discretos
 * Usa HTML5 Audio como método principal (más confiable) con fallback a Web Audio API
 */

let audioContext: AudioContext | null = null;
let audioInitialized = false;

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
 * Desbloquea el contexto de audio reproduciendo un buffer silencioso
 * Esto debe llamarse en respuesta a una interacción del usuario (click/touch)
 * para habilitar la reproducción de audio posterior sin interacción
 */
export function unlockAudioContext(): void {
  if (typeof window === 'undefined') return;
  
  // Si ya está inicializado y corriendo, no hacer nada
  if (audioInitialized && audioContext && audioContext.state === 'running') {
    return;
  }
  
  const ctx = initAudioContext();
  if (!ctx) return;
  
  try {
    // Reanudar si está suspendido
    if (ctx.state === 'suspended') {
      ctx.resume().catch(e => console.warn('⚠️ No se pudo reanudar AudioContext en unlock:', e));
    }
    
    // Crear y reproducir un buffer silencioso muy corto
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    
    // Marcar como inicializado
    audioInitialized = true;
    console.log('🔊 [Audio] Sistema de audio desbloqueado y listo');
  } catch (e) {
    console.warn('⚠️ Error al desbloquear audio:', e);
  }
}

/**
 * Permite inicializar/reanudar el contexto de audio manualmente
 * Útil para llamar en eventos de interacción del usuario (click, touch)
 */
export function initAudio(): void {
  unlockAudioContext();
}

/**
 * Genera un sonido tipo "glass" distintivo usando Web Audio API
 * Similar a las notificaciones de iOS/macOS (estilo "Glass" o "Blow")
 */
async function playWebAudioSound(volume: number = 0.6): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  const ctx = initAudioContext();
  if (!ctx) {
    return false;
  }
  
  try {
    // 🔔 CRÍTICO: Reanudar el contexto si está suspendido
    // Esto es necesario porque los navegadores requieren interacción del usuario
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    osc.start(now);
    osc.stop(now + 0.3);
    
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    
    return true;
  } catch (e) {
    console.warn('⚠️ Error reproduciendo sonido con Web Audio API:', e);
    return false;
  }
}

/**
 * Reproduce sonido de notificación usando el método más confiable disponible
 * Intenta múltiples métodos hasta que uno funcione
 */
export function playNotificationSound(volume: number = 0.6): void {
  if (typeof window === 'undefined') return;
  
  // Si no se ha inicializado, intentar inicializar ahora
  if (!audioInitialized) {
    initAudio();
  }
  
  // Intentar reproducir con Web Audio API (método principal)
  // Usar async/await de forma no bloqueante
  playWebAudioSound(volume).catch((error) => {
    console.warn('⚠️ Error al reproducir sonido:', error);
  });
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

