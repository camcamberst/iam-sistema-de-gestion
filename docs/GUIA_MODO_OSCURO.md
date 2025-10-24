# 🌙 Guía Modo Oscuro - AIM Sistema de Gestión

## 📋 Índice
1. [Introducción](#introducción)
2. [Configuración Base](#configuración-base)
3. [Colores Estándar](#colores-estándar)
4. [Componentes](#componentes)
5. [Layouts y Navegación](#layouts-y-navegación)
6. [Efectos de Luz/Glow](#efectos-de-luzglow)
7. [Contraste y Legibilidad](#contraste-y-legibilidad)
8. [Implementación](#implementación)
9. [Mejores Prácticas](#mejores-prácticas)

---

## 🎯 Introducción

Esta guía documenta el estándar de modo oscuro implementado en el AIM Sistema de Gestión. Todos los componentes, layouts y elementos del proyecto deben seguir estos patrones para mantener consistencia visual y una experiencia de usuario óptima.

### 🎨 Filosofía de Diseño
- **Contraste óptimo** para legibilidad
- **Colores inversamente proporcionales** entre modo claro y oscuro
- **Efectos sutiles** de luz/glow para diferenciación
- **Experiencia moderna** y sofisticada empresarial

---

## ⚙️ Configuración Base

### Tailwind CSS
```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class', // Habilitado
  // ... resto de configuración
}
```

### Toggle de Tema
```tsx
// components/ThemeToggle.tsx
// Usa localStorage para persistir preferencia
// Detecta preferencia del sistema automáticamente
```

---

## 🎨 Colores Estándar

### 🏗️ Fondos Principales

#### Páginas y Contenedores
```css
/* Fondo principal de páginas */
bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 
dark:from-gray-900 dark:via-gray-800 dark:to-gray-900

/* Contenedores principales */
bg-white/70 dark:bg-gray-700/70
```

#### Headers y Navegación
```css
/* Barra de navegación principal */
bg-white dark:bg-gray-900
border-white/20 dark:border-gray-700/30
```

### 📝 Textos

#### Jerarquía de Textos
```css
/* Títulos principales */
text-gray-900 dark:text-gray-100

/* Títulos con gradiente */
bg-gradient-to-r from-gray-900 to-gray-700 
dark:from-gray-100 dark:to-gray-300

/* Textos secundarios */
text-gray-600 dark:text-gray-300

/* Textos informativos */
text-gray-500 dark:text-gray-400

/* Textos de enlaces */
text-blue-600 dark:text-white
```

### 🎯 Elementos Interactivos

#### Botones y Enlaces
```css
/* Enlaces de navegación */
text-gray-600 dark:text-white
hover:text-gray-900 dark:hover:text-gray-200

/* Estados activos */
text-gray-900 dark:text-white 
bg-white/50 dark:bg-gray-800/50
```

#### Inputs y Formularios
```css
/* Inputs estándar */
border-gray-300 dark:border-gray-600
bg-white dark:bg-gray-800
text-gray-900 dark:text-gray-100

/* Labels */
text-gray-700 dark:text-gray-200
```

---

## 🧩 Componentes

### 📊 Cards y Contenedores

#### Cards Principales
```css
/* Contenedor principal */
bg-white/70 dark:bg-gray-700/70
backdrop-blur-sm rounded-xl
border-white/20 dark:border-gray-600/20
shadow-md dark:shadow-lg
```

#### Cards Internos
```css
/* Elementos dentro de cards */
bg-white/60 dark:bg-gray-700/60
border-gray-200/30 dark:border-gray-500/30
```

### 📋 Tablas y Listas

#### Headers de Tabla
```css
text-gray-700 dark:text-gray-200
```

#### Celdas de Datos
```css
text-gray-900 dark:text-gray-100
```

#### Badges y Estados
```css
/* Badges activos */
bg-green-50 dark:bg-green-900/20
text-green-700 dark:text-green-300

/* Badges inactivos */
bg-gray-50 dark:bg-gray-700
text-gray-600 dark:text-gray-300
```

### 🎛️ Dropdowns y Menús

#### Dropdowns Principales
```css
/* Contenedor dropdown */
bg-white/95 dark:bg-gray-700/95
backdrop-blur-md
border-white/30 dark:border-gray-600/30
```

#### Opciones de Dropdown
```css
/* Opciones normales */
text-gray-900 dark:text-gray-100
hover:bg-gray-50 dark:hover:bg-gray-700

/* Opciones activas */
bg-blue-50 dark:bg-blue-900/20
text-blue-900 dark:text-blue-100
```

---

## 🧭 Layouts y Navegación

### 📱 Barra de Navegación Principal

#### Estructura Base
```tsx
<header className="bg-white dark:bg-gray-900 backdrop-blur-md border border-white/20 dark:border-gray-700/30 sticky top-0 z-[99999] shadow-lg">
```

#### Enlaces de Navegación
```css
/* Enlaces normales */
text-gray-600 dark:text-white
hover:text-gray-900 dark:hover:text-gray-200

/* Enlaces activos */
text-gray-900 dark:text-white
bg-white/50 dark:bg-gray-800/50
```

### 🎨 Efectos de Luz por Panel

#### Model Panel (Azul)
```css
dark:shadow-lg dark:shadow-blue-900/15 
dark:ring-0.5 dark:ring-blue-400/20
```

#### Admin Panel (Verde)
```css
dark:shadow-lg dark:shadow-green-900/15 
dark:ring-0.5 dark:ring-green-400/20
```

#### Super Admin Panel (Púrpura)
```css
dark:shadow-lg dark:shadow-purple-900/15 
dark:ring-0.5 dark:ring-purple-400/20
```

---

## ✨ Efectos de Luz/Glow

### 🎯 Aplicación Estándar

#### Headers y Navegación
```css
/* Efecto base para headers */
dark:shadow-lg dark:shadow-COLOR-900/15 
dark:ring-0.5 dark:ring-COLOR-400/20
```

#### Cards y Contenedores
```css
/* Efecto para cards principales */
dark:shadow-lg dark:shadow-COLOR-900/10 
dark:ring-0.5 dark:ring-COLOR-500/15
```

### 🎨 Colores por Contexto

#### Azul (Model Panel)
- `dark:shadow-blue-900/15`
- `dark:ring-blue-400/20`

#### Verde (Admin Panel)
- `dark:shadow-green-900/15`
- `dark:ring-green-400/20`

#### Púrpura (Super Admin Panel)
- `dark:shadow-purple-900/15`
- `dark:ring-purple-400/20`

#### Naranja (Anticipos)
- `dark:shadow-orange-900/15`
- `dark:ring-orange-400/20`

#### Cian (Calculadora)
- `dark:shadow-cyan-900/15`
- `dark:ring-cyan-400/20`

---

## 👁️ Contraste y Legibilidad

### 📏 Reglas de Contraste

#### ✅ Aprobado
```css
/* Texto blanco sobre fondo oscuro */
text-white dark:text-white
bg-gray-800 dark:bg-gray-800

/* Texto oscuro sobre fondo claro */
text-gray-900 dark:text-gray-100
bg-white dark:bg-gray-700
```

#### ❌ Evitar
```css
/* NUNCA: Texto blanco sobre fondo gris claro */
text-white bg-gray-300

/* NUNCA: Texto claro sobre fondo claro */
text-gray-300 bg-gray-200
```

### 🎯 Números y Valores

#### Valores Monetarios
```css
/* Números importantes (siempre legibles) */
text-gray-900 dark:text-gray-900
```

#### Labels y Etiquetas
```css
/* Labels de valores */
text-gray-600 dark:text-gray-300
```

---

## 🛠️ Implementación

### 📁 Estructura de Archivos

```
app/
├── layout.tsx                 # Layout raíz
├── admin/layout.tsx           # Layout Admin
├── superadmin/layout.tsx      # Layout Super Admin
└── model/layout.tsx           # Layout Model

components/
├── ThemeToggle.tsx           # Toggle de tema
├── BillingSummary.tsx        # Resumen de facturación
├── BillingSummaryCompact.tsx # Resumen compacto
├── ActiveRatesPanel.tsx      # Panel de tasas
└── ui/
    ├── AppleDropdown.tsx     # Dropdown Apple
    └── InfoCard.tsx          # Cards informativos
```

### 🔧 Clases CSS Estándar

#### Contenedor Principal
```css
min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 
dark:from-gray-900 dark:via-gray-800 dark:to-gray-900
```

#### Card Estándar
```css
bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl 
border border-white/20 dark:border-gray-600/20 
shadow-md dark:shadow-lg
```

#### Header Estándar
```css
bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl 
border border-white/20 dark:border-gray-700/20 
shadow-lg dark:shadow-lg
```

---

## 📋 Mejores Prácticas

### ✅ DO (Hacer)

1. **Siempre usar clases dark:** para modo oscuro
2. **Mantener contraste óptimo** entre texto y fondo
3. **Aplicar efectos de luz** en elementos principales
4. **Usar colores inversamente proporcionales**
5. **Probar en ambos modos** antes de deployar

### ❌ DON'T (No Hacer)

1. **Nunca usar texto blanco** sobre fondos grises claros
2. **No omitir clases dark:** en nuevos componentes
3. **No usar colores fijos** sin variantes dark
4. **No aplicar efectos excesivos** que distraigan
5. **No romper la consistencia** visual establecida

### 🎯 Checklist de Implementación

#### Para Nuevos Componentes
- [ ] Aplicar clases `dark:` correspondientes
- [ ] Verificar contraste de textos
- [ ] Agregar efectos de luz si es necesario
- [ ] Probar en modo claro y oscuro
- [ ] Mantener consistencia con componentes existentes

#### Para Modificaciones
- [ ] Preservar modo claro existente
- [ ] Aplicar cambios solo en modo oscuro
- [ ] Verificar que no se rompan otros elementos
- [ ] Documentar cambios significativos

---

## 🚀 Ejemplos de Implementación

### 📊 Card de Dashboard
```tsx
<div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-md dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
    Título del Card
  </h3>
  <p className="text-sm text-gray-600 dark:text-gray-300">
    Descripción del contenido
  </p>
</div>
```

### 🧭 Enlace de Navegación
```tsx
<Link 
  href="/ruta" 
  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-white hover:text-gray-900 dark:hover:text-gray-200 rounded-lg transition-all duration-300"
>
  Enlace de Navegación
</Link>
```

### 📝 Input de Formulario
```tsx
<input 
  type="text"
  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
/>
```

---

## 📚 Recursos Adicionales

### 🎨 Paleta de Colores
- **Grises:** `gray-100` a `gray-900`
- **Azules:** `blue-400`, `blue-500`, `blue-600`
- **Verdes:** `green-400`, `green-500`, `green-600`
- **Púrpuras:** `purple-400`, `purple-500`, `purple-600`

### 🔧 Herramientas
- **Tailwind CSS IntelliSense** para autocompletado
- **Dark Mode DevTools** para testing
- **Contrast Checker** para verificar legibilidad

---

## 📝 Notas de Versión

### v1.0.0 - Implementación Inicial
- ✅ Configuración base de modo oscuro
- ✅ Colores estándar definidos
- ✅ Efectos de luz implementados
- ✅ Contraste optimizado
- ✅ Guía de implementación completa

---

**🎯 Esta guía es el estándar oficial para el modo oscuro en el AIM Sistema de Gestión. Todos los desarrolladores deben seguir estos patrones para mantener consistencia y calidad en la experiencia de usuario.**
