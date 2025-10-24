# 📐 Estándar de Dimensiones - Dashboard

## 🎯 OBJETIVO
Establecer las dimensiones del **Dashboard** como estándar oficial para todo el proyecto, asegurando consistencia visual en todas las páginas.

---

## 📏 DIMENSIONES ESTÁNDAR DEL DASHBOARD

### 🌐 **Contenedor Principal de Página**
```css
/* Fondo de página */
min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 
dark:from-gray-900 dark:via-gray-800 dark:to-gray-900

/* Contenedor principal */
max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16
```

### 📋 **Header Principal**
```css
/* Contenedor del header */
mb-12

/* Card del header */
bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 
border border-white/20 dark:border-gray-600/20 
shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20

/* Título principal */
text-2xl font-bold

/* Subtítulo */
text-sm text-gray-600 dark:text-gray-300
```

### 🎴 **Cards de Contenido**
```css
/* Contenedor de cards */
bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 
border border-white/20 dark:border-gray-600/20 
shadow-md dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15

/* Espaciado entre cards */
gap-6 (grid) o space-y-6 (flex)
```

### 📊 **Tarjetas Individuales (dentro de cards)**
```css
/* Tarjetas pequeñas */
p-3 bg-white dark:bg-white backdrop-blur-sm rounded-lg 
border border-gray-200/30 dark:border-gray-500/30 shadow-sm

/* Espaciado entre tarjetas */
space-y-3

/* Iconos pequeños */
w-8 h-8 bg-gray-50 dark:bg-gray-50 rounded-lg

/* Textos de tarjetas */
text-sm font-semibold (títulos)
text-xs (subtítulos)
text-base font-bold (números)
```

### 📝 **Tamaños de Fuente Estándar**
```css
/* Títulos principales */
text-2xl font-bold

/* Títulos de sección */
text-lg font-semibold

/* Títulos de cards */
text-base font-semibold

/* Texto normal */
text-sm

/* Texto pequeño */
text-xs

/* Números importantes */
text-base font-bold
```

### 📐 **Espaciado Estándar**
```css
/* Margen inferior del header */
mb-12

/* Margen inferior de secciones */
mb-6

/* Padding de cards principales */
p-6

/* Padding de tarjetas pequeñas */
p-3

/* Espaciado entre elementos */
space-x-3, space-y-3

/* Espaciado entre secciones */
gap-6
```

---

## 🎨 **APLICACIÓN DEL ESTÁNDAR**

### ✅ **Páginas que DEBEN seguir este estándar:**
- ✅ Dashboard (Admin, SuperAdmin, Model)
- ✅ Definir RATES
- ✅ Configurar Calculadora
- ✅ Ver Calculadora Modelo
- ✅ Gestión Usuarios
- ✅ Gestión Anticipos
- ✅ Gestión Sedes
- ✅ Todas las páginas del proyecto

### 📋 **Checklist de Implementación:**
- [ ] **Contenedor principal** con `max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16`
- [ ] **Header** con `mb-12` y padding `p-6`
- [ ] **Cards principales** con `p-6` y efectos de luz apropiados
- [ ] **Tarjetas pequeñas** con `p-3` y `space-y-3`
- [ ] **Tamaños de fuente** según estándar
- [ ] **Espaciado** consistente entre elementos
- [ ] **Efectos de luz** apropiados para cada tipo de elemento

---

## 🚫 **ANTI-PATRONES (NO HACER)**

### ❌ **Dimensiones excesivas:**
- ❌ `p-8` en cards principales (usar `p-6`)
- ❌ `py-5` en tarjetas pequeñas (usar `p-3`)
- ❌ `w-12 h-12` en iconos pequeños (usar `w-8 h-8`)
- ❌ `text-xl` en números normales (usar `text-base`)
- ❌ `space-y-5` entre tarjetas (usar `space-y-3`)

### ❌ **Espaciado excesivo:**
- ❌ `mb-8` en headers (usar `mb-12` para página, `mb-6` para secciones)
- ❌ `space-x-4` en elementos pequeños (usar `space-x-3`)

---

## 📚 **EJEMPLOS DE IMPLEMENTACIÓN**

### 🏠 **Página Principal:**
```tsx
<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
  <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
    {/* Header */}
    <div className="mb-12">
      <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
        <h1 className="text-2xl font-bold">Título</h1>
      </div>
    </div>
    
    {/* Contenido */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-md dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
        {/* Contenido del card */}
      </div>
    </div>
  </div>
</div>
```

### 🎴 **Card con Tarjetas Individuales:**
```tsx
<div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-md dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-base font-semibold">Título del Card</h2>
  </div>
  
  <div className="space-y-3">
    {items.map(item => (
      <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-white backdrop-blur-sm rounded-lg border border-gray-200/30 dark:border-gray-500/30 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-50 dark:bg-gray-50 rounded-lg flex items-center justify-center">
            <span className="text-sm">{item.icon}</span>
          </div>
          <div>
            <div className="text-sm font-semibold">{item.title}</div>
            <div className="text-xs">{item.subtitle}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold">{item.value}</div>
        </div>
      </div>
    ))}
  </div>
</div>
```

---

## 🎯 **RESUMEN**

**El Dashboard establece el estándar de dimensiones para todo el proyecto:**

- **Contenedor:** `max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16`
- **Header:** `mb-12` con `p-6`
- **Cards:** `p-6` con efectos de luz apropiados
- **Tarjetas pequeñas:** `p-3` con `space-y-3`
- **Iconos:** `w-8 h-8` para elementos pequeños
- **Fuentes:** `text-2xl` (títulos), `text-base` (normal), `text-sm` (pequeño)
- **Espaciado:** `gap-6` entre secciones, `space-y-3` entre elementos

**¡Todas las páginas del proyecto deben seguir estas dimensiones exactas!**
