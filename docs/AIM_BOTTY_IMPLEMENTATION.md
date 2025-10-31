# 🤖 AIM Botty - Sistema de Chatbot con IA

## 📋 Resumen

AIM Botty es un asistente virtual con IA integrado en el sistema de chat que:
- Aparece como un contacto en línea en la lista de contactos
- Funciona como un chat individual con cada usuario
- Proporciona notificaciones automáticas según el rol
- Ofrece consejería, tips y soporte técnico
- Puede escalar consultas a administradores cuando sea necesario

## 🏗️ Arquitectura

### Componentes Principales

1. **`lib/chat/aim-botty.ts`**: Funciones core del bot (configuración, personalidades, notificaciones)
2. **`app/api/chat/aim-botty/route.ts`**: API endpoint para procesar mensajes y generar respuestas con IA
3. **`lib/chat/bot-notifications.ts`**: Sistema de notificaciones automáticas
4. **`app/api/chat/users/route.ts`**: Modificado para incluir AIM Botty en la lista de contactos
5. **`app/api/chat/messages/route.ts`**: Modificado para detectar mensajes al bot y generar respuestas

### Componentes y Endpoints añadidos/ajustados (2025-10-31)

6. **`lib/chat/process-bot-response.ts`**: Procesador directo de respuestas del bot con fallback de modelos Gemini y logging avanzado
7. **`app/api/chat/broadcast/route.ts`**: Endpoint para envíos masivos (difusión) por `admin/super_admin`, con límites jerárquicos y sin hilos individuales a destinatarios
8. **`app/api/chat/aim-botty/route.ts`**: Ajustado a `gemini-pro` con trazas de diagnóstico
9. **`app/api/chat/users/route.ts`**: Incluye a Botty siempre online, al inicio de la lista; heartbeat para marcar offline >2 minutos
10. **`components/chat/MainChatWindow.tsx`**: Ventana principal del AIM; scroll al final por defecto; header muestra nombre del contacto activo; confirmación de borrar conversación embebida como overlay interno
11. **`components/chat/ChatWidget.tsx`**: Parpadeo de pestaña "Conversaciones" y apertura automática una sola vez por mensaje; sin sonidos de notificación; botón y ventana renderizados como portales independientes de la página
12. **`app/admin/broadcast/page.tsx`**: UI para envíos masivos por `admin/super_admin`
13. **`scripts/create_chat_broadcasts.sql`**: Tablas `chat_broadcasts`, `chat_broadcast_targets` y columnas en `chat_messages` para soportar difusión

### Base de Datos

- Usuario especial en `users` table con `role = 'bot'`
- Conversaciones normales en `chat_conversations` (participant_1_id o participant_2_id = AIM_BOTTY_ID)
- Mensajes del bot en `chat_messages` con `sender_id = AIM_BOTTY_ID` y `message_type = 'ai_response'`

## 🚀 Instalación

### 1. Crear Usuario Bot en Supabase

1. Ir a Supabase Dashboard > Authentication > Users
2. Crear nuevo usuario:
   - Email: `aim-botty@agencia-innova.com`
   - Password: [generar contraseña segura, no se usará para login]
   - Copiar el UUID generado

3. Ejecutar el script SQL (actualizar UUID):
   ```sql
   -- Ver scripts/create-aim-botty-user.sql
   ```

4. Actualizar `AIM_BOTTY_ID` en `lib/chat/aim-botty.ts` con el UUID real

Nota: Si la base de datos aplica un `CHECK` que no admite `role='bot'`, se usa `role='modelo'` para el registro físico, pero el sistema identifica a Botty por `AIM_BOTTY_ID`/email.

### 2. Configurar Variables de Entorno

Asegúrate de tener:
```env
GOOGLE_GEMINI_API_KEY=tu_api_key_aqui
NEXT_PUBLIC_APP_URL=https://tu-dominio.com (o http://localhost:3000 para desarrollo)
```

## 🎯 Funcionalidades

### 1. Notificaciones Automáticas

El bot puede enviar notificaciones automáticas para:
- `anticipo_pendiente`: Nueva solicitud de anticipo pendiente
- `anticipo_aprobado`: Anticipo aprobado
- `anticipo_rechazado`: Anticipo rechazado
- `pagina_confirmada`: Confirmación de entrega de página
- `periodo_cerrado`: Cierre de período de facturación
- `metas_alcanzadas`: Meta del día alcanzada
- `recordatorio_ingreso`: Recordatorio de ingresar valores

**Uso:**
```typescript
import { notifyAnticipoPending } from '@/lib/chat/bot-notifications';

// Cuando se crea una solicitud de anticipo
await notifyAnticipoPending(userId, anticipoId);
```

### 2. Respuestas con IA

El bot usa Google Gemini para generar respuestas contextuales según:
- **Rol del usuario**: Personalidad diferente para modelo/admin/super_admin
- **Historial de conversación**: Mantiene contexto de últimos 10 mensajes
- **Información del usuario**: Portafolio, grupos, actividad reciente

#### Modelos y fallback (robustez en producción)

- Secuencia de fallback: `gemini-2.0-flash-exp` → `gemini-1.5-flash-latest` → `gemini-1.5-pro-latest` → `gemini-1.5-flash` → `gemini-1.5-pro` → `gemini-pro`.
- Logging detallado para identificar 404 de modelo o errores de API Key.
- Cambio a invocación directa del procesador (evitando `fetch` interno) para mayor fiabilidad en producción.

#### Estilo y UX de respuesta

- Respuestas más cortas, tono amable y cercano.
- Solo saluda en el primer mensaje de cada conversación.

### 3. Funcionalidades por Rol

#### Para Modelos:
- Tips sobre plataformas del portafolio
- Consejos de transmisión (make up, ángulos, iluminación)
- Consejería emocional
- Tips para potenciar transmisiones
- Soporte técnico con búsqueda web
- Escalamiento a admin

#### Para Admin/Super Admin:
- Reportes de actividad
- Resúmenes de métricas
- Alertas importantes

### 4. Difusiones (Broadcast)

- Envíos masivos "como Botty" a roles, grupos o usuarios específicos.
- Validación jerárquica: `super_admin` sin restricciones; `admin` limitado a su ámbito.
- No crea hilos individuales para receptores; crea un resumen único para el emisor con chip "Difusión".
- Respuestas a mensajes de difusión están bloqueadas (`no_reply`).

Estructura de datos:
- Tablas: `chat_broadcasts`, `chat_broadcast_targets`.
- En `chat_messages`: columnas `is_broadcast`, `broadcast_id`, `no_reply`, `metadata`.

Endpoint:
- `POST /api/chat/broadcast` con Bearer token. Crea el evento de difusión y mensajes asociados.

## 🔧 Integración en el Sistema

### Envío de Mensajes

Cuando un usuario envía un mensaje a AIM Botty:
1. El mensaje se crea normalmente en `chat_messages`
2. La API detecta que es al bot (`isToBotty`)
3. Se llama a `/api/chat/aim-botty` en segundo plano (no bloquea)
4. El bot genera respuesta con IA
5. La respuesta se inserta como mensaje del bot

Notas de UX recientes:
- La pestaña "Conversaciones" parpadea si hay mensajes sin leer.
- La ventana del AIM se abre automáticamente una sola vez al llegar un mensaje nuevo (no persistente).
- El título del navegador alterna para avisos de nuevos mensajes.
- Botty es siempre el primer contacto visible y se muestra como online.

### Notificaciones Automáticas

Para enviar notificaciones automáticas, llama a las funciones en `bot-notifications.ts` desde:
- API endpoints de anticipos
- Webhooks de confirmaciones
- Cron jobs para recordatorios

**Ejemplo:**
```typescript
// En app/api/anticipos/route.ts después de crear anticipo
import { notifyAnticipoPending } from '@/lib/chat/bot-notifications';

if (anticipoCreated) {
  await notifyAnticipoPending(userId, anticipoId);
}
```

## 🎨 Personalidad del Bot

El bot tiene personalidades diferentes según el rol:

- **Modelo**: Amigable, empático, motivador, conocedor del entretenimiento adulto
- **Admin**: Profesional, eficiente, enfocado en métricas
- **Super Admin**: Ejecutivo, estratégico, enfocado en panorama general

Configurado en `getBotPersonalityForRole()` en `lib/chat/aim-botty.ts`

Ajustes recientes:
- Respuestas breves, cálidas y directas.
- Saludo solo en el primer turno de una conversación.

## 📝 Próximas Mejoras

1. ✅ Sistema base implementado
2. ⏳ Búsqueda web para soporte técnico
3. ⏳ Escalamiento automático a admin
4. ⏳ Integración con notificaciones de sistema existente
5. ⏳ Analytics de interacciones del bot

## 🔐 Seguridad

- El bot solo responde en conversaciones donde es participante
- Validación de tokens en todos los endpoints
- El bot no puede acceder a información no autorizada
- Respuestas generadas por IA, pero validadas por contexto del sistema

Adicionales:
- Difusiones respetan jerarquías y bloquean respuestas de receptores.
- Botty no aparece en el resumen de facturación (filtrado por ID/email en endpoints correspondientes).

## 🐛 Troubleshooting

### El bot no aparece en la lista de contactos
- Verificar que el UUID en `aim-botty.ts` coincida con el usuario en DB
- Verificar que `app/api/chat/users/route.ts` incluye el bot
  - Asegurar que Botty se ordena primero y está siempre online por lógica de servidor

### El bot no responde
- Verificar `GOOGLE_GEMINI_API_KEY` en variables de entorno
- Verificar logs en consola del servidor
- Verificar que el usuario bot existe en `users` table
 - Si hay 404 del modelo, confirmar disponibilidad o confiar en el fallback automático

### Notificaciones no se envían
- Verificar que se llama a las funciones de `bot-notifications.ts`
- Verificar logs en consola
- Verificar que existe conversación con el bot

### La confirmación de borrado no respeta el layout
- La confirmación ahora es un overlay interno dentro de `MainChatWindow` que no altera el posicionamiento externo.
- Verificar clase `relative` en el contenedor de contenido y el overlay `absolute inset-0`.



