# 🔐 Guía Paso a Paso: Configurar Google OAuth 2.0 para Boost Pages

Esta guía te llevará paso a paso para configurar Google OAuth 2.0 desde cero.

## 📋 Paso 1: Acceder a Google Cloud Console

1. **Abre tu navegador** y ve a: https://console.cloud.google.com/
2. **Inicia sesión** con tu cuenta de Google (la misma que usa el Google Drive donde están las carpetas)
3. Si es tu primera vez, acepta los términos y condiciones

## 📋 Paso 2: Crear o Seleccionar un Proyecto

1. En la parte superior de la pantalla, verás un **selector de proyectos** (al lado del logo de Google Cloud)
2. Haz clic en el selector de proyectos
3. Tienes dos opciones:
   - **Si ya tienes un proyecto**: Selecciónalo de la lista
   - **Si es tu primera vez**: Haz clic en **"NEW PROJECT"** (Nuevo Proyecto)
     - Nombre del proyecto: `AIM Sistema de Gestión` (o el que prefieras)
     - Haz clic en **"CREATE"** (Crear)
     - Espera unos segundos a que se cree el proyecto

## 📋 Paso 3: Habilitar Google Drive API

1. En el menú lateral izquierdo, busca **"APIs & Services"** (APIs y Servicios)
2. Haz clic en **"Library"** (Biblioteca)
3. En el buscador, escribe: **"glGooe Drive API"**
4. Haz clic en el resultado **"Google Drive API"**
5. Haz clic en el botón azul **"ENABLE"** (Habilitar)
6. Espera unos segundos - verás un mensaje de confirmación

## 📋 Paso 4: Configurar la Pantalla de Consentimiento OAuth

1. En el menú lateral, ve a **"APIs & Services"** > **"OAuth consent screen"** (Pantalla de consentimiento OAuth)
2. Selecciona **"External"** (Externo) y haz clic en **"CREATE"** (Crear)
3. **Paso 1: App information** (Información de la aplicación):
   - **App name** (Nombre de la app): `AIM Sistema de Gestión`
   - **User support email** (Email de soporte): Tu email
   - **App logo** (Logo): Opcional, puedes saltarlo
   - **App domain** (Dominio de la app): 
     - Para desarrollo: `localhost`
     - Para producción: Tu dominio (ej: `tudominio.com`)
   - **Developer contact information** (Información de contacto del desarrollador): Tu email
   - Haz clic en **"SAVE AND CONTINUE"** (Guardar y continuar)

4. **Paso 2: Scopes** (Alcances):
   - Por ahora, haz clic en **"SAVE AND CONTINUE"** (Guardar y continuar)
   - Más adelante agregaremos los scopes necesarios

5. **Paso 3: Test users** (Usuarios de prueba):
   - ⚠️ **IMPORTANTE**: Si estás en modo "Testing" (Pruebas), DEBES agregar usuarios de prueba
   - Haz clic en **"+ ADD USERS"** o **"+ AGREGAR USUARIOS"**
   - Agrega tu email: **camcamberst@gmail.com** (o el email que uses para Google)
   - Puedes agregar más emails si otros usuarios necesitan acceder
   - Haz clic en **"ADD"** o **"AGREGAR"**
   - **Sin usuarios de prueba, verás el error 403: access_denied**
   - Haz clic en **"SAVE AND CONTINUE"** (Guardar y continuar)

6. **Paso 4: Summary** (Resumen):
   - Revisa la información
   - Haz clic en **"BACK TO DASHBOARD"** (Volver al panel)

## 📋 Paso 5: Crear Credenciales OAuth 2.0

1. En el menú lateral, ve a **"APIs & Services"** > **"Credentials"** (Credenciales)
2. En la parte superior, haz clic en **"+ CREATE CREDENTIALS"** (Crear credenciales)
3. Selecciona **"OAuth client ID"** (ID de cliente OAuth)
4. Si te pide configurar la pantalla de consentimiento primero, vuelve al Paso 4

5. **Application type** (Tipo de aplicación): Selecciona **"Web application"** (Aplicación web)

6. **Name** (Nombre): `AIM Web Client` (o el que prefieras)

7. **Authorized JavaScript origins** (Orígenes JavaScript autorizados):
   - Haz clic en **"+ ADD URI"** (Agregar URI)
   - Agrega estas URLs (una por una):
     ```
     http://localhost:3000
     https://tu-dominio.vercel.app
     ```
   - ⚠️ **IMPORTANTE**: Reemplaza `tu-dominio.vercel.app` con tu dominio real de Vercel

8. **Authorized redirect URIs** (URIs de redirección autorizadas):
   - Haz clic en **"+ ADD URI"** (Agregar URI)
   - Agrega estas URLs (una por una):
     ```
     http://localhost:3000/api/google-drive/callback
     https://tu-dominio.vercel.app/api/google-drive/callback
     ```
   - ⚠️ **IMPORTANTE**: Reemplaza `tu-dominio.vercel.app` con tu dominio real de Vercel

9. Haz clic en **"CREATE"** (Crear)

10. **¡IMPORTANTE!** Se abrirá un popup con tus credenciales:
    - **Your Client ID** (Tu ID de cliente): Copia este valor
    - **Your Client Secret** (Tu secreto de cliente): Copia este valor
    - ⚠️ **GUARDA ESTOS VALORES EN UN LUGAR SEGURO** - no los compartas públicamente

## 📋 Paso 6: Agregar Variables de Entorno

### En tu archivo local `.env.local`:

1. Abre el archivo `.env.local` en la raíz de tu proyecto
2. Agrega estas líneas (reemplaza con tus valores reales):

```env
# Google OAuth 2.0
GOOGLE_CLIENT_ID=tu_client_id_aqui_pega_el_valor_del_paso_5
GOOGLE_CLIENT_SECRET=tu_client_secret_aqui_pega_el_valor_del_paso_5
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-drive/callback

# URL de la aplicación (para desarrollo)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### En Vercel (Producción):

1. Ve a tu proyecto en Vercel: https://vercel.com/
2. Selecciona tu proyecto
3. Ve a **"Settings"** (Configuración) > **"Environment Variables"** (Variables de entorno)
4. Agrega cada variable una por una:

   **Variable 1:**
   - Name: `GOOGLE_CLIENT_ID`
   - Value: (pega tu Client ID del Paso 5)
   - Environment: Production, Preview, Development (marca las tres)
   - Haz clic en **"Save"**

   **Variable 2:**
   - Name: `GOOGLE_CLIENT_SECRET`
   - Value: (pega tu Client Secret del Paso 5)
   - Environment: Production, Preview, Development (marca las tres)
   - Haz clic en **"Save"**

   **Variable 3:**
   - Name: `GOOGLE_REDIRECT_URI`
   - Value: `https://tu-dominio.vercel.app/api/google-drive/callback`
   - ⚠️ Reemplaza `tu-dominio.vercel.app` con tu dominio real
   - Environment: Production, Preview, Development (marca las tres)
   - Haz clic en **"Save"**

   **Variable 4:**
   - Name: `NEXT_PUBLIC_APP_URL`
   - Value: `https://tu-dominio.vercel.app`
   - ⚠️ Reemplaza `tu-dominio.vercel.app` con tu dominio real
   - Environment: Production, Preview, Development (marca las tres)
   - Haz clic en **"Save"**

5. **Despliega nuevamente** tu aplicación en Vercel para que las variables surtan efecto

## 📋 Paso 7: Verificar que Todo Funciona

1. Reinicia tu servidor de desarrollo local:
   ```bash
   npm run dev
   ```

2. Abre tu aplicación en el navegador

3. Ve a "Portafolio Modelos" y haz clic en "Boost Pages" de cualquier modelo

4. Deberías ver el componente de drag & drop funcionando

## ❓ Preguntas Frecuentes

### ¿Cómo encuentro mi dominio de Vercel?
- Ve a tu proyecto en Vercel
- En la pestaña "Settings" > "Domains" verás tu dominio
- O simplemente mira la URL cuando abres tu aplicación desplegada

### ¿Qué pasa si olvidé mi Client Secret?
- Ve a Google Cloud Console > APIs & Services > Credenciales
- Haz clic en tu OAuth 2.0 Client ID
- Puedes ver el Client ID, pero el Secret solo se muestra una vez
- Si lo perdiste, tendrás que crear nuevas credenciales

### ¿Por qué no funciona en producción?
- Verifica que agregaste las variables de entorno en Vercel
- Verifica que el dominio en las variables coincide con tu dominio real
- Verifica que el redirect URI en Google Cloud Console coincide exactamente
- Asegúrate de haber hecho un nuevo deploy después de agregar las variables

## 🎉 ¡Listo!

Una vez completados estos pasos, la funcionalidad de drag & drop debería funcionar completamente.

Si tienes problemas, verifica:
1. ✅ Google Drive API está habilitada
2. ✅ Las credenciales OAuth están creadas
3. ✅ Los redirect URIs están configurados correctamente
4. ✅ Las variables de entorno están agregadas (local y Vercel)
5. ✅ El servidor se reinició después de agregar las variables

