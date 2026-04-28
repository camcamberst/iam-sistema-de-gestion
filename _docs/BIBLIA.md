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
