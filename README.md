# IAM Sistema de Gestión

Este es el repositorio para el Sistema de Gestión IAM, una aplicación construida con Next.js, Supabase y Vercel.

## Características

- Sistema de autenticación basado en roles
- Dashboards personalizados por rol (Super Admin, Admin, Modelo)
- Gestión completa de usuarios
- Sistema de grupos y jerarquías
- **📱 Sistema de Chat Bidireccional en Tiempo Real**
- Diseño glassmorphism profesional

## Tecnologías

- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: Supabase
- **Deployment**: Vercel
- **Styling**: Tailwind CSS

## Instalación

1. Clona el repositorio
2. Instala las dependencias: `npm install`
3. Configura las variables de entorno
4. Ejecuta el servidor de desarrollo: `npm run dev`

## 📱 Sistema de Chat

El sistema incluye un chat bidireccional completo con:

- **Comunicación en tiempo real** entre modelos, admins y super admins
- **Notificaciones avanzadas** con sonido "N Dinámico" y alertas visuales
- **Estado en línea/offline** basado en autenticación
- **Interfaz moderna** con botón flotante y ventana elegante
- **Permisos inteligentes** según roles y grupos organizacionales

📖 **[Ver documentación completa del chat](./docs/CHAT_SYSTEM_SUMMARY.md)**

## Deployment

El proyecto está configurado para deployment automático en Vercel.

**🌐 URL de Producción**: https://iam-sistema-de-gestion.vercel.app