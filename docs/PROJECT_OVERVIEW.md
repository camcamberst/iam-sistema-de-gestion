# 📚 Visión General del Proyecto (IAM Sistema de Gestión)

## 🎯 Objetivo

Plataforma interna de gestión para modelos, admins y super_admins con módulos de chat en tiempo real, asistente IA (AIM Botty), anticipos, analítica y gestión por roles/grupos.

## 🧩 Módulos Principales

- **Autenticación y Roles**: Supabase Auth, RLS y permisos por `role` y `groups`.
- **Chat en Tiempo Real**:
  - Ventana AIM Assistant (`components/chat/MainChatWindow.tsx`) y botón flotante (`components/chat/ChatWidget.tsx`).
  - Estado online con heartbeat, lista de usuarios ordenada y Botty primero.
  - Título del navegador y pestaña "Conversaciones" parpadean con mensajes sin leer.
  - Confirmación de borrado como overlay interno (sin alterar posicionamiento externo).
- **AIM Botty (IA - Google Gemini)**:
  - Procesamiento directo con fallback de modelos y respuestas cortas, cálidas.
  - Saludo solo en el primer mensaje por conversación.
  - Personalidades por rol y notificaciones automáticas.
- **Difusiones (Broadcast)**:
  - Envíos masivos por `admin/super_admin` como Botty, con límites jerárquicos.
  - Sin hilos individuales a receptores; resumen único para el emisor; `no_reply`.
- **Anticipos y Flujos Operativos**:
  - Scripts SQL y APIs relacionadas, con notificaciones del bot cuando aplica.

## 🏗️ Arquitectura Técnica

- **Frontend**: Next.js + React, Tailwind CSS, Portals para aislar botón/ventana del chat.
- **Backend**: API Routes (`app/api/*`), Supabase (DB y Realtime), validación por Bearer token en endpoints críticos.
- **Base de Datos**: Tablas de chat (`chat_conversations`, `chat_messages`), difusiones (`chat_broadcasts`, `chat_broadcast_targets`), triggers e índices.
- **Integraciones**: Google Gemini (`@google/generative-ai`).

## 🔌 Endpoints Clave

- `POST /api/chat/messages` – Enviar mensajes; detección de destinatario Botty; bloquea respuestas a difusión.
- `GET /api/chat/users` – Lista de usuarios: Botty primero, heartbeat >2m marca offline.
- `POST /api/chat/aim-botty` – Generación de respuesta IA.
- `POST /api/chat/broadcast` – Difusiones por rol/grupo/usuarios con validación jerárquica.

## 🧠 Lógica de Bot y Notificaciones

- `lib/chat/aim-botty.ts` – Identidad, personalidad por rol, helpers.
- `lib/chat/process-bot-response.ts` – Fallback de modelos, logging, saludo inicial único.
- `lib/chat/bot-notifications.ts` – Mensajes automáticos (anticipos, confirmaciones, metas, etc.).

## 🖥️ UX del Chat

- Ventana integrada al botón, renderizado via portal; posición externa intacta.
- Auto scroll abajo para continuidad.
- Pestaña "Conversaciones" con parpadeo + apertura automática una vez por mensaje nuevo.
- Sin sonidos de notificación.

## 🧾 Facturación

- Botty excluido explícitamente de resúmenes (filtro por ID/email en endpoints correspondientes).

## ⚙️ Scripts SQL Relevantes

- `scripts/create_chat_broadcasts.sql` – Tablas de difusión y columnas en `chat_messages`.
- `scripts/create-aim-botty-user.sql` – Usuario especial Botty (puede requerir `role='modelo'` por `CHECK`).

## 🧪 Depuración

- Logging detallado en generación IA y envío de mensajes.
- Modo fallback para modelos no disponibles (404) y claves inválidas.

## 📄 Documentos Relacionados

- `docs/AIM_BOTTY_IMPLEMENTATION.md` – Implementación detallada de Botty y chat.
- `CHANGELOG.md` – Cambios por versión (ver 1.4.0 para mejoras recientes).
