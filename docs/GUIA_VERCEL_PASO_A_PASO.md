# 🌐 Guía Paso a Paso: Configurar Variables en Vercel

## 📋 Paso 1: Acceder a Vercel

1. **Abre tu navegador** y ve a: https://vercel.com/
2. **Inicia sesión** con tu cuenta (la misma que usas para desplegar tu proyecto)
3. Si no estás logueado, haz clic en **"Log In"** (Iniciar sesión)

## 📋 Paso 2: Seleccionar tu Proyecto

1. En el dashboard de Vercel, busca tu proyecto: **iam-sistema-de-gestion**
2. Haz clic en el nombre del proyecto para abrirlo

## 📋 Paso 3: Ir a Configuración de Variables de Entorno

1. En la parte superior de la página del proyecto, verás varias pestañas:
   - **Overview** (Resumen)
   - **Deployments** (Despliegues)
   - **Settings** (Configuración) ← **Haz clic aquí**
2. En el menú lateral izquierdo (dentro de Settings), busca:
   - **Environment Variables** (Variables de entorno) ← **Haz clic aquí**

## 📋 Paso 4: Agregar Variable 1: GOOGLE_CLIENT_ID

1. Verás un formulario con campos:
   - **Key** (Clave/Nombre)
   - **Value** (Valor)
   - **Environment** (Entorno) - con checkboxes para Production, Preview, Development

2. Completa así:
   - **Key:** `GOOGLE_CLIENT_ID`
   - **Value:** `[TU_GOOGLE_CLIENT_ID_AQUI]`
   - **Environment:** Marca las 3 opciones:
     - ✅ Production
     - ✅ Preview
     - ✅ Development

3. Haz clic en el botón **"Save"** (Guardar) o **"Add"** (Agregar)

## 📋 Paso 5: Agregar Variable 2: GOOGLE_CLIENT_SECRET

1. Haz clic en **"+ Add New"** (Agregar nueva) o similar
2. Completa así:
   - **Key:** `GOOGLE_CLIENT_SECRET`
   - **Value:** `[TU_GOOGLE_CLIENT_SECRET_AQUI]`
   - **Environment:** Marca las 3 opciones:
     - ✅ Production
     - ✅ Preview
     - ✅ Development

3. Haz clic en **"Save"** (Guardar)

## 📋 Paso 6: Agregar Variable 3: GOOGLE_REDIRECT_URI

1. Haz clic en **"+ Add New"** (Agregar nueva)
2. Completa así:
   - **Key:** `GOOGLE_REDIRECT_URI`
   - **Value:** `https://iam-sistema-de-gestion.vercel.app/api/google-drive/callback`
   - **Environment:** Marca las 3 opciones:
     - ✅ Production
     - ✅ Preview
     - ✅ Development

3. Haz clic en **"Save"** (Guardar)

## 📋 Paso 7: Agregar Variable 4: NEXT_PUBLIC_APP_URL

1. Haz clic en **"+ Add New"** (Agregar nueva)
2. Completa así:
   - **Key:** `NEXT_PUBLIC_APP_URL`
   - **Value:** `https://iam-sistema-de-gestion.vercel.app`
   - **Environment:** Marca las 3 opciones:
     - ✅ Production
     - ✅ Preview
     - ✅ Development

3. Haz clic en **"Save"** (Guardar)

## 📋 Paso 8: Verificar que Todas las Variables Estén Agregadas

Deberías ver una lista con estas 4 variables:
- ✅ `GOOGLE_CLIENT_ID`
- ✅ `GOOGLE_CLIENT_SECRET`
- ✅ `GOOGLE_REDIRECT_URI`
- ✅ `NEXT_PUBLIC_APP_URL`

## 📋 Paso 9: Hacer un Nuevo Deploy

⚠️ **IMPORTANTE:** Las variables de entorno solo surten efecto después de un nuevo deploy.

### Opción A: Redeploy del último deployment (más rápido)

1. Ve a la pestaña **"Deployments"** (Despliegues)
2. Busca el último deployment (el más reciente)
3. Haz clic en los **tres puntos (...)** a la derecha del deployment
4. Selecciona **"Redeploy"** (Redesplegar)
5. Confirma el redeploy
6. Espera a que termine (verás el progreso)

### Opción B: Push a Git (despliegue automático)

1. Si haces cualquier cambio y haces `git push`, Vercel desplegará automáticamente
2. Las nuevas variables estarán disponibles en ese nuevo deployment

## ✅ Verificación Final

Después del deploy:

1. Ve a tu aplicación en producción: https://iam-sistema-de-gestion.vercel.app
2. Inicia sesión
3. Ve a "Portafolio Modelos"
4. Haz clic en "Boost Pages" de cualquier modelo
5. Deberías poder autenticarte con Google y subir fotos

## 🆘 Si algo no funciona

1. Verifica que todas las variables estén escritas correctamente (sin espacios)
2. Verifica que hayas marcado las 3 opciones de Environment
3. Verifica que hayas hecho un nuevo deploy después de agregar las variables
4. Revisa los logs del deployment en Vercel para ver si hay errores
5. Revisa la consola del navegador para ver errores

## 📸 Capturas de Ayuda

Si necesitas ayuda visual, busca en Google:
- "Vercel environment variables settings"
- "How to add environment variables in Vercel"

---

## 🎉 ¡Listo!

Una vez completados estos pasos, tu aplicación en producción estará lista para usar Google OAuth.





