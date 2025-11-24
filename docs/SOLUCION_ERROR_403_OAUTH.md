# 🔧 Solución: Error 403 - Acceso Bloqueado en Google OAuth

## 🎯 Problema

Cuando intentas autenticarte con Google, ves este error:
```
Error 403: access_denied
Acceso bloqueado: iam-sistema-de-gestion.vercel.app no completó el proceso de verificación de Google
```

## ✅ Solución: Agregar Usuarios de Prueba

Tu aplicación OAuth está en **modo de prueba**. Necesitas agregar usuarios autorizados en Google Cloud Console.

### Paso 1: Ir a Google Cloud Console

1. Ve a: https://console.cloud.google.com/
2. Selecciona el proyecto: **aim-chatbot-project**
3. En el menú lateral, ve a: **APIs & Services** > **OAuth consent screen**

### Paso 2: Agregar Usuarios de Prueba

1. En la página de **OAuth consent screen**, desplázate hacia abajo
2. Busca la sección **"Test users"** (Usuarios de prueba)
3. Haz clic en **"+ ADD USERS"** o **"+ AGREGAR USUARIOS"**
4. Agrega tu email: **camcamberst@gmail.com**
5. Puedes agregar más emails si otros usuarios necesitan acceder
6. Haz clic en **"ADD"** o **"AGREGAR"**

### Paso 3: Guardar Cambios

1. Verifica que tu email aparezca en la lista de usuarios de prueba
2. Los cambios se guardan automáticamente

### Paso 4: Probar de Nuevo

1. Vuelve a tu aplicación: https://iam-sistema-de-gestion.vercel.app
2. Intenta autenticarte con Google de nuevo
3. Ahora deberías poder autorizar el acceso

---

## 📋 Lista de Usuarios que Necesitan Acceso

Si otros usuarios también necesitan usar Boost Pages, agrégalos como usuarios de prueba:

- [ ] camcamberst@gmail.com (tu email)
- [ ] (agregar otros emails si es necesario)

---

## 🔄 Alternativa: Publicar la Aplicación (No Recomendado para Pruebas)

Si quieres que cualquier usuario pueda acceder sin agregarlos manualmente, puedes publicar la aplicación, pero esto requiere:

1. **Verificación de Google** (proceso largo, puede tomar días)
2. **Política de privacidad** publicada
3. **Términos de servicio** publicados
4. **Revisión de Google** de tu aplicación

**Recomendación:** Para desarrollo y pruebas, es mejor usar usuarios de prueba.

---

## ⚠️ Importante

- Los usuarios de prueba solo pueden acceder mientras la app esté en modo de prueba
- Si publicas la app, todos los usuarios podrán acceder (después de la verificación)
- Puedes agregar hasta 100 usuarios de prueba

---

## ✅ Después de Agregar Usuarios

Una vez que agregues tu email como usuario de prueba:

1. Vuelve a intentar autenticarte
2. Deberías ver la pantalla de consentimiento de Google
3. Autoriza el acceso
4. Serás redirigido de vuelta a la aplicación
5. ¡Ya podrás usar Boost Pages!

---

## 🆘 Si Aún No Funciona

1. **Espera unos minutos** después de agregar el usuario (puede haber un pequeño delay)
2. **Cierra sesión de Google** y vuelve a intentar
3. **Usa una ventana de incógnito** para probar
4. **Verifica que el email sea exactamente el mismo** que usas para iniciar sesión en Google





