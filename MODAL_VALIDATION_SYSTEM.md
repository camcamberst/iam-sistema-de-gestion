# 🔒 Sistema de Validación de Modales

Este proyecto implementa un sistema automático de validación para asegurar que todos los modales sigan el estándar establecido usando el componente `StandardModal`.

## 📋 Componentes del Sistema

### 1. ESLint Rules (`.eslintrc.json`)
- **Regla principal**: Detecta modales manuales con `fixed inset-0`
- **Regla secundaria**: Advierte sobre z-index altos que podrían ser modales
- **Exclusión**: Permite el uso en `components/ui/StandardModal.tsx`

### 2. Scripts de Validación

#### Manual
```bash
npm run validate-modals
```

#### Automático (Pre-commit)
- Se ejecuta automáticamente antes de cada `git commit`
- Bloquea commits que contengan modales no estándar
- Archivo: `.git/hooks/pre-commit.ps1` (Windows)

### 3. Scripts PowerShell
- `scripts/validate-modals.ps1`: Validación manual completa
- `.git/hooks/pre-commit.ps1`: Hook de pre-commit

## 🚫 Qué Detecta

### ❌ Patrones Prohibidos
```tsx
// ❌ MALO - Modal manual
<div className="fixed inset-0 bg-black/50 z-50">
  <div className="modal-content">...</div>
</div>

// ❌ MALO - Z-index alto sin justificación
<div className="z-[99999]">...</div>
```

### ✅ Patrones Correctos
```tsx
// ✅ BUENO - Usando StandardModal
import StandardModal from 'components/ui/StandardModal';

<StandardModal isOpen={isOpen} onClose={onClose} title="Mi Modal">
  <div>Contenido del modal</div>
</StandardModal>
```

## 🔧 Configuración

### Para Desarrolladores
1. **Instalación automática**: Los hooks se configuran automáticamente
2. **Validación manual**: `npm run validate-modals`
3. **Bypass temporal**: `git commit --no-verify -m "mensaje"` (NO recomendado)

### Para CI/CD
```yaml
# Ejemplo para GitHub Actions
- name: Validate Modals
  run: npm run validate-modals
```

## 📖 Documentación Relacionada

- [UI_STANDARD_MODALS.md](./UI_STANDARD_MODALS.md) - Guía de uso del componente
- [components/ui/StandardModal.tsx](./components/ui/StandardModal.tsx) - Implementación

## 🛠️ Mantenimiento

### Actualizar Reglas
1. Editar `.eslintrc.json` para nuevas reglas
2. Actualizar scripts PowerShell si es necesario
3. Probar con `npm run validate-modals`

### Deshabilitar Temporalmente
```bash
# Para un commit específico
git commit --no-verify -m "mensaje"

# Para deshabilitar completamente (NO recomendado)
rm .git/hooks/pre-commit.ps1
```

## 🎯 Beneficios

- ✅ **Consistencia**: Todos los modales siguen el mismo patrón
- ✅ **UX Uniforme**: Animaciones y comportamientos estándar
- ✅ **Mantenibilidad**: Un solo componente para mantener
- ✅ **Prevención**: Errores detectados antes del commit
- ✅ **Documentación**: Estándar claro y documentado

---

**Nota**: Este sistema es parte del estándar de estética del proyecto y debe mantenerse actualizado con cualquier cambio en los componentes de UI.
