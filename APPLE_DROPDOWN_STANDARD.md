# 🎨 ESTÁNDAR APPLEDROPDOWN - SISTEMA AIM

## 📋 RESUMEN EJECUTIVO

**AppleDropdown** es el componente estándar oficial para todos los dropdowns en el Sistema AIM. Este documento establece las directrices obligatorias para su uso en nuevas funciones y mantenimiento de código existente.

---

## 🎯 PRINCIPIOS FUNDAMENTALES

### ✅ USAR SIEMPRE AppleDropdown PARA:
- **Selección simple** → Un valor de una lista de opciones
- **Filtros** → Dropdowns de filtrado en páginas administrativas
- **Formularios** → Campos de selección en formularios
- **Configuraciones** → Opciones de configuración del sistema

### ❌ NO USAR AppleDropdown PARA:
- **Selección múltiple compleja** → Usar checkboxes o componente específico
- **Navegación** → Usar menús de navegación apropiados
- **Acciones** → Usar botones normales

---

## 🔧 IMPLEMENTACIÓN ESTÁNDAR

### **1. IMPORTACIÓN OBLIGATORIA:**
```typescript
import AppleDropdown from '@/components/ui/AppleDropdown';
```

### **2. USO BÁSICO:**
```typescript
<AppleDropdown
  options={[
    { value: '', label: 'Selecciona una opción' },
    { value: 'opcion1', label: 'Opción 1' },
    { value: 'opcion2', label: 'Opción 2' }
  ]}
  value={selectedValue}
  onChange={(value) => setSelectedValue(value)}
  placeholder="Selecciona una opción"
/>
```

### **3. CON BADGES (RECOMENDADO):**
```typescript
<AppleDropdown
  options={[
    { value: 'activo', label: 'Activo', badge: 'Disponible', badgeColor: 'green' },
    { value: 'inactivo', label: 'Inactivo', badge: 'No disponible', badgeColor: 'red' }
  ]}
  value={status}
  onChange={setStatus}
  placeholder="Selecciona estado"
/>
```

---

## 🎨 CARACTERÍSTICAS APPLE STYLE

### **✅ INCLUYE AUTOMÁTICAMENTE:**
- **Bordes redondeados** → `rounded-lg`
- **Sombras suaves** → `shadow-lg`
- **Animaciones** → Transiciones de 200ms
- **Hover effects** → Estados hover elegantes
- **SVG animado** → Flecha que rota al abrir/cerrar
- **Click-outside** → Cierre automático
- **Escape key** → Cierre con teclado
- **Scrollbar Apple** → Estilo macOS en listas largas

### **🎯 COLORES DE BADGES:**
- `green` → Estados positivos (activo, configurado, exitoso)
- `blue` → Estados informativos (pendiente, en proceso)
- `red` → Estados negativos (error, rechazado, inactivo)
- `yellow` → Estados de advertencia (pendiente revisión)
- `gray` → Estados neutros (sin configurar, por defecto)

---

## 📱 PÁGINAS YA CONVERTIDAS

### **✅ ADMIN PAGES:**
- `/admin/calculator/config` → Filtros de grupo y modelo
- `/admin/calculator/view-model` → Filtros de grupo y modelo
- `/admin/users` → Selección de roles (modales)
- `/admin/users/create` → Selección de rol
- `/admin/rates` → Selección de scope y currency
- `/admin/audit` → Filtros de severity y status

### **✅ MODEL PAGES:**
- `/model/anticipos/solicitar` → Banco y tipo de cuenta
- `/model/anticipos/historial` → Filtro de período

---

## 🚀 DIRECTRICES PARA NUEVAS FUNCIONES

### **1. OBLIGATORIO EN NUEVOS DESARROLLOS:**
- **Toda nueva página** → Debe usar AppleDropdown para selecciones
- **Formularios nuevos** → Solo AppleDropdown, nunca `<select>` nativo
- **Filtros nuevos** → Implementar con AppleDropdown

### **2. PROPS REQUERIDAS:**
```typescript
interface RequiredProps {
  options: DropdownOption[];    // OBLIGATORIO
  value: string;               // OBLIGATORIO
  onChange: (value: string) => void; // OBLIGATORIO
  placeholder?: string;        // RECOMENDADO
}
```

### **3. PROPS OPCIONALES ÚTILES:**
```typescript
interface OptionalProps {
  className?: string;          // Para estilos adicionales
  disabled?: boolean;          // Para deshabilitar
  maxHeight?: string;          // Para listas largas
  autoOpen?: boolean;          // Para auto-apertura
}
```

---

## 🔧 MIGRACIÓN DE CÓDIGO EXISTENTE

### **❌ CÓDIGO LEGACY (ELIMINAR):**
```typescript
// ❌ NO HACER - Select nativo
<select className="apple-input">
  <option value="">Selecciona</option>
  <option value="1">Opción 1</option>
</select>

// ❌ NO HACER - Dropdown manual
<div className="relative">
  <button onClick={() => setOpen(!open)}>
    {selected || 'Selecciona'}
  </button>
  {open && (
    <div className="absolute">
      {/* opciones manuales */}
    </div>
  )}
</div>
```

### **✅ CÓDIGO ESTÁNDAR (USAR):**
```typescript
// ✅ HACER - AppleDropdown
<AppleDropdown
  options={options}
  value={selected}
  onChange={setSelected}
  placeholder="Selecciona una opción"
/>
```

---

## 📊 BENEFICIOS DEL ESTÁNDAR

### **🎨 CONSISTENCIA VISUAL:**
- **Misma apariencia** → En todo el sistema
- **Comportamiento predecible** → UX consistente
- **Estética Apple** → Profesional y moderna

### **⚡ EFICIENCIA DE DESARROLLO:**
- **Menos código** → No reinventar dropdowns
- **Menos bugs** → Componente probado
- **Mantenimiento fácil** → Un solo lugar para cambios

### **🔧 FUNCIONALIDAD ROBUSTA:**
- **Accesibilidad** → Teclado y screen readers
- **Performance** → Optimizado para listas grandes
- **Responsive** → Funciona en móvil y desktop

---

## 🎯 CUMPLIMIENTO OBLIGATORIO

### **✅ PARA DESARROLLADORES:**
1. **Revisar código existente** → Identificar dropdowns nativos
2. **Migrar gradualmente** → Convertir a AppleDropdown
3. **Nuevas funciones** → Solo usar AppleDropdown
4. **Code reviews** → Rechazar dropdowns nativos

### **✅ PARA REVISORES:**
1. **Verificar imports** → Debe importar AppleDropdown
2. **Rechazar `<select>`** → No aprobar código con selects nativos
3. **Validar props** → Verificar uso correcto de opciones
4. **Probar funcionalidad** → Confirmar comportamiento Apple

---

## 📝 EJEMPLOS DE IMPLEMENTACIÓN

### **FILTRO SIMPLE:**
```typescript
<AppleDropdown
  options={[
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' }
  ]}
  value={filter}
  onChange={setFilter}
  placeholder="Filtrar por estado"
/>
```

### **CON BADGES INFORMATIVOS:**
```typescript
<AppleDropdown
  options={models.map(model => ({
    value: model.id,
    label: model.name,
    badge: model.hasConfig ? 'Configurado' : 'Sin configurar',
    badgeColor: model.hasConfig ? 'green' : 'gray'
  }))}
  value={selectedModel}
  onChange={setSelectedModel}
  placeholder="Selecciona modelo"
/>
```

### **LISTA LARGA CON SCROLL:**
```typescript
<AppleDropdown
  options={longList}
  value={selected}
  onChange={setSelected}
  placeholder="Buscar en lista"
  maxHeight="max-h-48"
/>
```

---

## 🚀 CONCLUSIÓN

**AppleDropdown es el estándar oficial del Sistema AIM.**

- ✅ **Obligatorio** para nuevas funciones
- ✅ **Recomendado** migrar código existente
- ✅ **Consistente** con la estética del sistema
- ✅ **Mantenible** y escalable

**¡Adopta el estándar y mantén la excelencia visual del Sistema AIM! 🎯✨**
