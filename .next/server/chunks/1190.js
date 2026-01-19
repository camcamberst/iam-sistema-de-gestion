"use strict";exports.id=1190,exports.ids=[1190],exports.modules={31190:(a,e,i)=>{i.d(e,{formatSystemKnowledgeForPrompt:()=>s});function s(a){let e={architecture:`
ARQUITECTURA DEL SISTEMA AIM (Sistema de Gesti\xf3n):
==================================================
- Framework: Next.js 14 (App Router)
- Base de datos: Supabase (PostgreSQL)
- Autenticaci\xf3n: Supabase Auth
- Hosting: Vercel
- Estilo: Apple Style 2 (dise\xf1o moderno, minimalista, elegante)

COMPONENTES PRINCIPALES:
- Frontend: React + TypeScript + Tailwind CSS
- Backend: Next.js API Routes
- Base de datos: Supabase (PostgreSQL con RLS)
- Tiempo real: Supabase Realtime
- IA: Google Gemini API (para Botty)
`,modules:`
M\xd3DULOS DEL SISTEMA:
===================

1. AUTENTICACI\xd3N Y USUARIOS:
   - Sistema de roles: super_admin, admin, modelo
   - Grupos: Organizaci\xf3n de usuarios por sedes/grupos
   - Permisos: Row Level Security (RLS) en Supabase
   - Autenticaci\xf3n con Supabase Auth

2. CALCULADORA:
   - Registro diario de ingresos por plataforma
   - Configuraci\xf3n de porcentajes por plataforma
   - Historial de c\xe1lculos
   - Totales autom\xe1ticos
   - Per\xedodos: diario, quincenal, mensual
   - Estados: activo, cerrado, archivado

3. ANTICIPOS:
   - Solicitud de anticipos por modelos
   - Aprobaci\xf3n/rechazo por administradores
   - Restricciones temporales (\xfaltimo d\xeda del mes anterior al 5 del siguiente, 15-20 de cada mes)
   - Historial de anticipos
   - Estados: pendiente, aprobado, rechazado, pagado

4. CHAT Y COMUNICACI\xd3N:
   - Chat bidireccional entre usuarios
   - AIM Botty (asistente con IA)
   - Notificaciones en tiempo real
   - Sistema de mensajes y conversaciones
   - Broadcasts (mensajes masivos)

5. PORTAFOLIO DE PLATAFORMAS:
   - Configuraci\xf3n de plataformas por modelo
   - Activaci\xf3n/desactivaci\xf3n de plataformas
   - Sincronizaci\xf3n con plataformas disponibles

6. AN\xc1LISIS Y REPORTES:
   - Dashboard de productividad
   - Rankings de modelos
   - An\xe1lisis por grupos y sedes
   - Comparaci\xf3n de per\xedodos
   - Estad\xedsticas de calculadora

7. PUBLICACIONES Y ANUNCIOS:
   - Sistema de publicaciones (corcho informativo)
   - Targeting por grupos y roles
   - Publicaciones generales y espec\xedficas
   - Fijado de publicaciones

8. FACTURACI\xd3N:
   - Resumen de facturaci\xf3n
   - C\xe1lculo autom\xe1tico de comisiones
   - Historial de facturaci\xf3n por per\xedodo
`,features:`
FUNCIONALIDADES PRINCIPALES:
===========================

PARA MODELOS:
- Dashboard personal con resumen de ingresos
- Calculadora diaria de ingresos por plataforma
- Solicitud de anticipos
- Visualizaci\xf3n de su portafolio de plataformas
- Chat con administradores y Botty
- Ver publicaciones dirigidas a sus grupos
- Historial de c\xe1lculos y anticipos
- Configuraci\xf3n de porcentajes y objetivos

PARA ADMINISTRADORES:
- Dashboard de gesti\xf3n de grupos
- Gesti\xf3n de modelos en sus grupos
- Aprobaci\xf3n/rechazo de anticipos
- Visualizaci\xf3n de calculadoras de sus modelos
- Chat con modelos de sus grupos
- Publicaciones dirigidas a sus grupos
- An\xe1lisis de productividad de sus grupos
- Rankings de modelos en sus grupos

PARA SUPER ADMINISTRADORES:
- Dashboard completo del sistema
- Gesti\xf3n de todas las sedes y grupos
- Gesti\xf3n de usuarios (crear, editar, eliminar)
- Aprobaci\xf3n/rechazo de anticipos de cualquier modelo
- Visualizaci\xf3n de todas las calculadoras
- Chat con cualquier usuario
- Publicaciones generales y dirigidas
- An\xe1lisis completo del sistema
- Rankings globales
- Gesti\xf3n de plataformas del sistema
- Configuraci\xf3n de tasas de calculadora
`,workflows:`
FLUJOS DE TRABAJO PRINCIPALES:
===============================

1. REGISTRO DE INGRESOS (Modelos):
   - Modelo accede a "Mi Calculadora"
   - Ingresa valores diarios por plataforma
   - Sistema calcula totales autom\xe1ticamente
   - Historial se guarda en calculator_history
   - Totales se actualizan en calculator_totals

2. SOLICITUD DE ANTICIPO (Modelos):
   - Modelo accede a "Solicitar Anticipo"
   - Sistema verifica restricciones temporales
   - Modelo completa formulario
   - Solicitud se crea con estado "pendiente"
   - Notificaci\xf3n a administradores

3. APROBACI\xd3N DE ANTICIPO (Admins):
   - Admin recibe notificaci\xf3n
   - Revisa solicitud en "Anticipos"
   - Aprueba o rechaza
   - Sistema notifica al modelo
   - Si se aprueba, se actualiza estado

4. CIERRE DE PER\xcdODO:
   - Admin/Super Admin cierra per\xedodo
   - Sistema calcula totales finales
   - Per\xedodo se marca como "cerrado"
   - Datos se archivan (si aplica)
   - Nuevo per\xedodo inicia autom\xe1ticamente

5. PUBLICACI\xd3N DE ANUNCIO:
   - Admin/Super Admin crea publicaci\xf3n
   - Define targeting (grupos, roles)
   - Publica inmediatamente o programa
   - Sistema notifica a usuarios afectados
   - Publicaci\xf3n aparece en dashboards

6. CHAT Y NOTIFICACIONES:
   - Usuario env\xeda mensaje
   - Sistema verifica permisos
   - Mensaje se guarda en chat_messages
   - Realtime notifica a receptor
   - Si es para Botty, se genera respuesta con IA
   - Notificaciones visuales y sonoras
`,dataStructure:`
ESTRUCTURA DE DATOS PRINCIPAL:
==============================

TABLAS PRINCIPALES:

1. users:
   - id, name, email, role, created_at, etc.
   - Roles: super_admin, admin, modelo

2. groups:
   - id, name, organization_id, created_at
   - Organizaci\xf3n de usuarios por sedes

3. user_groups:
   - user_id, group_id
   - Relaci\xf3n muchos a muchos

4. calculator_config:
   - user_id, platforms (JSON), percentages, objectives
   - Configuraci\xf3n de calculadora por modelo

5. calculator_history:
   - id, user_id, platform_id, value, date, period_type, created_at
   - Historial de ingresos diarios

6. calculator_totals:
   - user_id, period_type, period_start, period_end, total, is_closed
   - Totales por per\xedodo

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
`,apis:`
ENDPOINTS API PRINCIPALES:
==========================

AUTENTICACI\xd3N:
- /api/auth/* - Gesti\xf3n de autenticaci\xf3n

CALCULADORA:
- GET /api/calculator/config - Obtener configuraci\xf3n
- POST /api/calculator/config - Guardar configuraci\xf3n
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
- POST /api/chat/conversations - Crear conversaci\xf3n
- GET /api/chat/messages - Obtener mensajes
- POST /api/chat/messages - Enviar mensaje
- POST /api/chat/messages/read - Marcar como le\xeddo
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
- POST /api/announcements - Crear publicaci\xf3n
- PUT /api/announcements/[id] - Actualizar publicaci\xf3n
- DELETE /api/announcements/[id] - Eliminar publicaci\xf3n

AN\xc1LISIS:
- GET /api/admin/analytics/* - Endpoints de an\xe1lisis y estad\xedsticas
`,permissions:`
SISTEMA DE PERMISOS Y ROLES:
============================

SUPER ADMIN:
- Acceso completo a todo el sistema
- Gesti\xf3n de usuarios, grupos, sedes
- Aprobaci\xf3n de anticipos de cualquier modelo
- Visualizaci\xf3n de todas las calculadoras
- Chat con cualquier usuario
- Publicaciones generales y dirigidas
- An\xe1lisis completo del sistema
- Configuraci\xf3n de tasas y plataformas

ADMIN:
- Gesti\xf3n de modelos en sus grupos asignados
- Aprobaci\xf3n de anticipos de modelos en sus grupos
- Visualizaci\xf3n de calculadoras de sus modelos
- Chat con modelos de sus grupos
- Publicaciones dirigidas a sus grupos
- An\xe1lisis de productividad de sus grupos
- Rankings de modelos en sus grupos

MODELO:
- Gesti\xf3n de su propia calculadora
- Solicitud de anticipos
- Visualizaci\xf3n de su portafolio
- Chat con administradores y Botty
- Ver publicaciones dirigidas a sus grupos
- Visualizaci\xf3n de sus propios datos
- Configuraci\xf3n de sus porcentajes y objetivos

RESTRICCIONES:
- Modelos solo pueden ver sus propios datos
- Modelos no pueden modificar configuraciones del sistema
- Modelos solo pueden recibir informaci\xf3n sobre sus plataformas
- Admins solo pueden gestionar sus grupos asignados
- Row Level Security (RLS) en Supabase aplica restricciones a nivel de base de datos
`},i=`
CONOCIMIENTO COMPLETO DEL SISTEMA AIM:
======================================

${e.architecture}

${e.modules}

${e.features}

${e.workflows}

${e.dataStructure}

${e.apis}

${e.permissions}

INSTRUCCIONES PARA RESPONDER PREGUNTAS SOBRE EL SISTEMA:
========================================================
1. Usa este conocimiento para responder CUALQUIER pregunta sobre el sistema
2. Explica funcionalidades de manera clara y concisa
3. Si el usuario pregunta "c\xf3mo funciona X", explica el flujo completo
4. Si pregunta sobre permisos, menciona qu\xe9 roles pueden hacer qu\xe9
5. Si pregunta sobre datos, explica qu\xe9 tablas y campos se usan
6. Si pregunta sobre APIs, menciona los endpoints relevantes
7. S\xe9 espec\xedfico y t\xe9cnico cuando sea necesario, pero mant\xe9n un tono conversacional
8. Si no sabes algo espec\xedfico, di que puedes ayudar a investigar o escalar la pregunta
`;return"super_admin"===a?i+=`
CAPACIDADES ESPECIALES PARA SUPER ADMIN:
=========================================
- Puedes explicar cualquier parte del sistema en detalle
- Puedes proporcionar informaci\xf3n sobre arquitectura t\xe9cnica
- Puedes ayudar con troubleshooting y debugging
- Puedes explicar configuraciones avanzadas
- Tienes acceso completo para responder sobre cualquier m\xf3dulo
`:"admin"===a&&(i+=`
CAPACIDADES ESPECIALES PARA ADMIN:
===================================
- Puedes explicar funcionalidades relacionadas con gesti\xf3n de grupos
- Puedes ayudar con aprobaci\xf3n de anticipos
- Puedes explicar an\xe1lisis de productividad
- Puedes ayudar con publicaciones dirigidas
- Tienes acceso para responder sobre m\xf3dulos de administraci\xf3n
`),i}}};