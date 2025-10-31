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
 * Genera un sonido tipo "ping" discreto usando Web Audio API
 * Similar a las notificaciones de iOS/macOS
 */
export function playNotificationSound(volume: number = 0.3): void {
  if (typeof window === 'undefined') return;
  
  const ctx = initAudioContext();
  if (!ctx) {
    console.warn('⚠️ AudioContext no disponible para reproducir sonido');
    return;
  }
  
  try {
    // Crear oscilador para el tono
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    // Conectar nodos
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Configurar tono (frecuencia tipo "ping" agradable)
    oscillator.frequency.value = 800; // Hz - tono medio-alto, discreto
    oscillator.type = 'sine'; // Onda senoidal suave
    
    // Configurar volumen con fade-out para suavizar
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    
    // Duración corta (250ms)
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.25);
    
    // Limpiar después de la reproducción
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
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

