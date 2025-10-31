# 📱 Propuesta de Sistema de Notificaciones - Perspectiva de Usuario

## 🎯 Filosofía: "Discreto pero Presente"

Como usuario, quiero que el sistema me informe sobre nuevos mensajes sin interrumpir mi trabajo. El sistema actual con parpadeos y apertura automática es intrusivo. Necesito algo más elegante y profesional.

---

## ✅ Lo que ME GUSTA como Usuario

1. **Badge de Contador Sutil**: Un número pequeño en el botón flotante que me dice cuántos mensajes nuevos tengo, sin parpadear agresivamente.

2. **Preview No Intrusivo**: Cuando llega un mensaje, me gustaría ver una pequeña "toast notification" en la esquina superior derecha (como macOS/iOS) que muestre:
   - Avatar del remitente (o inicial)
   - Nombre del remitente
   - Preview del mensaje (primeros 40-50 caracteres)
   - Se desvanece automáticamente después de 4-5 segundos
   - Puedo hacer clic para abrir el chat
   - Se desvanece más rápido si hago hover (interacción tácita)

3. **Sonido Discreto Único**: 
   - Un sonido suave y elegante que se reproduce **una sola vez** cuando llega un mensaje nuevo
   - Tipo "pop" o "ping" discreto (estilo iOS/macOS)
   - Volumen bajo-medio (no intrusivo)
   - Solo suena si el chat está CERRADO (si estoy en el chat activo, no necesito sonido)
   - Respeta el estado de "Do Not Disturb" del sistema si está disponible

4. **Indicador Visual Discreto en la Lista**: 
   - En la lista de conversaciones, un pequeño punto azul (●) o badge numérico al lado del nombre si hay mensajes no leídos
   - No debe parpadear, solo estar ahí como recordatorio visual

5. **Estados de Mensaje Claros**: 
   - Mensajes enviados muestran ✓ (entregado) o ✓✓ (leído) sin animación
   - Esto ya lo tenemos implementado y funciona bien ✅

---

## ❌ Lo que NO ME GUSTA del Sistema Actual

1. **Parpadeos Agresivos**: El botón flotante parpadeando con colores rojos/pink es demasiado llamativo y distrae
2. **Apertura Automática**: No quiero que el chat se abra solo cuando llega un mensaje. Prefiero decidir cuándo verlo
3. **Parpadeo del Título del Navegador**: Es molesto y puede distraer si estoy trabajando en otra pestaña
4. **Sonidos Repetitivos/Perpetuos**: No quiero un sonido que se repita constantemente, sino uno único al llegar el mensaje
5. **Complejidad del Estado**: Demasiados estados (`isBlinking`, `hasNewMessage`, `notificationTriggered`, `conversationsTabBlinking`) hacen el sistema difícil de mantener

---

## 🎨 Propuesta de Sistema Nuevo

### Componente 1: Badge de Contador (Siempre Visible)

```
┌─────────────────────┐
│   [Botón AIM] (3)   │  ← Número pequeño, redondeado, discreto
└─────────────────────┘
```

**Comportamiento:**
- Muestra el total de mensajes no leídos
- Color: Azul suave (`bg-blue-500`) con texto blanco
- Tamaño: `text-xs`, `px-1.5 py-0.5`
- Posición: Esquina superior derecha del botón
- Sin animaciones de parpadeo, solo aparece/desaparece suavemente

### Componente 2: Toast Notification + Sonido (Al Llegar Mensaje Nuevo)

```
┌────────────────────────────────────────┐
│  👤 María Pérez                       │
│  "Hola, ¿tienes un momento para..."   │
│                      [4s] ────────── │  ← Se desvanece
└────────────────────────────────────────┘
🔔 (Sonido discreto único cuando aparece)
```

**Comportamiento:**
- Aparece en la esquina superior derecha de la pantalla
- Solo cuando el chat está CERRADO
- Solo si el usuario NO está en la conversación activa
- Muestra: avatar/initial + nombre + preview del mensaje
- Duración: 4-5 segundos
- Animación: fade-in suave, fade-out gradual
- **Sonido**: Se reproduce un sonido discreto (tipo "pop" iOS) **una sola vez** al aparecer el toast
- Interacción: 
  - Clic en el toast → abre el chat a esa conversación
  - Hover → pausa el desvanecimiento (opcional)
  - Se puede cerrar manualmente con X (opcional)

### Componente 3: Indicador en Lista de Conversaciones

```
┌─────────────────────────────┐
│ María Pérez            (3) │  ← Badge discreto
│ Último mensaje...          │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Juan López           ●      │  ← Punto si hay 1-2 mensajes
│ Último mensaje...           │
└─────────────────────────────┘
```

**Comportamiento:**
- Si hay 1-3 mensajes no leídos: punto azul pequeño (●)
- Si hay 4+ mensajes: badge numérico `(4)`
- Posicionado al lado del nombre del contacto
- Sin animación de parpadeo

### Componente 4: Badge en Pestaña "Conversaciones"

Si estamos en la vista de lista de conversaciones y hay mensajes nuevos:
- La pestaña "Conversaciones" muestra un badge pequeño: `Conversaciones (5)`
- Sin parpadeo, solo el número

---

## 🔧 Cambios Técnicos Propuestos

### Eliminar:
1. `isBlinking` state
2. `hasNewMessage` state  
3. `notificationTriggered` state
4. `conversationsTabBlinking` state
5. `titleBlinkIntervalRef` y toda la lógica de parpadeo del título
6. `triggerNotification()` function (lógica antigua)
7. `canTriggerNotification()` function (lógica antigua)
8. Lógica de apertura automática del chat

### Mantener:
1. `unread_count` de cada conversación (del backend)
2. Cálculo del total de mensajes no leídos
3. Sistema de lectura de mensajes (`chat_message_reads`)

### Reemplazar/Mejorar:
1. **`playNotificationSound()`**: Nueva implementación que:
   - Reproduce un sonido suave y discreto (tipo iOS "pop" o "ping")
   - Solo se reproduce UNA VEZ por mensaje nuevo
   - Respeta el estado del chat (no suena si está abierto)
   - Volumen controlado y elegante

### Agregar:
1. **ToastNotification Component**: Componente nuevo para las notificaciones tipo toast
2. **useUnreadCount Hook**: Hook simple para calcular total de no leídos
3. **Badge Component**: Componente reutilizable para badges de contador
4. **NotificationSound Service**: Servicio para reproducir sonidos de notificación:
   - Sonido único y discreto (no repetitivo)
   - Control de volumen
   - Detección de estado del chat (no suena si está abierto)
   - Posibilidad de usar Web Audio API o Audio HTML5

---

## 📐 Diseño Visual (Apple Style)

### Toast Notification:
- **Fondo**: `bg-white/95 dark:bg-gray-800/95` con `backdrop-blur-md`
- **Sombra**: `shadow-xl`
- **Bordes**: `rounded-xl`, `border border-white/30 dark:border-gray-700/30`
- **Animación**: `animate-fadeIn` (fade-in suave, 300ms)
- **Padding**: `p-3`
- **Max Width**: `max-w-sm`
- **Posición**: `fixed top-4 right-4 z-[99999]`

### Badge de Contador:
- **Fondo**: `bg-blue-500` (o `bg-red-500` si es urgente)
- **Texto**: `text-white text-xs font-semibold`
- **Padding**: `px-1.5 py-0.5`
- **Posición**: `absolute -top-1 -right-1`
- **Bordes**: `rounded-full`
- **Tamaño mínimo**: Si el número es 0, el badge no se muestra

---

## 🎯 Flujo de Usuario

### Escenario 1: Llega un Mensaje Nuevo (Chat Cerrado)
1. Se actualiza el `unread_count` en el backend
2. El badge del botón flotante se actualiza con el nuevo número
3. **Se reproduce un sonido discreto (una sola vez)** 🔔
4. Aparece un toast notification con preview del mensaje
5. El toast se desvanece después de 4-5 segundos
6. El usuario puede hacer clic en el toast para abrir el chat

### Escenario 2: Llega un Mensaje Nuevo (Chat Abierto pero Otra Conversación)
1. **El sonido NO suena** (usuario está activo en el chat)
2. El toast NO aparece (usuario está activo en el chat)
3. Solo se actualiza el badge en la lista de conversaciones
4. El badge del botón flotante se actualiza

### Escenario 3: Usuario Abre una Conversación
1. Los mensajes se marcan como leídos automáticamente
2. El `unread_count` de esa conversación se pone en 0
3. El badge del botón flotante se recalcula
4. El indicador en la lista desaparece

---

## ✨ Ventajas del Nuevo Sistema

1. **No Intrusivo**: No interrumpe el flujo de trabajo
2. **Informativo**: El usuario sabe qué llegó y de quién
3. **Profesional**: Se siente como aplicaciones modernas (Slack, Discord, iMessage)
4. **Performante**: Menos estados y lógica compleja
5. **Mantenible**: Código más simple y directo
6. **Consistente**: Alineado con Apple Style 2 del proyecto

---

## 🚀 Prioridad de Implementación

1. **Fase 1** (Alta): Badge de contador en botón flotante
2. **Fase 2** (Alta): Toast notifications + Sonido discreto único
3. **Fase 3** (Media): Indicadores en lista de conversaciones
4. **Fase 4** (Baja): Pausar desvanecimiento con hover (nice-to-have)

## 🔊 Detalles del Sonido

### Características:
- **Tipo**: Sonido suave tipo "pop" o "ping" (similar a notificaciones iOS)
- **Formato**: Puede ser un archivo `.mp3`, `.wav`, o generado con Web Audio API
- **Duración**: Corto (200-400ms máximo)
- **Volumen**: Bajo-medio (30-50% del volumen del sistema)
- **Reproducción**: UNA SOLA VEZ por mensaje nuevo recibido
- **Condiciones**: Solo suena si:
  - El chat está CERRADO
  - El mensaje NO es del usuario actual (no auto-notificarse)
  - No hay throttling/rate limiting excesivo (puede haber un mínimo de 2-3 segundos entre sonidos)

### Opciones de Implementación:
1. **Audio HTML5**: Archivo de sonido simple, fácil de implementar
2. **Web Audio API**: Generar sonido programáticamente (más control, sin archivos)
3. **Librería**: Usar una librería como `use-sound` (React) para mejor control

### Recomendación:
Usar **Web Audio API** para generar un sonido tipo "ping" discreto programáticamente. Esto:
- No requiere archivos externos
- Es más ligero
- Se puede ajustar volumen y tono fácilmente
- Es más profesional y mantiene el control total

---

## 📝 Notas Adicionales

- El sistema debe respetar la configuración de "Do Not Disturb" si se implementa en el futuro
- Las notificaciones toast deben tener un límite máximo (ej: máximo 3 toasts apilados)
- Si el usuario está en modo oscuro, el toast debe adaptarse automáticamente
- El sistema debe funcionar correctamente en mobile (aunque el botón flotante puede ajustarse)

