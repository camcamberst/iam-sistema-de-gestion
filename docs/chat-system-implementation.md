# 📱 Sistema de Chat Bidireccional - AIM
## Documentación Completa de Implementación

**Fecha de Implementación**: Diciembre 2024  
**Versión**: 1.0  
**Estado**: ✅ Completado y Desplegado

---

## 🎯 **Resumen Ejecutivo**

Se implementó un sistema completo de chat bidireccional para el sistema AIM que permite comunicación en tiempo real entre modelos, administradores y super administradores, con notificaciones avanzadas y gestión de estado basada en autenticación.

---

## 🏗️ **Arquitectura del Sistema**

### **Componentes Principales**
1. **Base de Datos**: 4 tablas nuevas en Supabase
2. **API Backend**: 3 endpoints REST para gestión de chat
3. **Frontend**: Componente `ChatWidget` integrado en todos los layouts
4. **Tiempo Real**: Suscripciones Supabase Realtime
5. **Notificaciones**: Sistema de sonidos y alertas visuales
6. **Gestión de Estado**: Sistema basado en login/logout

---

## 🗄️ **Base de Datos**

### **Tablas Creadas**

#### 1. `chat_conversations`
```sql
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  conversation_type VARCHAR(20) DEFAULT 'direct',
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(participant_1_id, participant_2_id)
);
```

#### 2. `chat_messages`
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);
```

#### 3. `chat_support_queries`
```sql
CREATE TABLE chat_support_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_type VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'open',
  ai_response TEXT,
  admin_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);
```

#### 4. `chat_user_status`
```sql
CREATE TABLE chat_user_status (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  status_message VARCHAR(100),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Índices y Optimizaciones**
- Índices en `participant_1_id`, `participant_2_id`, `last_message_at`
- Índices en `conversation_id`, `sender_id`, `created_at`
- Índices en `user_id`, `status`, `is_online`

### **Triggers Automáticos**
- **`update_conversation_last_message()`**: Actualiza `last_message_at` al insertar mensajes
- **`update_updated_at_column()`**: Actualiza timestamps automáticamente

### **Row Level Security (RLS)**
- Políticas de seguridad para cada tabla
- Acceso basado en participación en conversaciones
- Permisos especiales para super administradores

---

## 🔌 **API Endpoints**

### **1. `/api/chat/conversations`**
- **GET**: Listar conversaciones del usuario
- **POST**: Crear nueva conversación
- **Autenticación**: Bearer token (Supabase)

### **2. `/api/chat/messages`**
- **GET**: Obtener mensajes de una conversación
- **POST**: Enviar nuevo mensaje
- **Autenticación**: Bearer token (Supabase)

### **3. `/api/chat/users`**
- **GET**: Listar usuarios disponibles para chat
- **POST**: Actualizar estado del usuario
- **Autenticación**: Bearer token (Supabase)

### **Características de Seguridad**
- Validación de permisos por rol y grupo
- Verificación de participación en conversaciones
- Uso de `SUPABASE_SERVICE_ROLE_KEY` para operaciones del servidor

---

## 🎨 **Interfaz de Usuario**

### **ChatWidget Component**
**Ubicación**: `components/chat/ChatWidget.tsx`

#### **Características Visuales**
- **Botón flotante**: Cuadrado redondeado con "A" (miniatura) y "AIM" (hover)
- **Posición**: Esquina inferior derecha, alineado con el borde
- **Tamaño**: 40x40px (miniatura) → 64x40px (expandido)
- **Espaciado**: 24px del borde para evitar solapamiento

#### **Ventana de Chat**
- **Dimensiones**: 320x500px
- **Posición**: Al lado del botón, alineada con el borde inferior
- **Diseño**: Tema oscuro con bordes redondeados
- **Header**: Logo AIM, título "AIM Assistant", botones de control

#### **Lista de Usuarios**
- **Secciones colapsables**: "En línea" (expandida) y "Offline" (contraída)
- **Indicadores visuales**: Puntos de color verde/gris
- **Información**: Nombre, rol, estado en tiempo real
- **Contador**: Número de usuarios en cada sección

#### **Área de Mensajes**
- **Burbujas diferenciadas**: Azul (propios) vs Gris (recibidos)
- **Timestamps**: Hora de envío en cada mensaje
- **Auto-scroll**: Desplazamiento automático a mensajes nuevos
- **Responsive**: Adaptable a diferentes tamaños de pantalla

---

## 🔊 **Sistema de Notificaciones**

### **Sonido de Notificación**
**Nombre**: "N Dinámico"  
**Patrón**: 400Hz → 600Hz → 800Hz → 1000Hz → 1200Hz → 1000Hz → 800Hz → 600Hz → 400Hz → 600Hz → 800Hz → 1000Hz → 1200Hz  
**Duración**: 0.5 segundos  
**Tecnología**: Web Audio API (sin archivos externos)

### **Alertas Visuales**
- **Indicador parpadeante**: Botón del chat parpadea en azul por 3 segundos
- **Contador de mensajes**: Badge rojo con número de conversaciones no leídas
- **Apertura automática**: Chat se abre automáticamente al recibir mensajes

### **Tiempo Real**
- **Suscripción**: `postgres_changes` en tabla `chat_messages`
- **Filtrado**: Solo notifica mensajes de otros usuarios
- **Actualización**: Recarga automática de conversaciones y mensajes

---

## 🔐 **Sistema de Permisos**

### **Reglas de Comunicación**
1. **Modelos**: Pueden chatear con admins de su grupo
2. **Admins**: Pueden chatear con modelos de su grupo y otros admins
3. **Super Admins**: Pueden chatear con cualquier usuario
4. **Restricciones**: Solo super admins pueden iniciar chats con cualquier usuario

### **Validación de Permisos**
**Archivo**: `lib/chat/permissions.ts`
- Verificación de roles y grupos
- Validación de jerarquías organizacionales
- Control de acceso a conversaciones

---

## 📊 **Gestión de Estado**

### **Sistema Basado en Login/Logout**
**Archivo**: `lib/chat/status-manager.ts`

#### **Funciones Principales**
- **`setUserOnline(userId)`**: Marca usuario como en línea
- **`setUserOffline(userId)`**: Marca usuario como offline
- **`updateChatStatus(userId, isOnline)`**: Función base de actualización
- **`cleanupInactiveUsers()`**: Limpieza de usuarios inactivos

#### **Integración con Autenticación**
**Archivo**: `lib/auth-modern.ts`
- **Login**: Automáticamente marca como "en línea"
- **Logout**: Automáticamente marca como "offline"
- **Manejo de errores**: No falla autenticación por problemas de chat

#### **Comportamiento**
- ✅ **En línea**: Al hacer login en el sistema AIM
- ❌ **Offline**: Al hacer logout del sistema AIM
- 🗑️ **Sin heartbeat**: Eliminado sistema de actualizaciones constantes

---

## 🚀 **Integración en Layouts**

### **Model Layout** (`app/model/layout.tsx`)
```typescript
{userInfo && userInfo.role === 'modelo' && (
  <ChatWidget userId={userInfo.id} userRole={userInfo.role} />
)}
```

### **Admin Layout** (`app/admin/layout.tsx`)
```typescript
{userInfo && (userInfo.role === 'admin' || userInfo.role === 'super_admin' || userInfo.role === 'modelo') && (
  <ChatWidget userId={userInfo.id} userRole={userInfo.role} />
)}
```

### **Super Admin Layout** (`app/superadmin/layout.tsx`)
```typescript
{userInfo && userInfo.role === 'super_admin' && (
  <ChatWidget userId={userInfo.id} userRole={userInfo.role} />
)}
```

---

## 🧪 **Testing y Validación**

### **Funcionalidades Probadas**
- ✅ Creación de conversaciones
- ✅ Envío y recepción de mensajes
- ✅ Notificaciones en tiempo real
- ✅ Sonidos de alerta
- ✅ Indicadores visuales
- ✅ Estado en línea/offline
- ✅ Permisos por rol
- ✅ Integración en todos los layouts

### **Casos de Uso Validados**
1. **Modelo → Admin**: Comunicación exitosa
2. **Admin → Modelo**: Comunicación exitosa
3. **Super Admin → Cualquiera**: Comunicación exitosa
4. **Notificaciones**: Sonido + parpadeo + apertura automática
5. **Estado**: Login = En línea, Logout = Offline

---

## 📈 **Métricas y Rendimiento**

### **Optimizaciones Implementadas**
- **Índices de base de datos**: Consultas optimizadas
- **Paginación**: Carga eficiente de mensajes
- **Lazy loading**: Componentes cargados bajo demanda
- **Debouncing**: Actualizaciones controladas de estado
- **Cleanup**: Limpieza automática de recursos

### **Escalabilidad**
- **Supabase Realtime**: Soporte para miles de usuarios concurrentes
- **Row Level Security**: Seguridad a nivel de fila
- **Índices optimizados**: Consultas rápidas incluso con grandes volúmenes
- **Arquitectura modular**: Fácil mantenimiento y extensión

---

## 🔧 **Configuración y Deployment**

### **Variables de Entorno Requeridas**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### **Scripts de Base de Datos**
- **`create_chat_system_tables.sql`**: Creación completa de tablas
- **`create_chat_tables_production.js`**: Script de producción
- **`verify_chat_tables.js`**: Verificación de instalación

### **Deployment Status**
- ✅ **Commit**: `02da658` - Sistema completo implementado
- ✅ **Vercel**: Desplegado automáticamente
- ✅ **Producción**: Funcionando en https://iam-sistema-de-gestion.vercel.app

---

## 🎯 **Funcionalidades Futuras (Roadmap)**

### **Fase 2 - Mejoras Planificadas**
- [ ] **Consultas de soporte AI**: Integración con IA para consultas técnicas
- [ ] **Archivos adjuntos**: Soporte para imágenes y documentos
- [ ] **Emojis**: Selector de emojis integrado
- [ ] **Notificaciones push**: Alertas del navegador
- [ ] **Historial de chat**: Búsqueda y filtrado de mensajes
- [ ] **Temas personalizables**: Diferentes estilos visuales

### **Fase 3 - Funcionalidades Avanzadas**
- [ ] **Chat grupal**: Conversaciones con múltiples participantes
- [ ] **Videollamadas**: Integración con WebRTC
- [ ] **Grabación de audio**: Mensajes de voz
- [ ] **Traducción automática**: Soporte multiidioma
- [ ] **Analytics**: Métricas de uso y engagement

---

## 📚 **Documentación Técnica**

### **Archivos Principales**
```
components/chat/ChatWidget.tsx          # Componente principal del chat
lib/chat/permissions.ts                 # Sistema de permisos
lib/chat/status-manager.ts              # Gestión de estado
app/api/chat/conversations/route.ts     # API de conversaciones
app/api/chat/messages/route.ts          # API de mensajes
app/api/chat/users/route.ts             # API de usuarios
create_chat_system_tables.sql           # Script de base de datos
```

### **Dependencias**
- **Supabase**: Base de datos y autenticación
- **Next.js**: Framework de React
- **TypeScript**: Tipado estático
- **Tailwind CSS**: Estilos y diseño
- **Web Audio API**: Generación de sonidos

---

## 🎉 **Conclusión**

El sistema de chat bidireccional ha sido implementado exitosamente con todas las funcionalidades solicitadas:

- ✅ **Comunicación bidireccional** entre todos los roles
- ✅ **Notificaciones avanzadas** con sonido "N Dinámico"
- ✅ **Estado en línea/offline** basado en autenticación
- ✅ **Interfaz moderna** y responsive
- ✅ **Seguridad robusta** con RLS y permisos
- ✅ **Tiempo real** con Supabase Realtime
- ✅ **Integración completa** en todos los layouts

El sistema está **listo para producción** y funcionando en el entorno de Vercel. Los usuarios pueden comunicarse de manera eficiente y recibir notificaciones inmediatas de nuevos mensajes.

---

**Desarrollado por**: AI Assistant  
**Fecha**: Diciembre 2024  
**Versión**: 1.0  
**Estado**: ✅ Completado
