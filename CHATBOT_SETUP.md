# Configuración del ChatBot AIM

## Variables de Entorno Requeridas

Agrega estas variables a tu archivo `.env.local`:

```bash
# Google Gemini API (para el ChatBot)
GOOGLE_GEMINI_API_KEY=tu_api_key_de_google_gemini
```

## Configuración de Google Gemini

1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Crea una nueva API key
3. Copia la key y agrégala a tu archivo `.env.local`

## Base de Datos

Ejecuta el script SQL para crear las tablas del sistema de chat:

```bash
# En tu cliente de Supabase SQL Editor
# Ejecuta el contenido de: db/chat_system.sql
```

## Funcionalidades Implementadas

### ✅ ChatBot con IA
- Integración con Google Gemini (gratuito hasta 15 requests/minuto)
- Respuestas contextuales basadas en el portafolio del usuario
- Límites de uso: 20 mensajes/sesión, 10 min timeout
- Escalación automática a administradores

### ✅ Sistema de Escalación
- Palabras clave: "urgente"
- Después de 3 intentos sin resolver
- Solicitud explícita de admin
- Creación automática de tickets

### ✅ Panel de Administración
- Gestión de tickets en `/admin/chat-tickets`
- Filtros por estado, prioridad, asignación
- Notificaciones en tiempo real
- Asignación de tickets a administradores

### ✅ Widget Flotante
- Disponible en dashboard y calculadora de modelos
- Interfaz moderna y responsive
- Historial de conversaciones (7 días)
- Contador de mensajes

## Límites y Restricciones

### Funcionalidades Permitidas:
- Tips de engagement con audiencia
- Optimización de ganancias por plataforma
- Mejores prácticas de streaming
- Configuración de equipos
- Gestión del tiempo
- Problemas técnicos del sistema AIM
- Configuración de calculadora y portafolio
- Dudas sobre porcentajes, comisiones y conversiones

### Límites Estrictos:
- ❌ NO sugerir nuevas plataformas
- ❌ NO información de otras modelos
- ❌ NO temas financieros sensibles
- ❌ NO problemas de plataformas externas
- ❌ NO temas no relacionados al trabajo

## Uso

1. **Para Modelos**: El widget aparece automáticamente en dashboard y calculadora
2. **Para Admins**: Accede a `/admin/chat-tickets` para gestionar tickets
3. **Escalación**: Se crea automáticamente cuando se cumplen las condiciones

## Costos

- **Google Gemini**: Gratuito hasta 15 requests/minuto
- **Supabase**: Usa las tablas existentes (sin costo adicional)
- **Total**: $0/mes para uso básico

## Próximos Pasos

1. Configurar la API key de Google Gemini
2. Ejecutar el script SQL de base de datos
3. Probar el sistema con usuarios reales
4. Ajustar prompts según feedback
