Estándar de Modales - Sistema de Gestión AIM

Principios
- Accesibilidad: cierre con tecla ESC, foco contenido, aria-modal/role.
- UX consistente: backdrop con transición de opacidad y blur suave.
- Animaciones: entrada con opacity + scale (200ms ease-out).
- Interacción: clic en backdrop cierra (configurable), evitar burbujeo interior.

Componente estándar
- Archivo: `components/ui/StandardModal.tsx`
- Props clave: `isOpen`, `onClose`, `title`, `maxWidthClass`, `showCloseButton`, `closeOnBackdrop`.
- Uso básico:
```tsx
<StandardModal isOpen={open} onClose={onClose} title="Título" maxWidthClass="max-w-lg">
  {...contenido}
  <div className="flex justify-end space-x-2 mt-6">
    <button onClick={onClose}>Cancelar</button>
    <button type="submit">Confirmar</button>
  </div>
  </StandardModal>
```

Aplicación
- Reemplazar modales manuales existentes por `StandardModal` progresivamente.
- Mantener estilos compactos: botones `text-sm py-2` y inputs `py-2.5`.
- Asegurar z-index de paneles detrás ≤ `z-10` cuando el modal esté activo.

Checklist al crear un modal
- Usa `StandardModal`.
- Provee `onClose` y decide si `closeOnBackdrop` debe habilitarse.
- No dejes elementos con z-index alto compitiendo con el overlay.
- Testea ESC, backdrop y animaciones.


