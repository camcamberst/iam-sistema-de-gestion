# Gamificación V1: Celebración Visual (Calculadora)

Este documento asienta las reglas aplicadas para la Fase 1 del sistema de gamificación en la Calculadora de la plataforma Aurora (Apple Style 2). El objetivo central es generar recompensas subconscientes mediante estímulos visuales estilo "Neón/Aurora" cuando la modelo ingresa sus ganancias.

## 1. Naturaleza Híbrida de los Hitos

Para lograr mantener un estímulo constante pero con "peaks" ("picos") emocionales, el sistema analiza dos factores concurrentes cada vez que la modelo guarda un flujo de ganancias en una plataforma:

1. **Delta (Crecimiento Inmediato):** Cuánto ha subido la cifra en esta acción específica.
2. **Acumulativo (Milestones):** Cuál es el monto total nominal al que ha llegado la plataforma.

Si el ingreso rompe un hito acumulativo importante, se sobreescribe el Delta y se lanza una celebración visual estelar. Si el ingreso no rompe un hito mayor, la plataforma hace una celebración estándar equivalente únicamente al tamaño del ingreso (Delta).

## 2. Escalas de Aceleración y Umbrales

### Celebraciones Regulares (Basadas en Delta Inmediato)
Se activan al reportar ingresos normales que no atraviesan barreras acumulativas.

| Nivel   | Rango (USD)     | Emoción            | Posibles Mensajes                       | Visual                                            |
| ------- | --------------- | ------------------ | --------------------------------------- | ------------------------------------------------- |
| Nivel 1 | $0.05 a $9.99   | Interés / Progreso | "Bien hecho", "Sumando", "Buen inicio"  | Destello de borde tenue                           |
| Nivel 2 | $10.00 a $19.99 | Entusiasmo         | "¡Excelente!", "¡Gran flujo!"           | Brillo Aurora barriendo la franja de la plataforma |
| Nivel 3 | $20.00 a $49.99 | Euforia            | "¡Fabuloso!", "¡Imparable!"             | Pulso de colores neón + ligero temblor            |

### Celebraciones Legendarias (Hitos Acumulados)
Se activan **solo** si el total final sobrepasa barreras clave ($50, $100, $150, etc.).

| Milestone | Total (USD)        | Emoción        | Posibles Mensajes                           | Visual                                                                |
| --------- | ------------------ | -------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| Nivel 4   | $50, $150, $250... | Frenesí        | "¡FUEGO PURO! 🔥", "¡ESTELAR!"              | Estela intensa de luz emanando desde el valor, desborde de luz focal. |
| Nivel 5   | $100, $200, $300...| Logro Extremo  | "¡LEYENDA! 👑", "¡FUERA DE ESTE MUNDO! 🌌"  | Supernova. Toda la caja de la plataforma brilla estáticamente fuerte. |

## 3. Implementación Frontend (`platformEvent`)
Cada plataforma tiene capacidad para sostener un estado efímero:
```typescript
interface GamificationEvent {
  platformId: string;
  level: number;       // 1-5
  message: string;     // Palabra de aliento
  active: boolean;     // Disparador de CSS
  timestamp: number;   // ID único de evento
}
```

La duración ideal de estas notificaciones contextuales es de **2.5 a 4.0 segundos** para crear el pico de dopamina e inmediatamente desaparecer, dejando la plataforma despejada nuevamente y evitando fatiga visual.

---
*Nota: A futuro, estos umbrales generarán "Puntos Aurora" canjeables por créditos. Se sugiere utilizar la tabla de arriba como base para otorgar "X puntos por Nivel 1, Y puntos por Nivel 4, etc.".*
