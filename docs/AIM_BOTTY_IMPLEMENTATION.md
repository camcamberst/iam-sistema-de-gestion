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

## 🔧 Integración en el Sistema

### Envío de Mensajes

Cuando un usuario envía un mensaje a AIM Botty:
1. El mensaje se crea normalmente en `chat_messages`
2. La API detecta que es al bot (`isToBotty`)
3. Se llama a `/api/chat/aim-botty` en segundo plano (no bloquea)
4. El bot genera respuesta con IA
5. La respuesta se inserta como mensaje del bot

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

## 🐛 Troubleshooting

### El bot no aparece en la lista de contactos
- Verificar que el UUID en `aim-botty.ts` coincida con el usuario en DB
- Verificar que `app/api/chat/users/route.ts` incluye el bot

### El bot no responde
- Verificar `GOOGLE_GEMINI_API_KEY` en variables de entorno
- Verificar logs en consola del servidor
- Verificar que el usuario bot existe en `users` table

### Notificaciones no se envían
- Verificar que se llama a las funciones de `bot-notifications.ts`
- Verificar logs en consola
- Verificar que existe conversación con el bot

