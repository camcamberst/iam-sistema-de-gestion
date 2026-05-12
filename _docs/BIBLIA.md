# BIBLIA DEL SISTEMA (Leyes de Arquitectura)

Este documento contiene las reglas de oro constitucionales del proyecto `iam-gestion`. 
**El agente debe consultar estrictamente este documento y acatar las leyes dispuestas antes de proceder con cualquier rediseño o ajuste visual.**

## LEY 1: Consistencia Global y Unificación de Elementos
**"Los cambios que se hagan en un elemento deben ser aplicados a elementos similares en diferentes páginas."**

* **Directriz**: Toda modificación a un componente que exista en múltiples vistas (ej. `PageHeader`, `InfoCardGrid`, Barras de Objetivo Boreal) debe hacerse sobre una fuente central y propagarse a todo el sistema.
* **Excepciones**: Solo habrá casos en los que sean únicos y específicos para algún elemento en particular (ej. si en un header específico vamos a incluir botones u opciones exclusivas de esa ruta). 
* **Acción**: Si se descubre código duplicado de UI compleja (copiar/pegar de JSX), es obligación unificarlo en un super-componente (`components/ui`) y referenciarlo.

## LEY 2: Separación de Viewports (Aislamiento de Responsabilidades Mobile vs Desktop)
**"Los cambios que se especifiquen para una versión no pueden afectar a la otra."**

* **Directriz**: Cuando un cambio se encomiende específicamente para la "versión móvil" (Mobile viewport / `max-sm:`, `max-md:`), esto NO puede causar asimetrías, distorsiones, o side-effects en la "versión de escritorio" (Desktop / `sm:`, `md:`, `lg:`). 
* **Acción**: Al escribir clases de Tailwind, el estado por defecto o base aplicará estricto aislamiento responsivo. Si se cambian padding, borders o displays, se debe envolver en `max-sm:` o compensarlo explícitamente en `sm:` para mantener el Desktop intacto.

## LEY 3: Apple Style 2 y Estética Boreal (Reglas Visuales)
* **Directriz**: Los contenedores móviles no deben usar `GlassCards` perimetrales pesadas que limiten el espacio (No meter tarjetas dentro de tarjetas). Los elementos como *Objetivo* operarán bajo sombras neón de "Reactor Boreal" y fondos oscuros obsidianos (Dark Mode premium). 
* **Simetría de Widgets en Escritorio**: En layouts de grid o dashboards donde múltiples tarjetas conviven en la misma fila, la **simetría vertical es inquebrantable**. Todos los componentes hijos (widgets) deben compartir la misma estructura base para garantizar un escalado uniforme: 
  - Un encabezado de altura estricta y compartida (ej. `h-[40px]`).
  - Una tarjeta contenedora flexible (`flex flex-col`).
  - Un cuerpo interno expansible (`flex-1`).
  - Un footer anclado al fondo (`mt-auto`). 
  Esto previene que diferencias de contenido rompan el equilibrio visual de la interfaz.

## LEY 4: Rendimiento y Estado en Carruseles (Stale-While-Revalidate)
**"El estado del usuario no debe desaparecer visualmente por el ciclo de vida de React en interfaces móviles."**

* **Directriz**: Para componentes inyectados dentro de un carrusel móvil que se montan y desmontan constantemente, se prohíbe el parpadeo de carga recurrente.
* **Acción**: Implementar un patrón "Stale-While-Revalidate" utilizando cachés globales externas a React (ej. `globalCache` usando variables tipo `Map`). Los widgets pesados (Productividad, Facturación) deben hidratarse instantáneamente de su estado anterior, mientras actualizan silenciosamente sus datos en segundo plano sin interrumpir la experiencia visual.

## LEY 5: Interfaces Híbridas y Animación Controlada por JS
**"Las interacciones táctiles complejas deben gobernar sobre las animaciones CSS puras."**

* **Directriz**: Al construir interfaces que requieran "arrastre libre" (Swipe), pausas (Doble-Tap), o controles fluidos (ej. La Isla Dinámica), es inadmisible usar solo animaciones rígidas tipo CSS `@keyframes`.
* **Acción**: Emplear motores de iteración basados en `requestAnimationFrame` que permitan mutar el DOM en tiempo real y enlazar el ciclo de vida del puntero (`onPointerDown/Move/Up`) directamente al desplazamiento, garantizando una fusión nativa a 60 FPS con los gestos del usuario.

## LEY 6: Normalización Defensiva de Datos en Interfaz (UI Sanitization)
**"La interfaz de usuario debe blindarse ante la corrupción de caracteres o duplicidades provenientes de la base de datos."**

* **Directriz**: Elementos visuales críticos y mapas de datos (como tasas de cambio, keys únicos) jamás deben confiar en la exactitud tipográfica del backend si están sujetos a errores de codificación o entrada manual (ej. `USD->COP` vs `USD→COP` vs `USD??COP`).
* **Acción**: Implementar "Normalización Agresiva" (ej. extracción pura de caracteres alfabéticos o uso de diccionarios de control) durante las fases de mapeo/reducción para asegurar que la UI depure duplicidades antes del renderizado, evitando inundaciones visuales o fallos en cascada.
