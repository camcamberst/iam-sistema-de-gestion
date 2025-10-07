# 📋 PRINCIPIOS ESTÉTICOS Y FUNCIONALES - SISTEMA IAM

## 🎯 **PRINCIPIOS ESTABLECIDOS**

---

## **1. 📝 PRINCIPIO GRAMATICAL**

### **🎯 Objetivo:**
Evitar definición de género en la gramática para un lenguaje más inclusivo y profesional.

### **✅ Implementación:**
- **Formas infinitivas neutras** en lugar de formas imperativas
- **Sin connotaciones de género** en la interfaz
- **Lenguaje directo y profesional**

### **📋 Ejemplos Aplicados:**

#### **Dropdowns y Formularios:**
- ✅ `"Seleccionar modelo"` (no `"Selecciona un modelo"`)
- ✅ `"Seleccionar grupo"` (no `"Selecciona un grupo"`)
- ✅ `"Seleccionar período"` (no `"Selecciona un período"`)

#### **Botones y Acciones:**
- ✅ `"Guardar cambios"` (no `"Guarda los cambios"`)
- ✅ `"Crear usuario"` (no `"Crea un usuario"`)
- ✅ `"Configurar calculadora"` (no `"Configura la calculadora"`)

### **🔧 Aplicación Futura:**
Este principio debe aplicarse en:
- **Todos los dropdowns** del sistema
- **Botones de acción** en formularios
- **Placeholders** de inputs
- **Mensajes de interfaz**

---

## **2. 👤 PRINCIPIO DE DROPDOWNS DE MODELO**

### **🎯 Objetivo:**
Mostrar nombres de modelo más legibles y consistentes en dropdowns de selección.

### **✅ Implementación:**
```typescript
// Patrón estándar para dropdowns de modelo
label: model.email ? model.email.split('@')[0] : model.name
```

### **📋 Beneficios:**
- **Nombres cortos**: `angelicawinter` vs `Melanié Valeria Castellanos Martínez`
- **Consistencia**: Todos los nombres tienen formato similar
- **Escaneo rápido**: Más fácil encontrar modelos en listas largas
- **Menos scroll**: Nombres más cortos = más opciones visibles

### **🔧 Aplicación:**
- **"Ver Calculadora de Modelo"**
- **"Gestión de Usuarios"** (si se agrega filtro por modelo)
- **Cualquier nuevo dropdown de selección de modelo**
- **Reportes y dashboards** que requieran selección de modelo

---

## **3. 🎨 PRINCIPIO DE ESTÉTICA APPLE**

### **🎯 Objetivo:**
Aplicar estilo Apple consistente en todos los componentes informativos del sistema.

### **✅ Componentes Estándar:**
- **`InfoCard`**: Tarjetas individuales con estilo Apple
- **`InfoCardGrid`**: Grid de tarjetas con layout responsivo
- **Colores consistentes**: Azul, verde, púrpura, naranja
- **Tipografía uniforme**: Tamaños y pesos consistentes
- **Sombras y bordes**: Estilo sutil y elegante

### **📋 Aplicación en Módulos:**

#### **"Mi Calculadora":**
- ✅ "Tasas Actualizadas" con `InfoCardGrid`
- ✅ "Totales y Alertas" con `InfoCardGrid`
- ✅ "Objetivo Básico en Progreso" con gradientes dinámicos

#### **"Solicitar Anticipo":**
- ✅ "Resumen de Productividad" con `InfoCardGrid`
- ✅ Colores específicos: "Ya Pagados" en naranja

#### **"Historial de Anticipos":**
- ✅ Estadísticas con `InfoCardGrid`
- ✅ Botones clickables con filtrado

#### **"Mi Historial":**
- ✅ Resumen con `InfoCardGrid`

### **🔧 Implementación Técnica:**
```typescript
<InfoCardGrid 
  cards={[
    {
      value: "Valor",
      label: "Etiqueta",
      color: "blue" | "green" | "purple" | "orange",
      onClick: () => handleClick(),
      clickable: true
    }
  ]}
  columns={3}
  className="mb-6"
/>
```

---

## **4. 🔄 PRINCIPIO DE INTERACCIÓN DE DROPDOWNS**

### **🎯 Objetivo:**
Garantizar interacción fluida entre múltiples dropdowns sin bloqueos.

### **✅ Implementación:**

#### **Coordinación de Estado:**
```typescript
const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

const handleFilterFocus = (filterId: string) => {
  setActiveDropdown(filterId); // Cerrar otros dropdowns
};
```

#### **Manejo de Clicks Externos:**
```typescript
useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (searchBarRef.current && !searchBarRef.current.contains(event.target as Node)) {
      setActiveDropdown(null);
      setIsExpanded(false);
    }
  }
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

#### **Tolerancia de Interacción:**
```typescript
// 150ms de tolerancia para evitar cierre accidental
useEffect(() => {
  if (isHovering) {
    setOpen(true);
  } else {
    const timer = setTimeout(() => {
      if (!isHovering) {
        setOpen(false);
      }
    }, 150);
    return () => clearTimeout(timer);
  }
}, [isHovering]);
```

### **📋 Beneficios:**
- **Sin bloqueos**: Solo un dropdown abierto a la vez
- **Cierre automático**: Al abrir un dropdown, se cierran los otros
- **Click fuera**: Cierra todos los dropdowns al hacer click fuera
- **Tolerancia**: Evita cierres accidentales durante navegación

---

## **5. 💾 PRINCIPIO DE PERSISTENCIA**

### **🎯 Objetivo:**
Garantizar que los valores editados persistan correctamente en el sistema.

### **✅ Implementación:**

#### **Sincronización de APIs:**
```typescript
// Misma lógica entre admin-view y model-values-v2
const { data: allRecentValues } = await supabase
  .from('model_values')
  .select('*')
  .eq('model_id', modelId)
  .gte('period_date', sevenDaysAgoStr) // Filtro de fecha
  .order('updated_at', { ascending: false }); // Orden consistente
```

#### **Deduplicación por Plataforma:**
```typescript
const platformMap = new Map<string, any>();
allRecentValues?.forEach((value: any) => {
  if (!platformMap.has(value.platform_id)) {
    platformMap.set(value.platform_id, value);
  }
});
const modelValues = Array.from(platformMap.values());
```

#### **Filtrado de Valores Corregido:**
```typescript
// Guardar TODOS los valores, incluyendo 0 y negativos
Object.entries(editValues).forEach(([platformId, value]) => {
  const numericValue = Number.parseFloat(value) || 0;
  valuesToSave[platformId] = numericValue; // Sin filtro restrictivo
});
```

#### **Orden de Operaciones:**
```typescript
// Limpiar estado ANTES de recargar
setEditValues({});
setHasChanges(false);
await handleModelSelect(selectedModel);
```

### **📋 Beneficios:**
- **Consistencia de datos**: Ambas APIs usan la misma lógica
- **Persistencia correcta**: Los valores se mantienen después del guardado
- **Sin conflictos**: No hay mezcla de datos antiguos y nuevos
- **Valores 0 y negativos**: Se guardan correctamente

---

## **6. 🔍 PRINCIPIO DE LOGGING Y DIAGNÓSTICO**

### **🎯 Objetivo:**
Proporcionar logging detallado para diagnóstico y debugging eficiente.

### **✅ Implementación:**

#### **Logging en Frontend:**
```typescript
// En handleValueChange:
console.log('🔍 [VALUE-CHANGE] Platform:', platformId, 'Value:', value);
console.log('🔍 [VALUE-CHANGE] Updated editValues:', newValues);

// En handleSave:
console.log('🔍 [ADMIN-SAVE] Current editValues:', editValues);
console.log('🔍 [ADMIN-SAVE] Has changes:', hasChanges);
console.log('🔍 [ADMIN-EDIT] Saving values:', valuesToSave);
```

#### **Logging en APIs:**
```typescript
// En model-values-v2:
console.log('🔍 [MODEL-VALUES-V2] Rows to upsert:', rows);
console.log('✅ [MODEL-VALUES-V2] Values saved successfully:', data);

// En admin-view:
console.log('🔍 [ADMIN-VIEW] Values count:', data.values?.length || 0);
console.log('🔍 [ADMIN-VIEW] Period date:', data.periodDate);
```

### **📋 Beneficios:**
- **Diagnóstico claro**: Logs detallados para identificar problemas
- **Trazabilidad**: Seguimiento completo del flujo de datos
- **Debugging eficiente**: Identificación rápida de issues
- **Mantenimiento**: Facilita futuras correcciones

---

## **📊 RESUMEN DE PRINCIPIOS**

### **✅ Principios Establecidos:**
1. **📝 Gramatical**: Lenguaje inclusivo y neutro
2. **👤 Dropdowns de Modelo**: Nombres legibles y consistentes
3. **🎨 Estética Apple**: Componentes visuales uniformes
4. **🔄 Interacción**: Dropdowns sin bloqueos
5. **💾 Persistencia**: Valores que se mantienen correctamente
6. **🔍 Logging**: Diagnóstico detallado y transparente

### **🎯 Aplicación Futura:**
- **Nuevos componentes** deben seguir estos principios
- **Refactoring** de componentes existentes
- **Documentación** de cambios importantes
- **Testing** de funcionalidades críticas

### **📝 Mantenimiento:**
- **Revisar** estos principios en cada nueva funcionalidad
- **Actualizar** la documentación cuando sea necesario
- **Comunicar** cambios a todo el equipo
- **Validar** que se mantenga la consistencia

---

**Estos principios garantizan un sistema coherente, funcional y mantenible.** 🚀
