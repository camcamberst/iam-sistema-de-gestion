# 🔧 Configuración de Variables de Entorno para Google OAuth

## 📋 Valores que debes usar

Basado en tu configuración de Google OAuth, estos son los valores que debes usar:

### Client ID
```
TU_CLIENT_ID_AQUI
```
⚠️ **Obtén este valor desde:** Google Cloud Console > APIs & Services > Credentials > Tu cliente OAuth

### Client Secret
```
TU_CLIENT_SECRET_AQUI
```
⚠️ **Obtén este valor desde:** Google Cloud Console > APIs & Services > Credentials > Tu cliente OAuth (ícono del ojo)

### Redirect URI (Desarrollo)
```
http://localhost:3000/api/google-drive/callback
```

### Redirect URI (Producción)
```
https://iam-sistema-de-gestion.vercel.app/api/google-drive/callback
```

### App URL (Desarrollo)
```
http://localhost:3000
```

### App URL (Producción)
```
https://iam-sistema-de-gestion.vercel.app
```

---

## 📝 Paso 1: Configurar `.env.local` (Desarrollo Local)

1. Abre el archivo `.env.local` en la raíz de tu proyecto
2. Agrega estas líneas al final del archivo:

```env
# Google OAuth 2.0
GOOGLE_CLIENT_ID=tu_client_id_aqui
GOOGLE_CLIENT_SECRET=tu_client_secret_aqui
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-drive/callback

# URL de la aplicación (para desarrollo)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
⚠️ **Reemplaza** `tu_client_id_aqui` y `tu_client_secret_aqui` con tus valores reales de Google Cloud Console

3. Guarda el archivo
4. Reinicia tu servidor de desarrollo:
   ```bash
   npm run dev
   ```

---

## 🌐 Paso 2: Configurar Variables en Vercel (Producción)

1. Ve a https://vercel.com/
2. Selecciona tu proyecto: **iam-sistema-de-gestion**
3. Ve a **Settings** > **Environment Variables**
4. Agrega cada variable una por una:

### Variable 1: GOOGLE_CLIENT_ID
- **Name:** `GOOGLE_CLIENT_ID`
- **Value:** `TU_CLIENT_ID_AQUI` (reemplaza con tu Client ID real)
- **Environment:** ✅ Production, ✅ Preview, ✅ Development
- Haz clic en **Save**

### Variable 2: GOOGLE_CLIENT_SECRET
- **Name:** `GOOGLE_CLIENT_SECRET`
- **Value:** `TU_CLIENT_SECRET_AQUI` (reemplaza con tu Client Secret real)
- **Environment:** ✅ Production, ✅ Preview, ✅ Development
- Haz clic en **Save**

### Variable 3: GOOGLE_REDIRECT_URI
- **Name:** `GOOGLE_REDIRECT_URI`
- **Value:** `https://iam-sistema-de-gestion.vercel.app/api/google-drive/callback`
- **Environment:** ✅ Production, ✅ Preview, ✅ Development
- Haz clic en **Save**

### Variable 4: NEXT_PUBLIC_APP_URL
- **Name:** `NEXT_PUBLIC_APP_URL`
- **Value:** `https://iam-sistema-de-gestion.vercel.app`
- **Environment:** ✅ Production, ✅ Preview, ✅ Development
- Haz clic en **Save**

5. **IMPORTANTE:** Después de agregar todas las variables, haz un nuevo deploy:
   - Ve a la pestaña **Deployments**
   - Haz clic en los tres puntos (...) del último deployment
   - Selecciona **Redeploy**
   - O simplemente haz un push a tu repositorio para que se despliegue automáticamente

---

## ✅ Verificación

Después de configurar todo:

1. **Local:**
   - Reinicia el servidor: `npm run dev`
   - Ve a "Portafolio Modelos" > "Boost Pages"
   - Deberías poder autenticarte con Google

2. **Producción:**
   - Espera a que termine el nuevo deploy
   - Ve a tu aplicación en producción
   - Prueba "Boost Pages" desde ahí

---

## 🔒 Seguridad

- ⚠️ **NUNCA** subas el archivo `.env.local` a Git (ya está en `.gitignore`)
- ⚠️ **NUNCA** compartas tu Client Secret públicamente
- ✅ El archivo `.env.example` es seguro de subir (no contiene valores reales)

---

## 🆘 Si algo no funciona

1. Verifica que todas las variables estén escritas correctamente (sin espacios extra)
2. Verifica que el servidor se haya reiniciado después de agregar las variables
3. Verifica que en Vercel hayas hecho un nuevo deploy después de agregar las variables
4. Revisa la consola del navegador para ver errores
5. Revisa los logs de Vercel para ver errores del servidor

