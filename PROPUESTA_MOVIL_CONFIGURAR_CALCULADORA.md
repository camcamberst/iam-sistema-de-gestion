# 📱 Propuesta Visual Móvil - Configurar Calculadora

## 🎯 Objetivo
Reducir significativamente el scroll vertical y mejorar la experiencia de usuario en móvil mediante:
- Secciones colapsables/acordeón
- Layout más compacto
- Mejor organización visual
- Botón flotante de guardar

## 📐 Estructura Propuesta

### 1. **Layout General**
```
┌─────────────────────────┐
│   Header (Sticky)       │
├─────────────────────────┤
│   Filtro Grupo          │ ← Compacto, siempre visible
│   Selección Modelo      │ ← Compacto, siempre visible
├─────────────────────────┤
│ ▼ Configuración         │ ← Sección colapsable
│   ├─ Seleccionar Páginas│
│   └─ Config. Reparto    │
└─────────────────────────┘
│   [Guardar] (Floating)  │ ← Botón flotante fijo
└─────────────────────────┘
```

### 2. **Secciones Colapsables**

#### A. Panel de Selección (Siempre visible, compacto)
- **Filtro por Grupo**: Dropdown compacto
- **Selección de Modelo**: Dropdown compacto
- **Info del Grupo**: Badge pequeño, solo si hay modelo seleccionado

#### B. Sección de Configuración (Colapsable)
- **Header clickeable** con icono de expandir/colapsar
- **Contenido plegable**:
  - Seleccionar Páginas (lista compacta)
  - Configuración de Reparto (una columna, compacta)

### 3. **Lista de Plataformas Optimizada**

**Versión Actual (Móvil):**
- Cards grandes con descripción
- Mucho padding
- Scroll largo

**Versión Propuesta:**
- Cards compactas (menos padding)
- Descripción oculta por defecto (expandible)
- Toggle más pequeño
- Grid de 2 columnas para nombres (si cabe)

### 4. **Configuración de Reparto Compacta**

**Versión Actual:**
- 2 columnas en desktop → 1 columna en móvil
- Mucho padding y espacio

**Versión Propuesta:**
- Una sola columna (ya está así)
- Inputs más compactos
- Labels más pequeños
- Menos espacio entre campos

### 5. **Botón Flotante de Guardar**

- **Posición**: Fijo en la parte inferior
- **Estilo**: Botón grande, visible, con sombra
- **Comportamiento**: Siempre visible mientras hay modelo seleccionado

## 🎨 Detalles de Implementación

### Secciones Colapsables
```tsx
// Estado para controlar secciones expandidas
const [expandedSections, setExpandedSections] = useState({
  platforms: true,  // Por defecto expandido
  reparto: false    // Por defecto colapsado
});
```

### Layout Compacto Móvil
```tsx
// Padding reducido en móvil
className="p-3 sm:p-6"

// Espaciado reducido
className="space-y-3 sm:space-y-6"

// Texto más pequeño
className="text-xs sm:text-sm"
```

### Lista de Plataformas Compacta
```tsx
// Cards más pequeñas
className="p-2 sm:p-3"

// Descripción oculta en móvil
className="hidden sm:block"

// Toggle más pequeño
className="h-4 w-7 sm:h-5 sm:w-9"
```

### Botón Flotante
```tsx
// Posición fija
className="fixed bottom-4 left-4 right-4 z-50 sm:hidden"

// Solo visible en móvil y cuando hay modelo seleccionado
{selectedModel && isMobile && (
  <button className="...">Guardar</button>
)}
```

## 📊 Comparación Visual

### Antes (Móvil)
- Scroll: ~2000px+ de altura
- Secciones: Todas expandidas
- Espaciado: Generoso (p-6, space-y-6)
- Botón: Al final, requiere mucho scroll

### Después (Móvil)
- Scroll: ~800-1000px de altura (reducción del 50-60%)
- Secciones: Colapsables, solo lo esencial visible
- Espaciado: Compacto (p-3, space-y-3)
- Botón: Flotante, siempre accesible

## ✅ Beneficios

1. **Menos Scroll**: Reducción del 50-60% en altura total
2. **Mejor UX**: Información organizada y accesible
3. **Más Eficiente**: Usuario ve solo lo que necesita
4. **Acción Rápida**: Botón guardar siempre visible
5. **Mejor Organización**: Secciones claramente definidas

## 🔄 Flujo de Usuario

1. Usuario abre la página → Ve filtros y selección de modelo
2. Selecciona modelo → Sección de configuración se expande automáticamente
3. Configura plataformas → Lista compacta, fácil de navegar
4. Configura reparto → Sección colapsable, expande si necesita
5. Guarda → Botón flotante siempre visible, un toque

## 📝 Notas de Implementación

- Usar `useState` para controlar secciones expandidas
- Detectar móvil con `window.innerWidth < 768`
- Animaciones suaves para expandir/colapsar
- Mantener estado de expansión durante la sesión
- Botón flotante solo en móvil (oculto en desktop)

