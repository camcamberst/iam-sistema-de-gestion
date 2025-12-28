# Estándares de UX Móvil y Visuales del Sistema

## 📱 Índice
1. [Estándares Visuales Replicados](#estándares-visuales-replicados)
2. [Mejoras de UX Móvil por Componente](#mejoras-de-ux-móvil-por-componente)
3. [Patrones de Diseño Responsivo](#patrones-de-diseño-responsivo)
4. [Componentes Mejorados](#componentes-mejorados)

---

## 🎨 Estándares Visuales Replicados

### 1. Header Estándar

**Aplicado en:**
- `app/admin/model/dashboard/page.tsx` (Dashboard Modelo)
- `app/admin/model/calculator/page.tsx` (Mi Calculadora - Ingresar Valores)
- `app/admin/model/anticipos/solicitar/page.tsx` (Solicitar Anticipo)
- `app/admin/model/anticipos/solicitudes/page.tsx` (Mis Solicitudes)
- `app/admin/model/anticipos/historial/page.tsx` (Mi Historial)
- `app/admin/model/portafolio/page.tsx` (Mi Portafolio)
- `app/admin/users/create/page.tsx` (Crear Usuario)
- `app/admin/dashboard/page.tsx` (Dashboard Admin)
- `app/superadmin/dashboard/page.tsx` (Dashboard Super Admin)

**Estructura estándar:**
```tsx
<div className="mb-8 sm:mb-12">
  <div className="relative">
    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
    <div className="relative bg-white/80 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 md:gap-3">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white">...</svg>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
              Título
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 hidden sm:block">
              Subtítulo
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

**Características:**
- **Espaciado:** `mb-8 sm:mb-12` (más compacto en móvil)
- **Padding:** `p-4 sm:p-6` (reducido en móvil)
- **Layout:** `flex-col md:flex-row` (vertical en móvil, horizontal en desktop)
- **Icono:** `w-10 h-10 sm:w-12 sm:h-12` (más pequeño en móvil)
- **Título:** `text-base sm:text-lg md:text-2xl` (escalado responsivo)
- **Subtítulo:** `hidden sm:block` (oculto en móvil)
- **Truncate:** `whitespace-nowrap overflow-hidden text-ellipsis` (evita desbordes)

---

## 📱 Mejoras de UX Móvil por Componente

### 1. Dashboard Modelo

#### Corcho Informativo (`AnnouncementBoardWidget`)
**Archivo:** `components/AnnouncementBoardWidget.tsx`

**Mejoras:**
- Padding reducido: `p-3 sm:p-4`
- Iconos más pequeños: `w-4 h-4 sm:w-5 sm:h-5`
- Títulos ajustados: `text-sm sm:text-base`
- Subtítulos ocultos: `hidden sm:block`
- Botones más compactos: `px-3 py-1.5 sm:px-4 sm:py-2`

#### Resumen de Productividad
**Archivo:** `app/admin/model/dashboard/page.tsx`

**Mejoras:**
- Grid compacto: `grid-cols-2` en móvil (2 columnas), tercera card ocupa 2 columnas
- Padding reducido: `p-3 sm:p-4` para contenedor principal
- InfoCard compacto: `size="sm"` con `p-2 sm:p-4`, `text-base` para valores, `text-[10px]` para labels
- Progress bar: `h-1.5 sm:h-2` (más delgado en móvil)
- Iconos: `w-5 h-5 sm:w-6 sm:h-6`
- Spacing: `mb-2.5 sm:mb-4`, `gap-2 sm:gap-3`
- Labels acortados: "USD Modelo" y "COP Modelo" (sin "(hoy)")

### 2. Mi Calculadora (Ingresar Valores)

**Archivo:** `app/admin/model/calculator/page.tsx`

**Mejoras:**
- **Header:** Estándar aplicado
- **Tabla de plataformas:** Convertida a cards en móvil (`md:table-row-group` para desktop, `md:hidden` para mobile cards)
- **Inputs:** `h-12` (48px) en móvil, `h-9`/`h-10` en desktop, `border-2`, `touch-manipulation`
- **Grid de tasas:** `grid-cols-2` en móvil, `grid-cols-3` en desktop
- **Botones:** `px-4 py-2.5 sm:px-5 sm:py-3`, `active:scale-95`, `touch-manipulation`
- **Input flotante P1:** `h-11` en móvil, `h-9`/`h-10` en desktop, botones de acción más grandes
- **Padding general:** `p-4 sm:p-6`

#### Totales y Alertas
**Mejoras:**
- Cards: `grid-cols-2` en móvil, tercera card ocupa 2 columnas (`col-span-2 md:col-span-1`)
- Padding: `p-3 sm:p-4` para contenedor principal, `p-2.5 sm:p-3` para progress bar
- InfoCard: `p-2 sm:p-4` para `size="sm"`, `text-base` para valores, `text-[10px]` para labels
- Progress bar: `h-1.5 sm:h-2`, iconos `w-5 h-5 sm:w-6 sm:h-6`
- Spacing: `mb-2.5 sm:mb-4`, `gap-2 sm:gap-3`
- Botón "Guardar": `px-3 py-2 sm:px-4 sm:py-2.5`, `text-xs sm:text-sm`
- Sección Anticipo: `p-3 sm:p-4`, `text-xs sm:text-sm`, `mb-4 sm:mb-6`

### 3. Solicitar Anticipo

**Archivo:** `app/admin/model/anticipos/solicitar/page.tsx`

**Mejoras:**
- **Header:** Estándar aplicado
- **Inputs:** `h-12` en móvil, `h-10` en desktop, `border-2`, `touch-manipulation`
- **Radio buttons:** `min-h-[48px]`, padding `p-3 sm:p-4`, `active:bg-gray-100`, radio buttons más grandes (`w-5 h-5 sm:w-4 sm:h-4`)
- **Botones:** `w-full sm:w-auto`, `py-3 sm:py-2.5`, `active:scale-95`, `touch-manipulation`
- **Padding:** `p-4 sm:p-6`, gaps `gap-4 sm:gap-6`, spacing `space-y-6 sm:space-y-8`

### 4. Mis Solicitudes

**Archivo:** `app/admin/model/anticipos/solicitudes/page.tsx`

**Mejoras:**
- **Header:** Estándar aplicado
- **Botón:** `w-full md:w-auto`, `py-2.5 sm:py-3`, `active:scale-95`, `touch-manipulation`
- **Filtros:** Layout `flex-col sm:flex-row`, padding `p-3 sm:p-4`
- **Cards de solicitudes:** `bg-gray-50 dark:bg-gray-600/20` para campos, padding `p-3 sm:p-4`, cards `p-4 sm:p-6`, gap `gap-3 sm:gap-4`
- **Textos:** `text-xs sm:text-sm` para labels, `text-base sm:text-lg` para valores
- **Comentarios:** `bg-blue-50 dark:bg-blue-900/20`
- **Empty state:** `p-6 sm:p-8`, iconos y textos ajustados, botón full-width en móvil

### 5. Mi Historial

**Archivo:** `app/admin/model/anticipos/historial/page.tsx`

**Mejoras:**
- **Header:** Estándar aplicado
- **Dropdown de período:** `w-full md:w-auto` en móvil
- **Resumen:** 2 columnas en móvil, 3 en desktop, cards `sm` size, tercera card ocupa 2 columnas
- **Cards de anticipo:** Layout `flex-col sm:flex-row` en móvil, mejor separación de información, padding `p-3 sm:p-4`
- **Textos:** `text-xs sm:text-sm` para labels, `text-base sm:text-lg` para valores
- **Comentarios:** Mejor padding y contraste
- **Botones:** Layout `flex-col sm:flex-row` en móvil, `w-full sm:w-auto`, `py-2.5 sm:py-3`, `active:scale-95`, `touch-manipulation`
- **Empty state:** `py-6 sm:py-8`, iconos y textos ajustados

### 6. Mi Portafolio

**Archivo:** `app/admin/model/portafolio/page.tsx`

**Mejoras:**
- **Header:** Estándar aplicado
- **Tabs:** Layout `flex-col sm:flex-row` en móvil, padding `py-2.5 sm:py-2`, `active:scale-95`, `touch-manipulation`, `text-sm sm:text-base`
- **Tags de plataformas:** `px-3 sm:px-2.5 py-2 sm:py-1`, `text-xs sm:text-[11px]`, `leading-4 sm:leading-5`, `min-h-[40px] sm:min-h-0`, `gap-2 sm:gap-2`, `active:scale-95`, `touch-manipulation`
- **Modal de detalle:** Layout `flex-col sm:flex-row` para header y botones, padding `p-3 sm:p-4`
- **Inputs de credenciales:** `h-12 sm:h-auto`, `border-2`, `touch-manipulation`
- **Botones de acción:** `min-h-[48px] sm:min-h-0`, `active:scale-95`, `touch-manipulation`
- **Cards de estadísticas:** `grid-cols-2 md:grid-cols-4` (2 columnas en móvil), padding `p-4 sm:p-6`, layout `flex-col sm:flex-row`, cuarta card `col-span-2 md:col-span-1`, iconos `w-6 h-6 sm:w-8 sm:h-8`
- **Métricas:** `grid-cols-2` en móvil, cards con `bg-white/50 dark:bg-gray-700/50`, padding `p-2 sm:p-0`, `text-xs sm:text-sm` para labels, `text-base sm:text-lg` para valores

### 7. Timeline Portafolio Modelos

**Archivo:** `components/PlatformTimeline.tsx`

**Mejoras:**
- **Contenedor:** Padding `p-3 sm:p-4`, max-height `max-h-96 sm:max-h-80`
- **Header:** Layout `flex-col sm:flex-row`, gap `gap-2 sm:gap-0`, título `text-sm sm:text-base`, contador `text-xs sm:text-sm`
- **Cards:** Layout `flex-col sm:flex-row` en móvil, padding `p-3`, spacing `gap-2.5 sm:gap-3`
- **Información del modelo:** Layout `flex-col sm:flex-row`, nombre `font-semibold` en móvil, indicador `w-2.5 h-2.5 sm:w-2 sm:h-2`
- **Plataforma y grupo:** Layout `flex-wrap` en móvil, separadores `hidden sm:inline`, padding `px-2.5 sm:px-2`
- **Botón cerrar:** Padding `p-2 sm:p-1`, icono `w-4 h-4 sm:w-3 sm:h-3`, `active:scale-95 touch-manipulation`
- **Timeline:** Layout horizontal con `overflow-x-auto`, conectores `w-4 sm:w-6`, iconos `w-5 h-5`, espaciado `space-x-2 sm:space-x-3`, `flex-shrink-0`, `whitespace-nowrap`

### 8. Consultar Usuarios

**Archivo:** `app/admin/users/page.tsx`

**Mejoras:**
- **Header:** Estándar aplicado
- **Búsqueda y Filtros:** Textos informativos ocultos en móvil (`hidden sm:flex`)
- **Contador de resultados:** Oculto en móvil (`hidden sm:flex`)

### 9. Crear Usuario

**Archivo:** `app/admin/users/create/page.tsx`

**Mejoras:**
- **Header:** Estándar aplicado

### 10. Dashboards Admin y Super Admin

**Archivos:** 
- `app/admin/dashboard/page.tsx`
- `app/superadmin/dashboard/page.tsx`

**Mejoras:**
- **Header:** Estándar aplicado

---

## 🎯 Patrones de Diseño Responsivo

### 1. Inputs y Campos de Formulario

**Estándar móvil:**
```tsx
className="h-12 sm:h-10 border-2 touch-manipulation"
```

**Características:**
- Altura mínima: `h-12 (48px)` en móvil para mejor área táctil
- Border: `border-2` para mejor visibilidad
- Touch: `touch-manipulation` para mejor respuesta táctil

### 2. Botones

**Estándar móvil:**
```tsx
className="w-full sm:w-auto px-4 py-2.5 sm:px-5 sm:py-3 active:scale-95 touch-manipulation"
```

**Características:**
- Ancho: `w-full` en móvil, `w-auto` en desktop
- Padding: `px-4 py-2.5` en móvil, `px-5 py-3` en desktop
- Feedback: `active:scale-95` para feedback visual
- Touch: `touch-manipulation` para mejor respuesta

### 3. Cards y Contenedores

**Estándar móvil:**
```tsx
className="p-3 sm:p-4 sm:p-6"
```

**Características:**
- Padding reducido en móvil: `p-3` o `p-4`
- Padding normal en desktop: `p-4` o `p-6`

### 4. Grids Responsivos

**Patrón común:**
```tsx
className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 sm:gap-4"
```

**Características:**
- 2 columnas en móvil
- 3-4 columnas en desktop
- Gaps más pequeños en móvil

### 5. Textos Responsivos

**Títulos:**
```tsx
className="text-base sm:text-lg md:text-2xl"
```

**Labels:**
```tsx
className="text-xs sm:text-sm"
```

**Valores:**
```tsx
className="text-base sm:text-lg"
```

### 6. Layouts Flex

**Vertical en móvil, horizontal en desktop:**
```tsx
className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:gap-4"
```

---

## 🧩 Componentes Mejorados

### 1. AppleSearchBar

**Archivo:** `components/AppleSearchBar.tsx`

**Mejoras móvil:**
- Coordinación de dropdowns para evitar conflictos
- Refs individuales para cada dropdown
- Manejo de eventos táctiles (`touchstart`, `touchend`)
- Z-index dinámico para dropdown activo
- Textos informativos ocultos en móvil (`hidden sm:flex`)
- Label "Filtros activos:" oculto en móvil
- Contador de filtros activos oculto en móvil

### 2. AppleSelect

**Archivo:** `components/AppleSelect.tsx`

**Mejoras móvil:**
- Manejo de eventos táctiles (`onTouchStart`, `onTouchEnd`)
- `stopPropagation` para evitar conflictos
- `touch-manipulation` CSS class
- `active:scale-[0.98]` para feedback visual
- Mejor manejo de `blur` con delays

### 3. InfoCard

**Archivo:** `components/ui/InfoCard.tsx`

**Mejoras móvil:**
- Tamaño `sm` optimizado:
  - Padding: `p-2 sm:p-4` (antes `p-3 sm:p-4`)
  - Valor: `text-base` (antes `text-lg`)
  - Label: `text-[10px]` (antes `text-[11px]`)

### 4. AIM Assistant (ChatWidget)

**Archivo:** `components/chat/MainChatWindow.tsx`

**Mejoras móvil:**
- Ancho: `w-[calc(100%-2rem)]` en móvil (márgenes de 16px)
- Posición: `left-4 right-4` en móvil
- Desktop: `sm:w-80` (320px), `sm:left-auto sm:right-[calc(24px+40px+28px)]`

### 5. Menú Móvil

**Archivo:** `app/admin/layout.tsx`

**Mejoras:**
- Estados separados para dropdowns móviles (`mobileCalculatorDropdownOpen`, `mobileAnticiposDropdownOpen`, `mobilePortfolioDropdownOpen`)
- Backdrop con `pointerEvents: 'none'` cuando dropdowns están abiertos
- Delay de 100ms en `useEffect` para cierre de menú
- `stopPropagation` y `preventDefault` en eventos táctiles
- Clases `sub-menu-item` y `sub-menu-container` para detección de clicks

---

## 📊 Resumen de Estándares

### Clases CSS Comunes

| Propósito | Móvil | Desktop |
|-----------|-------|---------|
| Padding contenedor | `p-3` o `p-4` | `p-4` o `p-6` |
| Altura inputs | `h-12` (48px) | `h-9` o `h-10` |
| Padding botones | `px-4 py-2.5` | `px-5 py-3` |
| Tamaño título | `text-base` | `text-lg md:text-2xl` |
| Tamaño label | `text-xs` | `text-sm` |
| Tamaño valor | `text-base` | `text-lg` |
| Grid columnas | `grid-cols-2` | `md:grid-cols-3` o `md:grid-cols-4` |
| Layout | `flex-col` | `sm:flex-row` o `md:flex-row` |

### Utilidades CSS

- `touch-manipulation`: Mejor respuesta táctil
- `active:scale-95`: Feedback visual al tocar
- `whitespace-nowrap overflow-hidden text-ellipsis`: Truncate de texto
- `hidden sm:block` o `hidden sm:flex`: Ocultar en móvil
- `min-h-[48px]`: Altura mínima táctil recomendada

---

## ✅ Checklist de Implementación

Al aplicar mejoras móviles a nuevos componentes:

- [ ] Header con estándar aplicado
- [ ] Inputs con `h-12` en móvil y `touch-manipulation`
- [ ] Botones con `w-full sm:w-auto` y `active:scale-95`
- [ ] Padding reducido en móvil (`p-3 sm:p-4`)
- [ ] Textos responsivos (`text-xs sm:text-sm`, etc.)
- [ ] Layout vertical en móvil (`flex-col sm:flex-row`)
- [ ] Grids con 2 columnas en móvil
- [ ] Subtítulos ocultos en móvil (`hidden sm:block`)
- [ ] Área táctil mínima de 48px
- [ ] Feedback visual en interacciones (`active:scale-95`)

---

**Última actualización:** Diciembre 2024
**Versión:** 1.0

