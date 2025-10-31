# 🚀 Notas de Versión 1.4.0 (2025-10-31)

## Resumen
Lanzamiento centrado en mejoras del chat, AIM Botty y sistema de difusiones, con énfasis en UX, robustez de IA y limpieza de documentación.

## Novedades
- Difusiones: `POST /api/chat/broadcast` para `admin/super_admin` con límites jerárquicos.
- Resumen de difusión para el emisor con chip "Difusión"; sin hilos individuales para receptores.
- Bloqueo de respuestas a mensajes de difusión (`no_reply`).

## Mejoras de UX
- Ventana AIM no cambia su posicionamiento; confirmación de borrado como overlay interno dentro de la conversación.
- Pestaña "Conversaciones" parpadea ante mensajes sin leer; apertura automática de la ventana una sola vez.
- Título del navegador parpadea en presencia de mensajes no leídos.
- Scroll del chat anclado al fondo por defecto para continuidad.
- Sonidos de notificación desactivados completamente.
- Botty siempre primero en la lista de usuarios online.

## AIM Botty (IA)
- Procesamiento directo con `lib/chat/process-bot-response.ts` y fallback de modelos (secuencia múltiple).
- Respuestas más cortas y tono cercano; saludo solo en el primer mensaje por conversación.
- Ajuste a `gemini-pro` donde aplica y manejo de errores 404/credenciales.

## Backend y DB
- `scripts/create_chat_broadcasts.sql`: `chat_broadcasts`, `chat_broadcast_targets` y columnas en `chat_messages` (`is_broadcast`, `broadcast_id`, `no_reply`, `metadata`).
- `app/api/chat/users/route.ts`: Heartbeat >2m para offline, Botty incluido/ordenado primero.
- `app/api/chat/messages/route.ts`: Detección de Botty y bloqueo de respuesta a difusión, logging.

## Documentación
- `docs/AIM_BOTTY_IMPLEMENTATION.md`: Actualizado con fallback de modelos, difusiones y UX del chat.
- `CHANGELOG.md`: Entrada 1.4.0.
- `README.md`: Removidas referencias a n8n; descripción del proyecto y guías actualizadas.
- `docs/PROJECT_OVERVIEW.md`: Resumen técnico y funcional del sistema.

## Consideraciones
- Botty excluido de resúmenes de facturación por ID/email.
- Si la DB restringe `role='bot'`, usar `role='modelo'` para el registro y reconocer a Botty por ID/email.

## Archivos clave
```
lib/chat/aim-botty.ts
lib/chat/process-bot-response.ts
lib/chat/bot-notifications.ts
app/api/chat/aim-botty/route.ts
app/api/chat/messages/route.ts
app/api/chat/users/route.ts
app/api/chat/broadcast/route.ts
components/chat/ChatWidget.tsx
components/chat/MainChatWindow.tsx
scripts/create_chat_broadcasts.sql
```

