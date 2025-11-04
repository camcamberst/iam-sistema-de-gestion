# 📌 PROPUESTA: CORCHO INFORMATIVO (Sistema de Publicaciones)

## 🎯 Objetivo
Implementar un sistema de tablón de anuncios digital tipo blog/revista para mantener informadas a las modelos con información relevante, permitiendo a super admins y admins crear publicaciones dirigidas a grupos específicos o generales.

---

## 🏗️ ARQUITECTURA PROPUESTA

### 1. **Base de Datos**

#### Tabla: `announcement_categories` (Categorías/Secciones)
```sql
CREATE TABLE announcement_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- "Noticias", "Recordatorios", "Promociones", etc.
  slug TEXT NOT NULL UNIQUE,              -- "noticias", "recordatorios", "promociones"
  icon TEXT,                             -- Nombre del icono SVG o emoji
  color TEXT DEFAULT '#3B82F6',          -- Color de la categoría (hex)
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Tabla: `announcements` (Publicaciones)
```sql
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  category_id UUID REFERENCES announcement_categories(id) ON DELETE SET NULL,
  
  -- Contenido
  title TEXT NOT NULL,
  content TEXT NOT NULL,                 -- Contenido en Markdown o HTML
  excerpt TEXT,                           -- Resumen corto para preview
  
  -- Imágenes y multimedia
  featured_image_url TEXT,                -- URL de imagen destacada (Supabase Storage)
  image_urls JSONB DEFAULT '[]',          -- Array de URLs de imágenes adicionales
  
  -- Distribución
  is_general BOOLEAN DEFAULT false,       -- true = todos los grupos, false = grupos específicos
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Estado
  is_published BOOLEAN DEFAULT false,     -- Borrador vs Publicado
  is_pinned BOOLEAN DEFAULT false,        -- Fijar en la parte superior
  priority INTEGER DEFAULT 0,             -- 0=normal, 1=alta, 2=urgente
  
  -- Metadatos
  views_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,               -- Fecha de publicación
  expires_at TIMESTAMPTZ,                 -- Fecha de expiración (opcional)
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Tabla: `announcement_group_targets` (Relación Publicación-Grupo N:M)
```sql
CREATE TABLE announcement_group_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(announcement_id, group_id)
);
```

#### Tabla: `announcement_views` (Tracking de visualizaciones - opcional)
```sql
CREATE TABLE announcement_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);
```

#### RLS (Row Level Security)
```sql
-- Las modelos solo pueden leer publicaciones dirigidas a sus grupos
-- Los admins pueden leer/crear/editar publicaciones de sus grupos
-- Los super_admins tienen acceso completo

-- Policy: Lectura para modelos
CREATE POLICY "modelos_lectura_announcements"
  ON announcements FOR SELECT
  USING (
    -- Usuario autenticado
    auth.uid() IS NOT NULL
    AND (
      -- Si es general, todos pueden ver
      is_general = true
      OR
      -- Si es específico, verificar que el usuario pertenece a algún grupo objetivo
      EXISTS (
        SELECT 1 FROM user_groups ug
        INNER JOIN announcement_group_targets agt ON ug.group_id = agt.group_id
        WHERE ug.user_id = auth.uid()
        AND agt.announcement_id = announcements.id
      )
    )
    AND is_published = true
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Policy: Crear publicaciones (admins y super_admins)
CREATE POLICY "admins_crear_announcements"
  ON announcements FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- Similar para UPDATE y DELETE...
```

#### Supabase Storage Bucket
```sql
-- Crear bucket para imágenes de anuncios
INSERT INTO storage.buckets (id, name, public) VALUES ('announcement-images', 'announcement-images', true);
```

---

### 2. **API Routes**

#### `app/api/announcements/route.ts`
- **GET**: Obtener publicaciones según usuario/grupos
  - Query params: `?category=slug&limit=10&offset=0`
  - Retorna publicaciones visibles para el usuario actual
  
- **POST**: Crear publicación (solo super_admin/admin)
  - Body: `{ title, content, category_id, is_general, group_ids[], featured_image_url, ... }`

#### `app/api/announcements/[id]/route.ts`
- **GET**: Obtener publicación individual
- **PUT**: Editar publicación (solo autor o super_admin)
- **DELETE**: Eliminar publicación (solo autor o super_admin)

#### `app/api/announcements/upload-image/route.ts`
- **POST**: Subir imagen a Supabase Storage
  - Retorna URL pública de la imagen

#### `app/api/announcements/categories/route.ts`
- **GET**: Obtener todas las categorías activas

---

### 3. **Componentes Frontend**

#### `components/AnnouncementBoard.tsx` (Panel principal en dashboard)
- Feed estilo blog/magazine con:
  - Publicaciones fijadas (pinned) al inicio
  - Filtros por categoría (chips)
  - Cards de publicaciones con:
    - Imagen destacada (si existe)
    - Título y excerpt
    - Categoría con badge de color
    - Fecha de publicación
    - Botón "Leer más"
  - Paginación o scroll infinito
  - Indicador de "nuevo" para publicaciones no vistas

#### `components/AnnouncementCard.tsx` (Card individual)
- Preview de publicación con imagen, título, excerpt
- Badge de categoría
- Indicador de prioridad (si es alta/urgente)
- Timestamp relativo ("hace 2 horas")

#### `components/AnnouncementModal.tsx` (Modal de lectura completa)
- Vista completa de la publicación
- Imágenes en galería
- Contenido renderizado (Markdown → HTML)
- Botones de navegación (anterior/siguiente)

#### Integración en "Dashboard Sedes" (`app/admin/sedes/dashboard/page.tsx`)
- Sección nueva: "Corcho Informativo" / "Gestión de Publicaciones"
- Lista de todas las publicaciones (borradores y publicadas)
- Filtros por estado, categoría, grupo
- Botón "Crear nueva publicación" (modal o página dedicada)
- Acciones: Editar, Publicar, Fijar, Eliminar
- Editor de publicaciones (modal o inline):
  - Título
  - Categoría (select)
  - Contenido (editor WYSIWYG o Markdown)
  - Subir imagen destacada
  - Subir imágenes adicionales
  - Selector de grupos (checkbox múltiple) o toggle "General"
  - Toggle "Publicar ahora" o "Guardar como borrador"
  - Toggle "Fijar en la parte superior"
  - Fecha de expiración (opcional)
  - Prioridad (normal/alta/urgente)
- Preview en tiempo real
- Validación antes de guardar

---

### 4. **Integración en Dashboard de Modelos**

**Ubicación**: `app/admin/model/dashboard/page.tsx`

Insertar widget de visualización (no edición, solo lectura):

```tsx
{/* Corcho Informativo - Widget */}
<div className="mt-6">
  <AnnouncementBoardWidget userId={user.id} userGroups={user.groups} />
</div>
```

**Widget de visualización**:
- Muestra las últimas 3-5 publicaciones relevantes
- Filtro rápido por categoría
- Botón "Ver todas" que abre modal con todas las publicaciones
- Cards compactas con preview

---

### 5. **Características Adicionales**

#### Editor de Contenido
- **Opción 1**: Editor Markdown simple con preview
  - Usar librería: `react-markdown` + `react-syntax-highlighter`
- **Opción 2**: Editor WYSIWYG
  - Usar: `react-quill` o `tiptap`
  - Permite formato rico: negrita, cursiva, listas, enlaces, imágenes inline

#### Filtros y Búsqueda
- Filtro por categoría (chips)
- Búsqueda por título/contenido
- Ordenar por: Más reciente, Más visto, Prioridad

#### Notificaciones (Futuro)
- Notificar a modelos cuando hay nueva publicación en sus grupos
- Badge de "nuevas publicaciones" en el dashboard

---

### 6. **Flujo de Usuario**

#### Super Admin / Admin:
1. Accede a `/admin/announcements`
2. Clic en "Crear nueva publicación"
3. Completa formulario:
   - Título, contenido, categoría
   - Sube imágenes
   - Selecciona grupos objetivo o marca "General"
   - Configura estado (publicar ahora o borrador)
4. Guarda → Publicación visible en dashboards de modelos

#### Modelo:
1. Accede a su dashboard (`/admin/model/dashboard`)
2. Ve el módulo "Corcho Informativo" con publicaciones relevantes
3. Filtra por categoría si lo desea
4. Clic en "Leer más" → Abre modal con contenido completo
5. Visualiza imágenes en galería

---

### 7. **Diseño Visual**

#### Estilo Magazine/Blog
- Cards con sombra suave, bordes redondeados
- Imágenes con aspect-ratio 16:9
- Tipografía clara: título grande, contenido legible
- Colores por categoría (badges)
- Animaciones sutiles (hover, fade-in)

#### Responsive
- Mobile: 1 columna
- Tablet: 2 columnas
- Desktop: 3 columnas

---

### 8. **Plan de Implementación**

#### Fase 1: Base de Datos y API (1-2 días)
- [ ] Crear tablas SQL
- [ ] Configurar RLS
- [ ] Crear bucket de Storage
- [ ] Implementar API routes básicas (GET, POST)

#### Fase 2: Componentes de Visualización (2-3 días)
- [ ] `AnnouncementBoard` component
- [ ] `AnnouncementCard` component
- [ ] `AnnouncementModal` component
- [ ] Integrar en dashboard de modelos

#### Fase 3: Panel de Administración (2-3 días)
- [ ] Página de listado de publicaciones
- [ ] Editor de creación/edición
- [ ] Upload de imágenes
- [ ] Validaciones y manejo de errores

#### Fase 4: Mejoras y Pulido (1-2 días)
- [ ] Filtros y búsqueda
- [ ] Tracking de visualizaciones
- [ ] Ajustes visuales
- [ ] Testing completo

**Total estimado: 6-10 días de desarrollo**

---

## 📋 Checklist de Aceptación

- [ ] Super Admin puede crear publicaciones generales
- [ ] Super Admin puede crear publicaciones por grupo
- [ ] Admin puede crear publicaciones para sus grupos
- [ ] Admin NO puede crear publicaciones generales
- [ ] Modelo solo puede visualizar
- [ ] Las publicaciones se muestran correctamente según grupos
- [ ] Las imágenes se suben y muestran correctamente
- [ ] El editor de contenido funciona bien
- [ ] Las publicaciones fijadas aparecen primero
- [ ] Las publicaciones expiradas no se muestran
- [ ] El diseño es responsive
- [ ] El diseño es consistente con el proyecto

---

## 🎨 Ejemplo Visual

```
┌─────────────────────────────────────────────────────────┐
│  📌 CORCHO INFORMATIVO                    [Filtrar por] │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────┐  ┌─────────────────┐                │
│  │ [PINNED] 🔴     │  │ 📰 Noticias     │                │
│  │                 │  │                 │                │
│  │ [Imagen]        │  │ [Imagen]        │                │
│  │ Título          │  │ Título          │                │
│  │ Resumen...      │  │ Resumen...      │                │
│  │ [Leer más]      │  │ [Leer más]      │                │
│  └─────────────────┘  └─────────────────┘                │
│                                                           │
│  ┌─────────────────┐  ┌─────────────────┐                │
│  │ 💡 Tips         │  │ 📢 Promociones  │                │
│  │ ...            │  │ ...            │                │
│  └─────────────────┘  └─────────────────┘                │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

¿Te parece bien esta propuesta? ¿Quieres que ajuste algo antes de comenzar la implementación?

