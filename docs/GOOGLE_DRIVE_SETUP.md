# Configuración de Google Drive API para Boost Pages

Para habilitar la funcionalidad de subir archivos directamente desde el AIM sin salir del sitio, necesitas configurar Google OAuth 2.0.

## 📋 Requisitos Previos

1. Una cuenta de Google con acceso a Google Cloud Console
2. Un proyecto en Google Cloud Console
3. Google Drive API habilitada

## 🔧 Pasos de Configuración

### 1. Crear Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la **Google Drive API**:
   - Ve a "APIs & Services" > "Library"
   - Busca "Google Drive API"
   - Haz clic en "Enable"

### 2. Crear Credenciales OAuth 2.0

1. Ve a "APIs & Services" > "Credentials"
2. Haz clic en "Create Credentials" > "OAuth client ID"
3. Si es la primera vez, configura la pantalla de consentimiento:
   - Tipo de aplicación: "External"
   - Nombre de la aplicación: "AIM Sistema de Gestión"
   - Email de soporte: tu email
   - Dominios autorizados: tu dominio (ej: `tudominio.com`)
   - Guarda y continúa
4. Crea el OAuth client ID:
   - Tipo de aplicación: "Web application"
   - Nombre: "AIM Web Client"
   - **Authorized JavaScript origins**: 
     - `http://localhost:3000` (para desarrollo)
     - `https://tu-dominio.vercel.app` (para producción)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/google-drive/callback` (para desarrollo)
     - `https://tu-dominio.vercel.app/api/google-drive/callback` (para producción)
5. Guarda y copia el **Client ID** y **Client Secret**

### 3. Configurar Variables de Entorno

Agrega las siguientes variables a tu archivo `.env.local` y a las variables de entorno de Vercel:

```env
# Google OAuth 2.0
GOOGLE_CLIENT_ID=tu_client_id_aqui
GOOGLE_CLIENT_SECRET=tu_client_secret_aqui
GOOGLE_REDIRECT_URI=https://tu-dominio.vercel.app/api/google-drive/callback

# URL de la aplicación (para desarrollo local)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Instalar Dependencias

```bash
npm install googleapis
```

### 5. Implementar Flujo OAuth Completo

Los endpoints actuales están preparados pero necesitan:
1. Endpoint de autenticación inicial (`/api/google-drive/auth`)
2. Endpoint de callback (`/api/google-drive/callback`)
3. Almacenamiento de tokens (sesión o base de datos)
4. Refrescar tokens cuando expiren

## 🚀 Funcionalidades Disponibles

Una vez configurado, podrás:

- ✅ Arrastrar y soltar fotos directamente en el modal
- ✅ Seleccionar la carpeta destino desde un dropdown
- ✅ Ver progreso de subida en tiempo real
- ✅ Subir múltiples archivos simultáneamente
- ✅ No salir del sitio para subir archivos

## ⚠️ Nota Importante

**Por ahora, la funcionalidad está preparada pero requiere la configuración completa de OAuth.**

Mientras tanto, los usuarios pueden usar la opción alternativa de abrir Google Drive en una nueva pestaña.

## 📝 Próximos Pasos

1. Implementar endpoint de autenticación OAuth
2. Implementar endpoint de callback
3. Almacenar tokens de acceso de forma segura
4. Implementar refresh de tokens
5. Probar el flujo completo

## 🔒 Seguridad

- Los tokens de acceso deben almacenarse de forma segura
- Nunca expongas el Client Secret en el frontend
- Usa HTTPS en producción
- Implementa rate limiting para evitar abusos





