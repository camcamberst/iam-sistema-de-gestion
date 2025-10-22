# 📋 Políticas de Card Header - Estándar de Diseño

## 🎯 **Propósito**
Este documento establece las políticas y estándares para la implementación de Card Headers en el sistema, garantizando consistencia visual, jerarquía de información y experiencia de usuario óptima.

---

## 🎨 **Especificaciones Visuales**

### **Contenedor Principal**
```css
/* Contenedor del Card Header */
.card-header-container {
  background: rgba(255, 255, 255, 0.8); /* white/80 */
  backdrop-filter: blur(8px);
  border-radius: 0.75rem; /* 12px */
  padding: 1.5rem; /* 24px */
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  margin-bottom: 2.5rem; /* 40px */
}
```

### **Layout Principal**
```css
/* Layout flex del header */
.card-header-layout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
```

### **Sección Izquierda (Contenido Principal)**
```css
/* Contenedor del contenido principal */
.card-header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem; /* 12px */
}

/* Icono principal */
.card-header-icon {
  width: 2.5rem; /* 40px */
  height: 2.5rem; /* 40px */
  background: linear-gradient(135deg, #3b82f6, #4f46e5); /* from-blue-500 to-indigo-600 */
  border-radius: 0.75rem; /* 12px */
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* SVG dentro del icono */
.card-header-icon svg {
  width: 1.25rem; /* 20px */
  height: 1.25rem; /* 20px */
  color: white;
}

/* Contenedor de texto */
.card-header-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem; /* 4px */
}
```

### **Título Principal**
```css
/* Título principal del header */
.card-header-title {
  font-size: 1.5rem; /* 24px */
  font-weight: 600; /* semibold */
  color: #111827; /* gray-900 */
  line-height: 1.25;
  margin: 0;
}
```

### **Descripción/Subtítulo**
```css
/* Descripción contextual */
.card-header-description {
  font-size: 0.875rem; /* 14px */
  color: #4b5563; /* gray-600 */
  line-height: 1.25;
  margin: 0;
  margin-top: 0.25rem; /* 4px */
}
```

### **Sección Derecha (Metadatos)**
```css
/* Contenedor de metadatos */
.card-header-meta {
  display: flex;
  align-items: center;
  font-size: 0.875rem; /* 14px */
  color: #6b7280; /* gray-500 */
}

/* Texto de acceso */
.card-header-access-label {
  color: #6b7280; /* gray-500 */
  margin-right: 0.25rem; /* 4px */
}

/* Valor de acceso */
.card-header-access-value {
  font-weight: 500; /* medium */
  color: #2563eb; /* blue-600 */
}
```

---

## 🔧 **Especificaciones Técnicas**

### **Dimensiones**
- **Altura del icono:** 40px (2.5rem)
- **Ancho del icono:** 40px (2.5rem)
- **Padding del contenedor:** 24px (1.5rem)
- **Gap entre elementos:** 12px (0.75rem)
- **Border radius:** 12px (0.75rem)

### **Espaciado**
- **Margen inferior:** 40px (2.5rem)
- **Gap interno:** 12px (0.75rem)
- **Gap de texto:** 4px (0.25rem)

### **Z-Index y Capas**
- **Contenedor:** z-index: 1 (por defecto)
- **Backdrop blur:** 8px
- **Sombra:** 0 10px 15px -3px rgba(0, 0, 0, 0.1)

---

## 🎨 **Especificaciones de Color**

### **Paleta de Colores**
```css
/* Colores principales */
--card-header-bg: rgba(255, 255, 255, 0.8);
--card-header-border: rgba(255, 255, 255, 0.2);
--card-header-icon-bg: linear-gradient(135deg, #3b82f6, #4f46e5);
--card-header-icon-svg: white;
--card-header-title: #111827; /* gray-900 */
--card-header-description: #4b5563; /* gray-600 */
--card-header-meta: #6b7280; /* gray-500 */
--card-header-access-value: #2563eb; /* blue-600 */
```

### **Gradientes**
- **Icono:** `from-blue-500 to-indigo-600`
- **Dirección:** 135deg (diagonal)
- **Colores:** #3b82f6 → #4f46e5

---

## 📏 **Especificaciones de Tipografía**

### **Jerarquía de Texto**
```css
/* Título principal */
.card-header-title {
  font-size: 1.5rem; /* 24px */
  font-weight: 600; /* semibold */
  line-height: 1.25;
}

/* Descripción */
.card-header-description {
  font-size: 0.875rem; /* 14px */
  font-weight: 400; /* normal */
  line-height: 1.25;
}

/* Metadatos */
.card-header-meta {
  font-size: 0.875rem; /* 14px */
  font-weight: 400; /* normal */
  line-height: 1.25;
}

/* Valor de acceso */
.card-header-access-value {
  font-size: 0.875rem; /* 14px */
  font-weight: 500; /* medium */
  line-height: 1.25;
}
```

### **Fuentes**
- **Familia:** `Inter, system-ui, sans-serif` (por defecto del proyecto)
- **Fallback:** `system-ui, sans-serif`

---

## 🎯 **Variantes de Card Header**

### **1. Header Básico**
```jsx
<div className="card-header-container">
  <div className="card-header-layout">
    <div className="card-header-content">
      <div className="card-header-icon">
        <svg>...</svg>
      </div>
      <div className="card-header-text">
        <h1 className="card-header-title">Título</h1>
        <p className="card-header-description">Descripción</p>
      </div>
    </div>
  </div>
</div>
```

### **2. Header con Metadatos**
```jsx
<div className="card-header-container">
  <div className="card-header-layout">
    <div className="card-header-content">
      <div className="card-header-icon">
        <svg>...</svg>
      </div>
      <div className="card-header-text">
        <h1 className="card-header-title">Título</h1>
        <p className="card-header-description">Descripción</p>
      </div>
    </div>
    <div className="card-header-meta">
      <span className="card-header-access-label">Acceso:</span>
      <span className="card-header-access-value">Admin</span>
    </div>
  </div>
</div>
```

### **3. Header con Acciones**
```jsx
<div className="card-header-container">
  <div className="card-header-layout">
    <div className="card-header-content">
      <div className="card-header-icon">
        <svg>...</svg>
      </div>
      <div className="card-header-text">
        <h1 className="card-header-title">Título</h1>
        <p className="card-header-description">Descripción</p>
      </div>
    </div>
    <div className="card-header-actions">
      <button className="btn-primary">Acción</button>
    </div>
  </div>
</div>
```

---

## 🚀 **Implementación en React**

### **Componente Base**
```typescript
interface CardHeaderProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  meta?: {
    label: string;
    value: string;
    valueColor?: string;
  };
  actions?: React.ReactNode;
  className?: string;
}

export function CardHeader({ 
  icon, 
  title, 
  description, 
  meta, 
  actions, 
  className = '' 
}: CardHeaderProps) {
  return (
    <div className={`card-header-container ${className}`}>
      <div className="card-header-layout">
        <div className="card-header-content">
          <div className="card-header-icon">
            {icon}
          </div>
          <div className="card-header-text">
            <h1 className="card-header-title">{title}</h1>
            {description && (
              <p className="card-header-description">{description}</p>
            )}
          </div>
        </div>
        
        {meta && (
          <div className="card-header-meta">
            <span className="card-header-access-label">{meta.label}</span>
            <span 
              className="card-header-access-value"
              style={{ color: meta.valueColor || '#2563eb' }}
            >
              {meta.value}
            </span>
          </div>
        )}
        
        {actions && (
          <div className="card-header-actions">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
```

### **Uso del Componente**
```typescript
// Ejemplo básico
<CardHeader
  icon={<DollarIcon />}
  title="Definir RATES"
  description="Solo puedes gestionar RATES de tus grupos asignados"
/>

// Ejemplo con metadatos
<CardHeader
  icon={<DollarIcon />}
  title="Definir RATES"
  description="Solo puedes gestionar RATES de tus grupos asignados"
  meta={{
    label: "Acceso:",
    value: "Admin",
    valueColor: "#2563eb"
  }}
/>

// Ejemplo con acciones
<CardHeader
  icon={<DollarIcon />}
  title="Definir RATES"
  description="Solo puedes gestionar RATES de tus grupos asignados"
  actions={
    <button className="btn-primary">
      Configurar
    </button>
  }
/>
```

---

## 📱 **Responsive Design**

### **Breakpoints**
```css
/* Mobile (hasta 640px) */
@media (max-width: 640px) {
  .card-header-container {
    padding: 1rem; /* 16px */
    margin-bottom: 1.5rem; /* 24px */
  }
  
  .card-header-layout {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem; /* 16px */
  }
  
  .card-header-title {
    font-size: 1.25rem; /* 20px */
  }
  
  .card-header-icon {
    width: 2rem; /* 32px */
    height: 2rem; /* 32px */
  }
}

/* Tablet (641px - 1024px) */
@media (min-width: 641px) and (max-width: 1024px) {
  .card-header-container {
    padding: 1.25rem; /* 20px */
  }
  
  .card-header-title {
    font-size: 1.375rem; /* 22px */
  }
}

/* Desktop (1025px+) */
@media (min-width: 1025px) {
  .card-header-container {
    padding: 1.5rem; /* 24px */
  }
  
  .card-header-title {
    font-size: 1.5rem; /* 24px */
  }
}
```

---

## 🎨 **Iconos Recomendados**

### **Iconos SVG Estándar**
```typescript
// Icono de dinero/tasas
const DollarIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
  </svg>
);

// Icono de configuración
const ConfigIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// Icono de usuario
const UserIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
```

---

## ♿ **Accesibilidad**

### **Atributos ARIA**
```html
<div class="card-header-container" role="banner">
  <div class="card-header-layout">
    <div class="card-header-content">
      <div class="card-header-icon" aria-hidden="true">
        <svg>...</svg>
      </div>
      <div class="card-header-text">
        <h1 class="card-header-title" id="page-title">Título</h1>
        <p class="card-header-description" aria-describedby="page-title">
          Descripción
        </p>
      </div>
    </div>
    <div class="card-header-meta" aria-label="Información de acceso">
      <span class="card-header-access-label">Acceso:</span>
      <span class="card-header-access-value" aria-label="Nivel de acceso: Admin">
        Admin
      </span>
    </div>
  </div>
</div>
```

### **Navegación por Teclado**
- **Tab:** Navegar entre elementos interactivos
- **Enter/Space:** Activar botones de acción
- **Escape:** Cerrar modales o dropdowns

---

## ✅ **Checklist de Implementación**

### **Antes de Implementar**
- [ ] Verificar que el contenedor tenga suficiente espacio (40px margen inferior)
- [ ] Configurar icono con gradiente azul-índigo
- [ ] Definir título y descripción apropiados
- [ ] Planificar metadatos necesarios

### **Durante la Implementación**
- [ ] Usar colores de la paleta establecida
- [ ] Aplicar tipografía consistente
- [ ] Implementar layout flex responsivo
- [ ] Agregar atributos ARIA para accesibilidad
- [ ] Configurar glassmorphism y backdrop blur

### **Después de Implementar**
- [ ] Probar en diferentes dispositivos
- [ ] Verificar accesibilidad con lectores de pantalla
- [ ] Validar jerarquía visual clara
- [ ] Confirmar consistencia con el proyecto
- [ ] Revisar legibilidad del texto

---

## 📚 **Referencias y Recursos**

### **Documentación Técnica**
- [MDN - CSS Backdrop Filter](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter)
- [Tailwind CSS - Glassmorphism](https://tailwindcss.com/docs/backdrop-blur)
- [Material Design - Cards](https://material.io/components/cards)

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
- **v1.0.0** - Establecimiento inicial de políticas de Card Header
- Implementación de glassmorphism y backdrop blur
- Definición de paleta de colores y tipografía
- Establecimiento de estándares de accesibilidad
- Creación de componentes React reutilizables
- Documentación de responsive design

---

*Este documento debe ser actualizado cada vez que se modifiquen las políticas de Card Header o se agreguen nuevas funcionalidades.*
