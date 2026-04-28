import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export type BottyEmotion = 'idle' | 'happy' | 'thinking' | 'speaking' | 'worried';

interface BottyAvatarProps {
  emotion?: BottyEmotion;
  className?: string;
  size?: number; // width & height in px
}

export const BottyAvatar: React.FC<BottyAvatarProps> = ({ 
  emotion = 'idle', 
  className = '',
  size = 40
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [displayEmotion, setDisplayEmotion] = useState<BottyEmotion>(emotion);

  // Efecto para volver al estado 'idle' después de mostrar una reacción
  useEffect(() => {
    setDisplayEmotion(emotion);
    
    // Si la emoción es reaccionaria (feliz, preocupado o hablando), volver a 'idle' después de 4 segundos
    if (emotion === 'happy' || emotion === 'worried' || emotion === 'speaking') {
      const timer = setTimeout(() => {
        setDisplayEmotion('idle');
      }, 4000); // 4 segundos de reacción
      
      return () => clearTimeout(timer);
    }
  }, [emotion]);

  // Parpadeo orgánico espontáneo
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const triggerBlink = () => {
      // Evitar que parpadee mucho cuando está "pensando" o "preocupado"
      if (emotion === 'thinking') {
        timeoutId = setTimeout(triggerBlink, 3000);
        return;
      }
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
      // Próximo parpadeo entre 2 y 6 segundos
      timeoutId = setTimeout(triggerBlink, Math.random() * 4000 + 2000); 
    };
    timeoutId = setTimeout(triggerBlink, 2000);
    return () => clearTimeout(timeoutId);
  }, [emotion]);


  // Variantes para las cejas (Eyebrows) levantadas para no encimarse con los ojos
  const leftEyebrowVariants = {
    idle: { d: "M 11 9.5 Q 14 7 17 9.5", y: 0 },
    happy: { d: "M 10.5 8.5 Q 14 5.5 17 7.5", y: -1 },
    thinking: { d: "M 11 10.5 Q 14 10 17 9.5", y: 1 },
    speaking: { d: "M 11 9.5 Q 14 7 17 9.5", y: -0.5 },
    worried: { d: "M 11 8.5 Q 14 6.5 17 9.5", y: -1 } 
  };

  const rightEyebrowVariants = {
    idle: { d: "M 23 9.5 Q 26 7 29 9.5", y: 0 },
    happy: { d: "M 23 7.5 Q 26 5.5 29.5 8.5", y: -1 },
    thinking: { d: "M 23 9.5 Q 26 10 29 10.5", y: 1 },
    speaking: { d: "M 23 9.5 Q 26 7 29 9.5", y: -0.5 },
    worried: { d: "M 23 9.5 Q 26 6.5 29 8.5", y: -1 }
  };

  // Variantes para los Ojos - usando elipses orgánicas (Ojos Píldora más altos)
  const eyeVariants = {
    idle: { scaleY: isBlinking ? 0.1 : 1, scaleX: 1, y: 0, rx: 2.2, ry: 4.5 },
    happy: { scaleY: isBlinking ? 0.1 : 0.7, scaleX: 1.1, y: -2, rx: 2.5, ry: 3.8 },
    thinking: { scaleY: isBlinking ? 0.1 : 0.6, scaleX: 0.9, y: 1, rx: 1.8, ry: 2.8 },
    speaking: { scaleY: isBlinking ? 0.1 : 1.05, scaleX: 1, y: 0, rx: 2.2, ry: 4.8 },
    worried: { scaleY: isBlinking ? 0.1 : 1.2, scaleX: 0.8, y: -1, rx: 1.5, ry: 5.5 }
  };

  const rightEyeVariants = {
    ...eyeVariants,
    happy: { scaleY: isBlinking ? 0.1 : 0.6, scaleX: 1.1, y: -2, rx: 2.5, ry: 3.8 }, // Achinado más fuerte (guiño sutil)
  };

  // Configuraciones de "morph" para la boca (haciéndola aún más estrecha/compacta)
  const mouthVariants = {
    idle: { d: "M 14 26 Q 20 33 26 26", scaleY: 1 },      // Sonrisa amable y proporcionada
    happy: { d: "M 13 25 Q 20 34 27 25", scaleY: 1 },      // Sonrisa un poco más abierta
    thinking: { d: "M 16 28 Q 20 27 24 28", scaleY: 1 },   // Boca corta y concentrada
    speaking: { d: "M 15 27 Q 20 31 25 27", scaleY: [1, 1.15, 1], transition: { repeat: Infinity, duration: 0.6 } }, // Hablando
    worried: { d: "M 15 29 Q 20 26 25 29", scaleY: 1 }     // Curva triste más sutil
  };

  // Pulso / Aura exterior de cristal (Glassmorphism glow)
  const orbAuraVariants: import('framer-motion').Variants = {
    idle: { scale: 1, opacity: 0.6 },
    happy: { scale: 1.1, opacity: 0.8 },
    thinking: { scale: [1, 1.05, 1], opacity: [0.6, 0.8, 0.6], transition: { repeat: Infinity, duration: 2, ease: "easeInOut" } },
    speaking: { scale: [1, 1.03, 1], opacity: [0.7, 0.9, 0.7], transition: { repeat: Infinity, duration: 1, ease: "easeInOut" } },
    worried: { scale: 0.95, opacity: 0.4 }
  };

  // Estilo "Gummy 3D" en SVG para los features faciales
  const gummyStyle = { 
    filter: "drop-shadow(0px 3px 3px rgba(180, 40, 60, 0.35)) drop-shadow(0px 1px 1px rgba(100, 20, 20, 0.6))",
    transformOrigin: "center"
  };

  return (
    <div className={`relative flex items-center justify-center flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      {/* 1. Aura resplandeciente exterior (Background Glow) */}
      <motion.div
        animate={displayEmotion}
        variants={orbAuraVariants}
        className="absolute inset-0 rounded-full blur-md"
        style={{ background: 'linear-gradient(135deg, #FFAA5A, #FF5F8E, #40A5FF)' }} // Soft glow
      />
      
      {/* 2. Cuerpo Base del orbe cerrado  (Redondeado perfecto) */}
      <div 
        className="absolute inset-0 rounded-full overflow-hidden transition-all duration-300"
        style={{ 
          background: 'radial-gradient(110% 110% at 30% 20%, #FFB684 0%, #FF6772 45%, #6C84FF 85%, #3B4DBB 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15), inset -4px -4px 12px rgba(0,0,0,0.2), inset 4px 4px 12px rgba(255,255,255,0.45)', // Borde transferido a sombra interna para evitar bleeding de subpíxeles
          WebkitMaskImage: '-webkit-radial-gradient(white, black)' // Fix definitivo para Safari WebKit clipping bleed
        }}
      >
        <svg viewBox="0 0 40 40" className="w-full h-full relative z-10" fill="none">
          <defs>
            {/* Gradiente 3D Gummy para el interior de las facciones (cejas, ojos, boca) */}
            <linearGradient id="featureFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#FFCBB5" /> {/* Tono melocotón/translúcido de la imagen original */}
            </linearGradient>
          </defs>

          {/* ----- CEJAS ----- */}
          <motion.path
            d="M 11 9.5 Q 14 7 17 9.5"
            stroke="rgba(255, 218, 201, 0.95)"
            strokeWidth="2.4"
            strokeLinecap="round"
            animate={displayEmotion}
            variants={leftEyebrowVariants}
            initial={false}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            style={{ ...gummyStyle }}
          />
          <motion.path
            d="M 23 9.5 Q 26 7 29 9.5"
            stroke="rgba(255, 218, 201, 0.95)"
            strokeWidth="2.4"
            strokeLinecap="round"
            animate={displayEmotion}
            variants={rightEyebrowVariants}
            initial={false}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            style={{ ...gummyStyle }}
          />

          {/* ----- OJOS ----- */}
          <motion.ellipse
            cx="14"
            cy="16"
            fill="rgba(255, 218, 201, 0.95)"
            animate={displayEmotion}
            variants={eyeVariants}
            initial={false}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            style={{ ...gummyStyle, originX: "14px", originY: "16px" }} 
          />
          
          <motion.ellipse
            cx="26"
            cy="16"
            fill="rgba(255, 218, 201, 0.95)"
            animate={displayEmotion}
            variants={rightEyeVariants}
            initial={false}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            style={{ ...gummyStyle, originX: "26px", originY: "16px" }}
          />

          {/* ----- BOCA ----- */}
          <motion.path
            stroke="rgba(255, 218, 201, 0.95)"
            strokeWidth="3.6"
            strokeLinecap="round"
            animate={displayEmotion}
            variants={mouthVariants}
            initial={false}
            transition={{ type: "spring", stiffness: 250, damping: 22 }}
            style={{ ...gummyStyle, originY: "27px" }}
          />
        </svg>

        {/* 4. Overlay de Cristal Superior (Highlights esféricos frontales de Apple Style) */}
        <div className="absolute top-[2%] left-[10%] w-[80%] h-[40%] rounded-b-full bg-gradient-to-b from-white/40 to-transparent pointer-events-none opacity-90 blur-[1px]" />
      </div>
    </div>
  );
};
