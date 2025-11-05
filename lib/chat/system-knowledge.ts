/**
 * Sistema de Conocimiento del Sistema AIM
 * ==========================================
 * Este archivo contiene toda la información sobre el sistema
 * que Botty necesita para responder preguntas sobre funcionalidades,
 * arquitectura, módulos, flujos de trabajo, etc.
 */

export interface SystemKnowledge {
  architecture: string;
  modules: string;
  features: string;
  workflows: string;
  dataStructure: string;
  apis: string;
  permissions: string;
}

/**
 * Obtener conocimiento completo del sistema
 */
export function getSystemKnowledge(): SystemKnowledge {
  return {
    architecture: `
ARQUITECTURA DEL SISTEMA AIM (Sistema de Gestión):
==================================================
- Framework: Next.js 14 (App Router)
- Base de datos: Supabase (PostgreSQL)
- Autenticación: Supabase Auth
- Hosting: Vercel
- Estilo: Apple Style 2 (diseño moderno, minimalista, elegante)

COMPONENTES PRINCIPALES:
- Frontend: React + TypeScript + Tailwind CSS
- Backend: Next.js API Routes
- Base de datos: Supabase (PostgreSQL con RLS)
- Tiempo real: Supabase Realtime
- IA: Google Gemini API (para Botty)
`,

    modules: `
MÓDULOS DEL SISTEMA:
===================

1. AUTENTICACIÓN Y USUARIOS:
   - Sistema de roles: super_admin, admin, modelo
   - Grupos: Organización de usuarios por sedes/grupos
   - Permisos: Row Level Security (RLS) en Supabase
   - Autenticación con Supabase Auth

2. CALCULADORA:
   - Registro diario de ingresos por plataforma
   - Configuración de porcentajes por plataforma
   - Historial de cálculos
   - Totales automáticos
   - Períodos: diario, quincenal, mensual
   - Estados: activo, cerrado, archivado

3. ANTICIPOS:
   - Solicitud de anticipos por modelos
   - Aprobación/rechazo por administradores
   - Restricciones temporales (último día del mes anterior al 5 del siguiente, 15-20 de cada mes)
   - Historial de anticipos
   - Estados: pendiente, aprobado, rechazado, pagado

4. CHAT Y COMUNICACIÓN:
   - Chat bidireccional entre usuarios
   - AIM Botty (asistente con IA)
   - Notificaciones en tiempo real
   - Sistema de mensajes y conversaciones
   - Broadcasts (mensajes masivos)

5. PORTAFOLIO DE PLATAFORMAS:
   - Configuración de plataformas por modelo
   - Activación/desactivación de plataformas
   - Sincronización con plataformas disponibles

6. ANÁLISIS Y REPORTES:
   - Dashboard de productividad
   - Rankings de modelos
   - Análisis por grupos y sedes
   - Comparación de períodos
   - Estadísticas de calculadora

7. PUBLICACIONES Y ANUNCIOS:
   - Sistema de publicaciones (corcho informativo)
   - Targeting por grupos y roles
   - Publicaciones generales y específicas
   - Fijado de publicaciones

8. FACTURACIÓN:
   - Resumen de facturación
   - Cálculo automático de comisiones
   - Historial de facturación por período
`,

    features: `
FUNCIONALIDADES PRINCIPALES:
===========================

PARA MODELOS:
- Dashboard personal con resumen de ingresos
- Calculadora diaria de ingresos por plataforma
- Solicitud de anticipos
- Visualización de su portafolio de plataformas
- Chat con administradores y Botty
- Ver publicaciones dirigidas a sus grupos
- Historial de cálculos y anticipos
- Configuración de porcentajes y objetivos

PARA ADMINISTRADORES:
- Dashboard de gestión de grupos
- Gestión de modelos en sus grupos
- Aprobación/rechazo de anticipos
- Visualización de calculadoras de sus modelos
- Chat con modelos de sus grupos
- Publicaciones dirigidas a sus grupos
- Análisis de productividad de sus grupos
- Rankings de modelos en sus grupos

PARA SUPER ADMINISTRADORES:
- Dashboard completo del sistema
- Gestión de todas las sedes y grupos
- Gestión de usuarios (crear, editar, eliminar)
- Aprobación/rechazo de anticipos de cualquier modelo
- Visualización de todas las calculadoras
- Chat con cualquier usuario
- Publicaciones generales y dirigidas
- Análisis completo del sistema
- Rankings globales
- Gestión de plataformas del sistema
- Configuración de tasas de calculadora
`,

    workflows: `
FLUJOS DE TRABAJO PRINCIPALES:
===============================

1. REGISTRO DE INGRESOS (Modelos):
   - Modelo accede a "Mi Calculadora"
   - Ingresa valores diarios por plataforma
   - Sistema calcula totales automáticamente
   - Historial se guarda en calculator_history
   - Totales se actualizan en calculator_totals

2. SOLICITUD DE ANTICIPO (Modelos):
   - Modelo accede a "Solicitar Anticipo"
   - Sistema verifica restricciones temporales
   - Modelo completa formulario
   - Solicitud se crea con estado "pendiente"
   - Notificación a administradores

3. APROBACIÓN DE ANTICIPO (Admins):
   - Admin recibe notificación
   - Revisa solicitud en "Anticipos"
   - Aprueba o rechaza
   - Sistema notifica al modelo
   - Si se aprueba, se actualiza estado

4. CIERRE DE PERÍODO:
   - Admin/Super Admin cierra período
   - Sistema calcula totales finales
   - Período se marca como "cerrado"
   - Datos se archivan (si aplica)
   - Nuevo período inicia automáticamente

5. PUBLICACIÓN DE ANUNCIO:
   - Admin/Super Admin crea publicación
   - Define targeting (grupos, roles)
   - Publica inmediatamente o programa
   - Sistema notifica a usuarios afectados
   - Publicación aparece en dashboards

6. CHAT Y NOTIFICACIONES:
   - Usuario envía mensaje
   - Sistema verifica permisos
   - Mensaje se guarda en chat_messages
   - Realtime notifica a receptor
   - Si es para Botty, se genera respuesta con IA
   - Notificaciones visuales y sonoras
`,

    dataStructure: `
ESTRUCTURA DE DATOS PRINCIPAL:
==============================

TABLAS PRINCIPALES:

1. users:
   - id, name, email, role, created_at, etc.
   - Roles: super_admin, admin, modelo

2. groups:
   - id, name, organization_id, created_at
   - Organización de usuarios por sedes

3. user_groups:
   - user_id, group_id
   - Relación muchos a muchos

4. calculator_config:
   - user_id, platforms (JSON), percentages, objectives
   - Configuración de calculadora por modelo

5. calculator_history:
   - id, user_id, platform_id, value, date, period_type, created_at
   - Historial de ingresos diarios

6. calculator_totals:
   - user_id, period_type, period_start, period_end, total, is_closed
   - Totales por período

7. anticipos:
   - id, user_id, amount, reason, status, requested_at, reviewed_at, reviewed_by
   - Estados: pendiente, aprobado, rechazado, pagado

8. chat_conversations:
   - id, participant_1_id, participant_2_id, created_at, last_message_at
   - Conversaciones entre usuarios

9. chat_messages:
   - id, conversation_id, sender_id, content, message_type, created_at, is_read
   - Mensajes individuales

10. announcements:
    - id, author_id, title, content, is_published, is_pinned, target_groups, target_roles, created_at
    - Publicaciones del sistema

11. platforms:
    - id, name, currency, is_active
    - Plataformas disponibles en el sistema

12. rates:
    - id, platform_id, rate_type, rate_value, start_date, end_date
    - Tasas de calculadora por plataforma
`,

    apis: `
ENDPOINTS API PRINCIPALES:
==========================

AUTENTICACIÓN:
- /api/auth/* - Gestión de autenticación

CALCULADORA:
- GET /api/calculator/config - Obtener configuración
- POST /api/calculator/config - Guardar configuración
- GET /api/calculator/history - Obtener historial
- POST /api/calculator/history - Guardar entrada
- GET /api/calculator/totals - Obtener totales

ANTICIPOS:
- GET /api/anticipos - Listar anticipos
- POST /api/anticipos - Crear solicitud
- PUT /api/anticipos/[id] - Actualizar estado (aprobar/rechazar)
- DELETE /api/anticipos/[id] - Eliminar anticipo

CHAT:
- GET /api/chat/conversations - Listar conversaciones
- POST /api/chat/conversations - Crear conversación
- GET /api/chat/messages - Obtener mensajes
- POST /api/chat/messages - Enviar mensaje
- POST /api/chat/messages/read - Marcar como leído
- GET /api/chat/users - Listar usuarios disponibles
- POST /api/chat/aim-botty - Consultar Botty (analytics)
- POST /api/chat/broadcast - Enviar broadcast

USUARIOS:
- GET /api/admin/users - Listar usuarios
- POST /api/admin/users - Crear usuario
- PUT /api/admin/users/[id] - Actualizar usuario
- DELETE /api/admin/users/[id] - Eliminar usuario

PUBLICACIONES:
- GET /api/announcements - Listar publicaciones
- POST /api/announcements - Crear publicación
- PUT /api/announcements/[id] - Actualizar publicación
- DELETE /api/announcements/[id] - Eliminar publicación

ANÁLISIS:
- GET /api/admin/analytics/* - Endpoints de análisis y estadísticas
`,

    permissions: `
SISTEMA DE PERMISOS Y ROLES:
============================

SUPER ADMIN:
- Acceso completo a todo el sistema
- Gestión de usuarios, grupos, sedes
- Aprobación de anticipos de cualquier modelo
- Visualización de todas las calculadoras
- Chat con cualquier usuario
- Publicaciones generales y dirigidas
- Análisis completo del sistema
- Configuración de tasas y plataformas

ADMIN:
- Gestión de modelos en sus grupos asignados
- Aprobación de anticipos de modelos en sus grupos
- Visualización de calculadoras de sus modelos
- Chat con modelos de sus grupos
- Publicaciones dirigidas a sus grupos
- Análisis de productividad de sus grupos
- Rankings de modelos en sus grupos

MODELO:
- Gestión de su propia calculadora
- Solicitud de anticipos
- Visualización de su portafolio
- Chat con administradores y Botty
- Ver publicaciones dirigidas a sus grupos
- Visualización de sus propios datos
- Configuración de sus porcentajes y objetivos

RESTRICCIONES:
- Modelos solo pueden ver sus propios datos
- Modelos no pueden modificar configuraciones del sistema
- Modelos solo pueden recibir información sobre sus plataformas
- Admins solo pueden gestionar sus grupos asignados
- Row Level Security (RLS) en Supabase aplica restricciones a nivel de base de datos
`
  };
}

/**
 * Generar texto formateado del conocimiento del sistema
 * para incluir en el prompt de Botty
 */
export function formatSystemKnowledgeForPrompt(role: string): string {
  const knowledge = getSystemKnowledge();
  
  let knowledgeText = `
CONOCIMIENTO COMPLETO DEL SISTEMA AIM:
======================================

${knowledge.architecture}

${knowledge.modules}

${knowledge.features}

${knowledge.workflows}

${knowledge.dataStructure}

${knowledge.apis}

${knowledge.permissions}

INSTRUCCIONES PARA RESPONDER PREGUNTAS SOBRE EL SISTEMA:
========================================================
1. Usa este conocimiento para responder CUALQUIER pregunta sobre el sistema
2. Explica funcionalidades de manera clara y concisa
3. Si el usuario pregunta "cómo funciona X", explica el flujo completo
4. Si pregunta sobre permisos, menciona qué roles pueden hacer qué
5. Si pregunta sobre datos, explica qué tablas y campos se usan
6. Si pregunta sobre APIs, menciona los endpoints relevantes
7. Sé específico y técnico cuando sea necesario, pero mantén un tono conversacional
8. Si no sabes algo específico, di que puedes ayudar a investigar o escalar la pregunta
`;

  // Agregar información específica según el rol
  if (role === 'super_admin') {
    knowledgeText += `
CAPACIDADES ESPECIALES PARA SUPER ADMIN:
=========================================
- Puedes explicar cualquier parte del sistema en detalle
- Puedes proporcionar información sobre arquitectura técnica
- Puedes ayudar con troubleshooting y debugging
- Puedes explicar configuraciones avanzadas
- Tienes acceso completo para responder sobre cualquier módulo
`;
  } else if (role === 'admin') {
    knowledgeText += `
CAPACIDADES ESPECIALES PARA ADMIN:
===================================
- Puedes explicar funcionalidades relacionadas con gestión de grupos
- Puedes ayudar con aprobación de anticipos
- Puedes explicar análisis de productividad
- Puedes ayudar con publicaciones dirigidas
- Tienes acceso para responder sobre módulos de administración
`;
  }

  return knowledgeText;
}

