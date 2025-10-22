# 📋 Políticas de Dropdown - Estándar de Diseño

## 🎯 **Propósito**
Este documento establece las políticas y estándares para la implementación de dropdowns en el sistema, garantizando consistencia visual, funcionalidad y experiencia de usuario óptima.

---

## 🎨 **Especificaciones Visuales**

### **Contenedor Principal**
```css
/* Contenedor del dropdown */
.dropdown-container {
  position: relative;
  display: inline-block;
  width: 100%;
  max-width: 20rem; /* 320px */
}
```

### **Botón Trigger**
```css
/* Botón que activa el dropdown */
.dropdown-trigger {
  width: 100%;
  padding: 0.75rem 1rem; /* 12px 16px */
  border: 0;
  background: rgba(249, 250, 251, 0.8); /* gray-50/80 */
  border-radius: 0.75rem; /* 12px */
  font-size: 0.875rem; /* 14px */
  color: #374151; /* gray-700 */
  transition: all 200ms;
  cursor: pointer;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dropdown-trigger:focus {
  ring: 2px;
  ring-color: rgba(59, 130, 246, 0.2); /* blue-500/20 */
  background: white;
}

.dropdown-trigger:hover {
  background: rgba(249, 250, 251, 0.9);
}
```

### **Panel del Dropdown**
```css
/* Panel desplegable */
.dropdown-panel {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.5rem; /* 8px */
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 0.75rem; /* 12px */
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  z-index: 9999;
  overflow: hidden;
}
```

### **Lista de Opciones**
```css
/* Contenedor de opciones */
.dropdown-options {
  padding: 0.5rem 0; /* 8px vertical */
}

/* Opción individual */
.dropdown-option {
  width: 100%;
  padding: 0.75rem 1rem; /* 12px 16px */
  text-align: left;
  font-size: 0.875rem; /* 14px */
  transition: all 200ms;
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(243, 244, 246, 0.5); /* gray-100/50 */
}

/* Última opción sin divisor */
.dropdown-option:last-child {
  border-bottom: none;
}

/* Estados de hover */
.dropdown-option:hover {
  background: rgba(249, 250, 251, 0.8); /* gray-50/80 */
}

/* Estado seleccionado */
.dropdown-option.selected {
  background: rgba(239, 246, 255, 0.8); /* blue-50/80 */
  color: #1e3a8a; /* blue-900 */
  font-weight: 500;
}
```

---

## 🔧 **Especificaciones Técnicas**

### **Z-Index**
- **Dropdown Panel:** `z-index: 9999`
- **Razón:** Garantizar superposición sobre todos los elementos de la página

### **Espaciado del Contenedor**
- **Margen inferior:** `margin-bottom: 24rem` (384px)
- **Altura mínima:** `min-height: 25rem` (400px)
- **Razón:** Asegurar espacio suficiente para dropdown completo

### **Transiciones**
- **Duración:** `200ms`
- **Easing:** `ease-in-out` (por defecto)
- **Propiedades:** `all` (color, background, transform, etc.)

---

## 📱 **Comportamiento de Scroll**

### **Scroll Automático**
```javascript
// Implementación del scroll automático
useEffect(() => {
  if (dropdownOpen) {
    setTimeout(() => {
      const dropdownElement = document.querySelector('.dropdown-container');
      if (dropdownElement) {
        dropdownElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    }, 100);
  }
}, [dropdownOpen]);
```

### **Configuración del Scroll**
- **Delay:** 100ms (asegurar renderizado completo)
- **Comportamiento:** `smooth` (scroll suave)
- **Posición vertical:** `center` (centrado en viewport)
- **Posición horizontal:** `nearest` (más cercano al borde)

---

## 🎨 **Especificaciones de Color**

### **Paleta de Colores**
```css
/* Colores principales */
--dropdown-bg: rgba(255, 255, 255, 0.95);
--dropdown-trigger-bg: rgba(249, 250, 251, 0.8);
--dropdown-trigger-bg-hover: rgba(249, 250, 251, 0.9);
--dropdown-trigger-bg-focus: white;
--dropdown-text: #374151; /* gray-700 */
--dropdown-text-placeholder: #6b7280; /* gray-500 */
--dropdown-text-selected: #1e3a8a; /* blue-900 */
--dropdown-border: rgba(255, 255, 255, 0.2);
--dropdown-divider: rgba(243, 244, 246, 0.5); /* gray-100/50 */
--dropdown-hover: rgba(249, 250, 251, 0.8); /* gray-50/80 */
--dropdown-selected: rgba(239, 246, 255, 0.8); /* blue-50/80 */
--dropdown-focus-ring: rgba(59, 130, 246, 0.2); /* blue-500/20 */
```

---

## 📏 **Especificaciones de Tipografía**

### **Fuentes**
- **Familia:** `Inter, system-ui, sans-serif` (por defecto del proyecto)
- **Tamaño base:** `14px` (0.875rem)
- **Peso normal:** `400`
- **Peso seleccionado:** `500`

### **Jerarquía de Texto**
```css
/* Texto del trigger */
.dropdown-trigger {
  font-size: 0.875rem; /* 14px */
  font-weight: 400;
  line-height: 1.25;
}

/* Texto de opciones */
.dropdown-option {
  font-size: 0.875rem; /* 14px */
  font-weight: 400;
  line-height: 1.25;
}

/* Texto seleccionado */
.dropdown-option.selected {
  font-weight: 500;
}
```

---

## 🔄 **Estados y Interacciones**

### **Estados del Dropdown**
1. **Cerrado:** Solo muestra el trigger
2. **Abriendo:** Transición de 200ms
3. **Abierto:** Muestra panel con opciones
4. **Cerrando:** Transición de 200ms

### **Estados de Opciones**
1. **Normal:** Color gris, fondo transparente
2. **Hover:** Fondo gris claro
3. **Seleccionado:** Fondo azul claro, texto azul oscuro, peso 500
4. **Foco:** Ring azul claro (accesibilidad)

### **Interacciones del Usuario**
- **Click en trigger:** Abre/cierra dropdown
- **Click en opción:** Selecciona y cierra
- **Click fuera:** Cierra dropdown
- **Escape:** Cierra dropdown (recomendado)
- **Hover:** Efecto visual en opciones

---

## ♿ **Accesibilidad**

### **Atributos ARIA**
```html
<div class="dropdown-container" role="combobox" aria-expanded="false" aria-haspopup="listbox">
  <button class="dropdown-trigger" aria-labelledby="dropdown-label">
    <span id="dropdown-label">Selecciona una opción...</span>
    <svg aria-hidden="true">...</svg>
  </button>
  <div class="dropdown-panel" role="listbox" aria-label="Opciones disponibles">
    <button class="dropdown-option" role="option" aria-selected="false">Opción 1</button>
    <button class="dropdown-option" role="option" aria-selected="true">Opción 2</button>
  </div>
</div>
```

### **Navegación por Teclado**
- **Tab:** Navegar al trigger
- **Enter/Space:** Abrir dropdown
- **Arrow Down/Up:** Navegar entre opciones
- **Enter:** Seleccionar opción
- **Escape:** Cerrar dropdown

---

## 📱 **Responsive Design**

### **Breakpoints**
```css
/* Mobile (hasta 640px) */
@media (max-width: 640px) {
  .dropdown-container {
    max-width: 100%;
  }
  
  .dropdown-trigger {
    padding: 1rem;
    font-size: 1rem;
  }
}

/* Tablet (641px - 1024px) */
@media (min-width: 641px) and (max-width: 1024px) {
  .dropdown-container {
    max-width: 18rem; /* 288px */
  }
}

/* Desktop (1025px+) */
@media (min-width: 1025px) {
  .dropdown-container {
    max-width: 20rem; /* 320px */
  }
}
```

---

## 🚀 **Implementación en React**

### **Hook Personalizado**
```typescript
interface UseDropdownOptions {
  onSelect?: (value: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export function useDropdown(options: UseDropdownOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string>('');
  
  const open = useCallback(() => {
    setIsOpen(true);
    options.onOpen?.();
  }, [options]);
  
  const close = useCallback(() => {
    setIsOpen(false);
    options.onClose?.();
  }, [options]);
  
  const select = useCallback((value: string) => {
    setSelectedValue(value);
    close();
    options.onSelect?.(value);
  }, [close, options]);
  
  return {
    isOpen,
    selectedValue,
    open,
    close,
    select
  };
}
```

### **Componente Dropdown**
```typescript
interface DropdownProps {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  onSelect?: (value: string) => void;
  className?: string;
}

export function Dropdown({ options, placeholder, onSelect, className }: DropdownProps) {
  const { isOpen, selectedValue, open, close, select } = useDropdown({ onSelect });
  
  return (
    <div className={`dropdown-container ${className || ''}`}>
      <button
        className="dropdown-trigger"
        onClick={isOpen ? close : open}
        aria-expanded={isOpen}
      >
        <span>{selectedValue || placeholder}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          {/* Icono de flecha */}
        </svg>
      </button>
      
      {isOpen && (
        <div className="dropdown-panel">
          <div className="dropdown-options">
            {options.map((option) => (
              <button
                key={option.value}
                className={`dropdown-option ${selectedValue === option.value ? 'selected' : ''}`}
                onClick={() => select(option.value)}
                role="option"
                aria-selected={selectedValue === option.value}
              >
                <span>{option.label}</span>
                {selectedValue === option.value && (
                  <svg className="w-4 h-4 ml-auto">
                    {/* Icono de check */}
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## ✅ **Checklist de Implementación**

### **Antes de Implementar**
- [ ] Verificar que el contenedor tenga suficiente espacio (384px mínimo)
- [ ] Configurar z-index apropiado (9999)
- [ ] Implementar scroll automático
- [ ] Agregar divisores sutiles entre opciones
- [ ] Configurar transiciones suaves (200ms)

### **Durante la Implementación**
- [ ] Usar colores de la paleta establecida
- [ ] Aplicar tipografía consistente
- [ ] Implementar estados de hover y selección
- [ ] Agregar atributos ARIA para accesibilidad
- [ ] Configurar navegación por teclado

### **Después de Implementar**
- [ ] Probar en diferentes dispositivos
- [ ] Verificar accesibilidad con lectores de pantalla
- [ ] Validar comportamiento del scroll automático
- [ ] Confirmar que se superpone correctamente
- [ ] Revisar consistencia visual con el proyecto

---

## 📚 **Referencias y Recursos**

### **Documentación Técnica**
- [MDN - ARIA Combobox Pattern](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/combobox_role)
- [W3C - Keyboard Navigation](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- [Tailwind CSS - Dropdown Components](https://tailwindui.com/components/application-ui/elements/dropdowns)

### **Herramientas de Testing**
- [axe-core](https://github.com/dequelabs/axe-core) - Testing de accesibilidad
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Performance y accesibilidad
- [WAVE](https://wave.webaim.org/) - Web Accessibility Evaluator

---

## 🔄 **Versionado**

- **Versión:** 1.0.0
- **Fecha:** Diciembre 2024
- **Autor:** Equipo de Desarrollo
- **Estado:** Activo

### **Changelog**
- **v1.0.0** - Establecimiento inicial de políticas de dropdown
- Implementación de scroll automático
- Definición de paleta de colores y tipografía
- Establecimiento de estándares de accesibilidad
- Creación de componentes React reutilizables

---

*Este documento debe ser actualizado cada vez que se modifiquen las políticas de dropdown o se agreguen nuevas funcionalidades.*
