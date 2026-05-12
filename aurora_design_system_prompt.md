# 🍎 Aurora "Apple Style 2" - Master Design System Prompt

**CONTEXTO INICIAL PARA LA IA:** 
Actúa como un **Desarrollador Frontend Experto e Ingeniero UX/UI**. Tu tarea es implementar, refactorizar o migrar componentes y vistas basándote ESTRICTAMENTE en el siguiente documento de reglas visuales y estructurales conocido como **"Apple Style 2"** (Basado en el Panel Modelo de la plataforma Aurora). Nunca asumas diseños genéricos, ni utilices utilidades de Tailwind por defecto sin antes consultar estas reglas. La prioridad absoluta es una estética premium, minimalista, táctil y simétrica.

---

## 📐 1. Regla Maestra de Layout y Márgenes (Edge-to-Edge)
El diseño requiere que todos los contenedores "floten" uniformemente en la pantalla, sin chocar jamás de manera seca contra los biseles del teléfono.

*   **Padding Global Único:** Todo el espacio lateral en dispositivos móviles debe originarse EXCLUSIVAMENTE desde el layout/wrapper global (utilizando un margen sagrado de `12px`, correspondiente a `px-3`).
*   **Páginas (Pages):** CERO padding duro en los archivos de página en móvil. Deben llevar obligatoriamente `px-0` en pantallas pequeñas para evitar duplicar el margen del layout. Solo se restaura en pantallas grandes (ej. `px-0 sm:px-4`).
*   **Márgenes Negativos:** Totalmente **PROHIBIDOS** (ej. `-mx-3` o `calc(100% + 24px)`). Ningún componente debe romper la flotabilidad para tocar los bordes físicos de la pantalla.

## 🔲 2. Regla de Contenedores y Tarjetas (GlassCards)
Los componentes base ("GlassCards") que albergan el contenido deben seguir una estética de *Glassmorphism* limpio.

*   **Prohibición de Esquinas Cuadradas:** El uso de clases como `rounded-none` está estrictamente **PROHIBIDO** en todo contenedor visible.
*   **Radios Exigidos:** Usar siempre curvas generosas: `rounded-xl` o `rounded-2xl` como mínimo en versión móvil, escalando a `rounded-3xl` en escritorio.
*   **Padding Interno:** Todo `GlassCard` debe tener padding interno constante (`p-3`, `p-4`, o `p-5`). El contenido interno jamás debe rozar o chocar contra el límite del cristal.

## 🏷️ 3. Regla de Títulos (Mobile Panel Headers)
Para los títulos internos de widgets, tablas o sub-paneles, la estructura es rígida para garantizar simetría horizontal perfecta.

*   **Contenedor Padre:** Al llegar a móvil, el contenedor que envuelve el widget debe perder su padding y fondo (`max-sm:!px-0 max-sm:!bg-transparent max-sm:!border-none max-sm:!shadow-none max-sm:!p-0 max-sm:!backdrop-blur-none`).
*   **Estructura del Header:** El header en sí es quien debe llevar el padding (`max-sm:px-4 mb-1.5 sm:mb-2`).
*   **Composición:** Flexbox alineado (`flex items-center space-x-2`).
*   **Icono:** Caja rígida de `w-5 h-5` (con un ícono interno centrado de `w-2.5 h-2.5`), con `rounded-md`, sombra sutil (`shadow-sm`) y un gradiente vibrante (ej. `bg-gradient-to-br from-blue-500 to-indigo-600`).
*   **Tipografía:** `text-sm font-semibold tracking-tight text-gray-900 dark:text-white/90`. No utilizar fuentes grandes (`text-base` o `text-lg`) para componentes internos.

## 🔘 4. Regla de Botones (Apple Style Glow)
El botón de acción primaria (ej. "Guardar", "Confirmar Pedido") no debe ser un botón plano común; debe ser un elemento vivo y altamente visible.

*   **Color y Gradiente:** Usar combinaciones vibrantes (`bg-gradient-to-r from-cyan-600 to-fuchsia-600` o familia `from-pink-600 to-rose-600`).
*   **Sombras Luminosas (Aura):** Las sombras deben heredar el color del botón (`shadow-md shadow-cyan-500/30`). En modo oscuro, usar resplandores precisos: `dark:shadow-[0_0_15px_rgba(34,211,238,0.5)]`.
*   **Animación Activa:** En estado hover, aplicar una capa dinámica usando `animation: aurora-flow 1.5s ease-in-out infinite alternate`.
*   **Tacto (Feedback):** Todos los botones y tarjetas clickeables deben incluir `active:scale-[0.98] transition-all` para brindar la sensación de peso físico.

## 📱 5. Regla de Modales Centrados
El paradigma de "Bottom Sheets" (modales pegados a la parte inferior) ha sido reemplazado. Todo modal debe flotar como una isla en el centro de la pantalla.

*   **Wrapper:** `fixed inset-0 z-[100] flex items-center justify-center p-4`.
*   **Cristal del Modal:** Efecto de desenfoque masivo (`backdrop-blur-3xl`), fondo translúcido (`bg-white/80 dark:bg-[#1a1a1c]/80`), esquinas hiper-redondeadas (`rounded-[2rem]`), y un borde de luz (`border border-white/50 dark:border-white/10`).
*   **Glow Ambiental:** Requisito de inyectar un orbe de luz difuso dentro del modal para dar profundidad (ej. `absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl mix-blend-screen pointer-events-none`).

## 🔄 6. Regla de Carrusel Infinito (Ahorro Vertical)
Para listas cortas de opciones (ej. formas de pago, variantes de producto) no se usan radio buttons clásicos ni listas largas que rompan el scroll vertical. Se usa el "Infinite Vertical Carousel".

*   **Estructura Base:** Un contenedor `relative overflow-hidden cursor-pointer active:scale-[0.98]` con una **altura fija absoluta** (ej. `style={{ height: '68px' }}`).
*   **Mecanismo Interno:** Un track interno con `absolute bottom-0 w-full flex flex-col-reverse transition-transform duration-500`.
*   **Animación:** Rotación hacia abajo aplicando `translateY` multiplicando el índice del estado por la altura del componente.
*   **Ilusión Infinita:** Clonar el array de datos (ej. `Array(20).fill(items).flat()`) para que el usuario pueda hacer tap infinitamente sin reiniciar bruscamente la animación.

## ✨ 7. Elementos Premium y UX Adicional
*   **Tipografía de Precisión:** Uso de `tabular-nums` y variaciones como `slashed-zero` para cronómetros, reproductores de audio, o saldos de billetera.
*   **Soft-Delete Visual:** Al requerir que un usuario "elimine" un registro histórico (que debe persistir en base de datos), realizar la ocultación en cliente mediante listas de exclusión (`localStorage` o estado) (`items.filter(item => !hiddenIds.includes(item.id))`).
*   **Cero Ruido:** No delinear elementos con bordes fuertes. Utilizar el espacio en blanco (negativo), transparencias sutiles y sombras de cristal para definir jerarquías. Todo componente redundante o repetitivo (ej. labels obvios, badges que no aportan información crítica) debe omitirse.

## 🪟 8. Regla de Encabezados Principales (PageHeaders)
Se declara la erradicación de los encabezados manuales extensos construidos individualmente en cada vista. Cualquier vista principal, panel de control o módulo de administración DEBE importar e implementar el componente maestro unificado.

*   **Componente Maestro:** `import PageHeader from "@/components/ui/PageHeader";`
*   **Glow Atmosférico:** El PageHeader provee por defecto el fondo de desenfoque (glass-header) y permite aplicar un destello temático mediante el prop glow (ej. glow="admin", glow="superadmin" o glow="modelo").
*   **Estandarización de Acciones:** Toda acción primaria de la página (ej. "Nuevo Producto", "Crear Usuario") debe inyectarse a través del prop actions.
*   **Distribución Responsive:** El <PageHeader> maneja automáticamente la alineación vertical en pantallas móviles y horizontal en escritorio. Queda **ESTRICTAMENTE PROHIBIDO** intentar sobreescribir sus clases estructurales de flexbox desde la vista padre.

## 📐 9. Regla de Simetría de Widgets en Escritorio
En layouts de grid o dashboards donde múltiples tarjetas conviven en la misma fila, la **simetría vertical es inquebrantable**. Todos los componentes hijos (widgets) deben compartir la misma estructura base para garantizar un escalado uniforme:

*   **Encabezado:** Altura estricta y compartida (ej. `h-[40px]`) para que todos los títulos inicien y terminen en el mismo eje Y.
*   **Contenedor Principal:** Tarjeta flexible (`flex flex-col`).
*   **Cuerpo Interno:** Expansible (`flex-1`).
*   **Footer:** Anclado estrictamente al fondo (`mt-auto`) para que los call-to-action ("Ver completo") coincidan horizontalmente sin importar el volumen del contenido interno. Esto previene que diferencias de contenido rompan el equilibrio visual de la interfaz.

## 📜 10. Regla de Scrollbars Internas (Apple Scroll)
Queda **ESTRICTAMENTE PROHIBIDO** dejar las barras de desplazamiento (scrollbars) nativas del navegador expuestas en componentes internos, o usar utilidades genéricas que rompan la inmersión visual (especialmente en modo oscuro).
Todo contenedor con desplazamiento interno (ej. `overflow-y-auto`) DEBE usar la clase global `.apple-scroll` definida en el sistema base.
*   **Diseño:** Provee una barra ultra-delgada (4px), con un riel completamente transparente y un *thumb* (pulgar) con gradientes translúcidos que se adapta perfectamente tanto al Light como al Dark Mode sin ser intrusivo.

## ⏱️ 11. Regla de Simetría en Líneas de Tiempo (Timeline Symmetry)
Para listas de procesos iterativos o líneas de tiempo (como históricos de solicitudes o historiales de transacciones), se requiere un diseño minimalista, despejado y matemáticamente alineado:

*   **Minimalismo en Indicadores (Zero-Bubble Rule):** Los iconos de estado (como relojes o checks) NO deben estar encapsulados dentro de "burbujas" o círculos con fondos invasivos. Los iconos deben mostrarse "al desnudo", heredando el color respectivo de su estado y beneficiándose de sombras sutiles estilo neón (ej. `drop-shadow(0px 0px 4px rgba(..., 0.8))`).
*   **Simetría Vertical Absoluta (Píldoras de Ancho Fijo):** Los componentes dentro de un Timeline que sirven como identificadores visuales (por ejemplo, píldoras informando la Plataforma) deben tener una restricción fuerte de ancho (ej. `w-[120px] max-w-[120px]`). Esto garantiza que independientemente del texto que contengan ("Chaturbate" vs "Babestation"), la simetría vertical de toda la columna no se quiebre, dando una apariencia premium y robusta.
*   **Limpieza Tipográfica (Cero Ruido):** Los títulos descriptivos de los estados no pueden ser completamente en mayúsculas ni contener subtítulos redundantes que sobrecarguen el espacio (como "25 solicitudes"). Deben aplicar `capitalize` (ej. "Solicitada", "Pendiente") o `lowercase` con fuente `medium` o `semibold`.

## 📊 12. Tipologías Estructurales de Widgets (Admin Dashboard)
El ecosistema administrativo se compone de pilares fundamentales (Widgets) que deben respetar las reglas de simetría horizontal y vertical (Regla 9). Cualquier nueva iteración sobre estos widgets debe seguir sus definiciones únicas:

*   **Widget de Facturación (Billing Summary):**
    *   **Estructura:** Layout de doble contenedor para garantizar simetría vertical con widgets vecinos.
    *   **Métricas Core:** Se rechazan las etiquetas genéricas largas. Uso exclusivo de terminología minimalista y directa: `Gross` (Bruto/Total), `Team Cut` (Corte de Agencia) y `Profit` (Ganancia/Modelo).
    *   **Desplazamiento:** Listados internos construidos con contenedores expansibles (`flex-1`) y restricciones de altura o desbordamiento usando obligatoriamente `.apple-scroll`.
    *   **Jerarquía de Datos:** El ordenamiento debe priorizar la productividad o facturación mayor, manteniendo anclada la sede matriz (ej. `Agencia Innova`) siempre en la cabeza del listado para facilitar la lectura administrativa.

*   **Widget de Noticias (What's News?):**
    *   **Posicionamiento:** Queda prohibido destinar "filas exclusivas de anuncios" que generen ruido visual. El widget de noticias debe insertarse orgánicamente dentro del grid principal del dashboard.
    *   **Alineación:** Su contenedor (`flex flex-col`), cabecera (`h-[40px]`) y footer anclado (`mt-auto`) se configuran matemáticamente para crear una simetría de bloque perfecto frente a otros widgets (como Facturación y Productividad).

*   **Widget de Productividad y Tasas (Productivity / Financial Rates):**
    *   **Estructura:** Componente hermano que hereda la "Regla Cards" estricta (padding, bordes, radios) de la Facturación para igualarlo en estética.
    *   **Dynamic Time Island:** La información crítica pero breve, como las tasas de cambio del día, no debe requerir paneles grandes. Se resume e integra mediante *tickers* flotantes, islas dinámicas o pequeñas sub-tarjetas que aligeran la carga visual.

## 🏎️ 13. Regla de Rendimiento y Estado en Carruseles (Stale-While-Revalidate)
**"El estado del usuario no debe desaparecer visualmente por el ciclo de vida de React en interfaces móviles."**
*   **Cachés Globales:** Para componentes inyectados dentro de un carrusel móvil que se montan y desmontan constantemente (ej. Facturación, Productividad), se prohíbe el parpadeo de carga recurrente.
*   **Patrón Stale-While-Revalidate:** Se deben utilizar cachés externas a React (ej. variables globales tipo `Map` como `globalCache`). Los widgets pesados deben hidratarse instantáneamente de su estado anterior, mientras actualizan silenciosamente sus datos en segundo plano sin interrumpir la experiencia visual de arrastre o navegación del usuario.

## 🖐️ 14. Regla de Interfaces Híbridas y Animación Táctil
**"Las interacciones táctiles complejas deben gobernar sobre las animaciones CSS puras."**
*   **Gestos Fluidos:** Al construir interfaces que requieran "arrastre libre" (Swipe), pausas (Doble-Tap), o controles bidireccionales fluidos (ej. La Isla Dinámica), es inadmisible atar la lógica estructural a animaciones rígidas de CSS `@keyframes`.
*   **Motor JS:** Emplear motores de iteración basados en `requestAnimationFrame` que permitan mutar el DOM en tiempo real y enlazar el ciclo de vida del puntero (`onPointerDown`, `onPointerMove`, `onPointerUp`) directamente al desplazamiento físico (`translateX`/`Y`). Esto garantiza una inmersión nativa a 60 FPS bajo el dedo del usuario, permitiendo soltar, detener o adelantar elementos en medio movimiento de forma natural y libre.

## 🛡️ 15. Regla de Normalización Defensiva en la Interfaz (UI Sanitization)
**"La interfaz de usuario debe blindarse ante la corrupción de caracteres o duplicidades provenientes de la base de datos."**
*   **Datos Críticos:** Elementos visuales críticos y mapas de datos iterativos (como el renderizado de tasas de cambio `USD->COP` vs `USD→COP` vs `USD??COP` o keys únicos) jamás deben confiar ciegamente en la exactitud tipográfica del backend si están sujetos a errores de codificación UTF-8 o entrada manual de múltiples administradores.
*   **Normalización Agresiva:** Implementar algoritmos de "Normalización Agresiva" (ej. extracción pura de letras usando Regex `/[^A-Za-z]/g`) durante las fases de mapeo o reducción (`.reduce`, `.filter`) para asegurar que la capa visual logre identificar equivalencias matemáticas y destruya duplicados antes de tocar el DOM. Esto previene de forma absoluta las inundaciones visuales o fallos en cascada de renderizado.

## 📋 16. Regla de Planillas y Formularios (Zero-Noise)
Las interfaces de recolección de datos y tablas densas deben minimizar drásticamente la fricción visual y el ruido tipográfico para integrarse perfectamente al diseño "Apple Style 2".

*   **Cabeceras de Tabla Iluminadas:** Los títulos de las columnas de cualquier tabla administrativa (ej. "Usuario", "Plataformas", "Acciones") dejan de ser grises. Deben iluminarse y destacarse usando `text-gray-900 dark:text-white font-bold tracking-tight` para guiar claramente la vista del usuario a través del *GlassCard*.
*   **Píldoras Transparentes (Acciones de Formulario):** Los botones aglomerados (como "Guardar" y "Cancelar") al final de un formulario o panel NO deben dejarse sueltos. Deben agruparse dentro de un contenedor envolvente en forma de píldora translúcida (`flex items-center gap-1 p-1.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-[2rem] backdrop-blur-xl shadow-sm`).
*   **Botón Primario Resplandeciente:** Dentro de esa píldora, la acción primaria destacará radicalmente utilizando un fondo degradado (ej. `bg-gradient-to-r from-sky-500 to-fuchsia-500 rounded-full`) y un resplandor fuerte para denotar su importancia (`shadow-[0_0_15px...] hover:shadow-[0_0_25px...]`).
*   **Inputs Numéricos Inmaculados (Cero Flechas):** Queda estrictamente prohibido el uso de los controles nativos (*spin buttons* / flechas arriba y abajo) que los navegadores añaden a los campos de tipo `number`. Todos los inputs deben llevar la clase global `.apple-input`, la cual erradica estos controles mediante CSS webkit para asegurar un entorno inmaculado.
