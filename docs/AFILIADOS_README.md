# 🏢 DOCUMENTACIÓN: SISTEMA DE ESTUDIOS AFILIADOS

## 📚 ÍNDICE DE DOCUMENTACIÓN

Esta carpeta contiene toda la documentación relacionada con el sistema de estudios afiliados.

### 📖 Documentos Principales

1. **[Guía Completa](./AFILIADOS_GUIA_COMPLETA.md)**
   - Guía principal de uso del sistema
   - Cómo crear y gestionar estudios afiliados
   - Roles y permisos
   - Troubleshooting

2. **[Referencia de APIs](./AFILIADOS_API_REFERENCE.md)**
   - Documentación completa de todos los endpoints
   - Ejemplos de uso
   - Códigos de error

3. **[Sistema de Facturación](./AFILIADOS_FACTURACION.md)**
   - Distribución de facturación (60% modelo, 30% estudio, 10% Innova)
   - Cálculo automático
   - Visualización en dashboards
   - Ejemplos prácticos

4. **[Arquitectura Técnica](./AFILIADOS_ARQUITECTURA.md)**
   - Arquitectura del sistema
   - Estructura de base de datos
   - Sistema de filtros
   - Seguridad y escalabilidad

5. **[Implementación](./AFILIADOS_IMPLEMENTACION.md)**
   - Resumen ejecutivo
   - Estructura de base de datos
   - Sistema de permisos
   - Estado de implementación

6. **[Flujo de Trabajo](./FLUJO_AFILIADOS.md)**
   - Flujo paso a paso para crear estudios afiliados
   - Cómo el sistema entiende los límites de jerarquía
   - Verificación del flujo

---

## 🚀 INICIO RÁPIDO

### Para Super Admin (Agencia Innova)

1. Leer: [Guía Completa - Crear un Estudio Afiliado](./AFILIADOS_GUIA_COMPLETA.md#crear-un-estudio-afiliado)
2. Crear estudio desde: `/admin/affiliates/gestionar`
3. Revisar: [Sistema de Facturación](./AFILIADOS_FACTURACION.md) para entender comisiones

### Para Superadmin AFF (Estudio Afiliado)

1. Leer: [Guía Completa - Gestión de Usuarios](./AFILIADOS_GUIA_COMPLETA.md#gestión-de-usuarios)
2. Leer: [Guía Completa - Gestión de Sedes](./AFILIADOS_GUIA_COMPLETA.md#gestión-de-sedes-y-grupos)
3. Revisar: [Sistema de Facturación](./AFILIADOS_FACTURACION.md) para entender distribución

### Para Desarrolladores

1. Leer: [Arquitectura Técnica](./AFILIADOS_ARQUITECTURA.md)
2. Revisar: [Referencia de APIs](./AFILIADOS_API_REFERENCE.md)
3. Consultar: [Implementación](./AFILIADOS_IMPLEMENTACION.md) para estructura de BD

---

## 📋 CONCEPTOS CLAVE

### Multi-Tenancy

Cada estudio afiliado opera en su propia "burbuja" de datos, completamente separada de Agencia Innova y otros afiliados.

### affiliate_studio_id

Campo clave que identifica a qué estudio pertenece cada dato. Se usa para filtrar automáticamente todas las consultas.

### Distribución de Facturación

- **Modelo**: 60% del bruto
- **Estudio Afiliado**: 30% del bruto
- **Agencia Innova**: 10% del bruto (comisión)

### Roles

- `super_admin`: Control total (Agencia Innova)
- `superadmin_aff`: Superadmin del estudio afiliado
- `admin`: Admin de Innova o dentro de afiliado
- `modelo`: Modelo de Innova o dentro de afiliado

---

## 🔍 BÚSQUEDA RÁPIDA

### ¿Cómo crear un estudio afiliado?
→ [Guía Completa - Crear un Estudio Afiliado](./AFILIADOS_GUIA_COMPLETA.md#crear-un-estudio-afiliado)

### ¿Cómo funciona la facturación?
→ [Sistema de Facturación](./AFILIADOS_FACTURACION.md)

### ¿Qué APIs están disponibles?
→ [Referencia de APIs](./AFILIADOS_API_REFERENCE.md)

### ¿Cómo funciona el sistema de filtros?
→ [Arquitectura Técnica - Sistema de Filtros](./AFILIADOS_ARQUITECTURA.md#sistema-de-filtros)

### ¿Cómo se estructura la base de datos?
→ [Arquitectura Técnica - Base de Datos](./AFILIADOS_ARQUITECTURA.md#base-de-datos)

### ¿Qué permisos tiene cada rol?
→ [Guía Completa - Roles y Permisos](./AFILIADOS_GUIA_COMPLETA.md#roles-y-permisos)

---

## 📝 NOTAS

- **Última actualización**: Enero 2025
- **Estado**: Sistema completamente implementado y funcional
- **Escalabilidad**: Sin límites en número de estudios afiliados
- **Documentación**: Completa y actualizada

---

## 🆘 SOPORTE

Si encuentras algún problema o tienes preguntas:

1. Revisar: [Troubleshooting](./AFILIADOS_GUIA_COMPLETA.md#troubleshooting)
2. Consultar: [Flujo de Trabajo](./FLUJO_AFILIADOS.md)
3. Verificar: [Implementación](./AFILIADOS_IMPLEMENTACION.md)

---

**Documentación mantenida por:** Equipo de Desarrollo AIM
