# Guía de Estilo Apple Style 2 - Sistema de Gestión AIM

## 📋 Resumen Ejecutivo

**Apple Style 2** es el sistema de diseño actual implementado en la sub-función "Gestionar Sedes", caracterizado por elementos compactos, elegantes y profesionales con una estética refinada que mantiene la funcionalidad completa del sistema.

**Apple Style Minimalista** es el sistema de diseño anterior, documentado para posibles rollbacks.

---

## 🎨 Apple Style 2 - Principios de Diseño

### **Filosofía Visual**
- **Compacto y Elegante:** Elementos más pequeños pero proporcionalmente equilibrados
- **Profesional:** Estética corporativa sin sacrificar usabilidad
- **Consistente:** Dimensiones uniformes en toda la interfaz
- **Limpio:** Eliminación de elementos redundantes o excesivos

### **Paleta de Colores**
```css
/* Colores Principales */
- Azul Principal: from-blue-500 to-indigo-600
- Gris Corporativo: from-gray-600 to-slate-700
- Fondo: bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50

/* Estados */
- Activo: bg-blue-100, text-blue-700
- Hover: hover:from-blue-700 hover:to-indigo-700
- Focus: focus:ring-2 focus:ring-blue-500
```

---

## 📐 Especificaciones Técnicas

### **1. HEADER PRINCIPAL**
```css
/* Contenedor */
className="relative bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg"

/* Icono */
className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md"

/* SVG */
className="w-5 h-5 text-white"

/* Título */
className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent"

/* Descripción */
className="mt-1 text-sm text-gray-600"

/* Espaciado */
className="flex items-center space-x-3"
```

### **2. GRID PRINCIPAL**
```css
/* Contenedor */
className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10"

/* Columnas */
className="flex flex-col h-full" (izquierda)
className="flex flex-col space-y-6 h-full" (derecha)
```

### **3. TARJETAS DE ACCIÓN**
```css
/* Contenedor */
className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 h-full flex flex-col"

/* Iconos */
className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center"

/* SVG */
className="w-3 h-3 text-white"

/* Títulos */
className="text-base font-semibold text-gray-900"

/* Espaciado */
className="flex items-center space-x-2 mb-4"
```

### **4. BOTONES PRINCIPALES**
```css
/* Botón Azul (Crear Room) */
className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 px-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5"

/* Botón Gris (Crear Sede) */
className="w-full bg-gradient-to-r from-gray-700 to-slate-800 text-white py-2 px-3 rounded-lg hover:from-gray-800 hover:to-slate-900 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-sm font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5"

/* Alineación */
className="mt-auto" (para botones al final de tarjetas)
```

### **5. INFORMACIÓN DE SEDE**
```css
/* Contenedor Principal */
className="relative bg-white/80 backdrop-blur-sm rounded-lg shadow-md border border-white/20 p-4"

/* Header de Sede */
className="flex items-center justify-between mb-4"
className="flex items-center space-x-3"

/* Icono de Sede */
className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md"
className="w-4 h-4 text-white" (SVG)

/* Título de Sede */
className="text-lg font-semibold text-gray-900"

/* Descripción */
className="text-xs text-gray-500"

/* Badge Activa */
className="flex items-center space-x-1.5 bg-blue-100 px-2 py-1 rounded-full"
className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"
className="text-xs text-blue-700 font-medium"
```

### **6. ADMIN ASIGNADO**
```css
/* Contenedor */
className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 backdrop-blur-sm rounded-lg p-4 mb-4 border border-blue-200/30"

/* Título (SIN ICONO) */
className="text-sm font-semibold text-gray-900"
className="mb-3" (margen)

/* Avatar */
className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md"
className="text-white font-semibold text-sm"

/* Información */
className="flex items-center space-x-3"
className="text-sm font-semibold text-gray-900" (nombre)
className="text-xs text-gray-600" (email)
className="text-xs text-blue-600 font-medium" (sedes asignadas)
```

### **7. ROOMS DISPONIBLES**
```css
/* Header */
className="flex items-center space-x-2 mb-3"

/* Icono */
className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center"
className="w-2.5 h-2.5 text-white" (SVG)

/* Título */
className="text-sm font-semibold text-gray-900"

/* Contenedor de Botones */
className="flex flex-wrap gap-2"

/* Botones de Room */
className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 hover:from-gray-200 hover:to-slate-200 hover:text-gray-900 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 border border-gray-200/50"

/* SVG de Botones */
className="w-3 h-3 mr-1.5"
```

### **8. PLANILLAS Y FORMULARIOS (ZERO-NOISE)**
```css
/* Cabeceras de Tabla Iluminadas */
className="... text-gray-900 dark:text-white font-bold tracking-tight ..." (Destacan sobre el fondo como los títulos principales)

/* Píldora Transparente para Botones de Acción (Formularios) */
className="flex items-center gap-1 p-1.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-[2rem] backdrop-blur-xl shadow-sm"

/* Botón Primario en Píldora (Gradient Glow) */
className="px-6 py-2 text-[13px] font-bold text-white bg-gradient-to-r from-sky-500 to-fuchsia-500 rounded-full shadow-[0_0_15px_rgba(14,165,233,0.4)] dark:shadow-[0_0_15px_rgba(14,165,233,0.3)] hover:shadow-[0_0_25px_rgba(14,165,233,0.6)]"

/* Ocultación de Flechas en Inputs Numéricos (Global) */
.apple-input[type="number"]::-webkit-inner-spin-button,
.apple-input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
```

---

## 🔄 Apple Style Minimalista (Anterior)

### **Características del Sistema Anterior**
```css
/* Elementos más grandes */
- Padding: p-8 (vs p-4 actual)
- Iconos: w-12 h-12 (vs w-8 h-8 actual)
- Títulos: text-3xl (vs text-2xl actual)
- Espaciado: space-y-8 (vs space-y-6 actual)
- Border radius: rounded-2xl (vs rounded-xl actual)
- Shadow: shadow-xl (vs shadow-lg actual)

/* Avatar redundante */
- Icono junto a "Admin Asignado" (eliminado en Apple Style 2)

/* Botones más grandes */
- py-3 px-4 (vs py-2 px-3 actual)
- rounded-xl (vs rounded-lg actual)
```

---

## 🎯 Aplicación del Sistema

### **Archivos a Modificar**

#### **Panel Admin**
1. `app/admin/dashboard/page.tsx`
2. `app/admin/sedes/dashboard/page.tsx`
3. `app/admin/sedes/asignaciones/page.tsx`
4. `app/admin/users/page.tsx`
5. `app/admin/calculator/config/page.tsx`
6. `app/admin/anticipos/page.tsx`

#### **Panel Super Admin**
1. `app/admin/sedes/gestionar/page.tsx` ✅ (Ya implementado)
2. Otros archivos de super admin

#### **Panel Modelo**
1. `app/model/dashboard/page.tsx`
2. `app/model/calculator/view-model/page.tsx`

### **Componentes Reutilizables**
1. `components/ui/AppleDropdown.tsx` ✅ (Ya implementado)
2. Crear componentes base para botones, tarjetas, etc.

---

## 🚀 Plan de Implementación

### **Fase 1: Componentes Base**
- [ ] Crear `components/ui/AppleButton.tsx`
- [ ] Crear `components/ui/AppleCard.tsx`
- [ ] Crear `components/ui/AppleIcon.tsx`

### **Fase 2: Panel Admin**
- [ ] Dashboard principal
- [ ] Gestión de usuarios
- [ ] Calculadora
- [ ] Anticipos

### **Fase 3: Panel Modelo**
- [ ] Dashboard modelo
- [ ] Calculadora modelo

### **Fase 4: Testing y Refinamiento**
- [ ] Verificar funcionalidad
- [ ] Ajustes finales
- [ ] Documentación final

---

## ⚠️ Consideraciones Importantes

### **Integridad del Sistema**
- ✅ **NO modificar:** APIs, base de datos, lógica de negocio
- ✅ **Solo cambiar:** Clases CSS/Tailwind
- ✅ **Mantener:** Funcionalidad completa
- ✅ **Preservar:** Barra de menú principal superior

### **Testing**
- Verificar que todos los botones funcionen
- Confirmar que los dropdowns operen correctamente
- Validar que los modales se abran/cierren
- Comprobar responsividad en diferentes pantallas

### **Rollback**
- Documentar cambios en commits separados
- Mantener branch `apple-style-minimalista` como backup
- Crear script de rollback si es necesario

---

## 📝 Notas de Desarrollo

### **Orden de Implementación Recomendado**
1. **Componentes base** (botones, tarjetas, iconos)
2. **Páginas menos críticas** (para probar el sistema)
3. **Páginas principales** (dashboard, gestión)
4. **Páginas de usuario final** (modelo)

### **Validación Continua**
- Probar cada página después de los cambios
- Verificar que no se rompa funcionalidad
- Mantener consistencia visual
- Documentar cualquier ajuste necesario

---

*Documento creado: $(date)*
*Versión: Apple Style 2 v1.0*
*Estado: Implementado en "Gestionar Sedes"*
