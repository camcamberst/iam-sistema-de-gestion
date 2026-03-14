# Integridad y protección en producción

El sistema está en funcionamiento en producción. No podemos permitir caídas de servicio. Este documento recoge las prácticas para preservar y proteger la integridad del proyecto.

---

## Antes de tocar código

- **Alcance acotado:** Solo modificar lo estrictamente necesario para la funcionalidad en la que se está trabajando.
- **No tocar lo no implicado:** Evitar cambios en APIs, rutas o componentes que no estén relacionados con el cambio actual.
- **Revisar impacto:** Ver qué consume lo que vamos a cambiar (otros endpoints, el front, otros servicios) para no romper contratos ni flujos.

---

## Al implementar

- **Compatibilidad hacia atrás:** No eliminar campos ni cambiar formas de respuesta ya usadas por el front u otros servicios. Preferir extender (nuevos campos, nuevos endpoints) cuando sea posible.
- **Código defensivo en el front:** Comprobar y usar valores por defecto (`?? 0`, optional chaining, etc.) para no depender de que el backend envíe siempre todos los campos.
- **Evitar cambios de riesgo:** No alterar esquemas de BD, autenticación, pagos, anticipos u otros flujos críticos salvo que sea estrictamente necesario y esté acordado.

---

## Al hacer commit y desplegar

- **Commits solo de la tarea actual:** Incluir en el commit únicamente los archivos modificados para la funcionalidad que se está desarrollando. No mezclar cambios de otras áreas.
- **Mensajes de commit claros:** Indicar qué se arregla o qué feature se añade, sin mezclar temas en un mismo commit.
- **Verificación tras el deploy:** Comprobar que la funcionalidad tocada funciona y que el resto del sistema sigue respondiendo correctamente.

---

## Cambios más grandes (futuro)

- **Probar antes de producción:** Usar entorno local o staging para validar antes de desplegar a producción.
- **Cambios de esquema o contratos:** Hacerlo con migraciones controladas y, si aplica, con feature flags o despliegues por fases para reducir riesgo.

---

*Última actualización: enero 2025*
