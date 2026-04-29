"use strict";(()=>{var e={};e.id=5862,e.ids=[5862],e.modules={30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13685:e=>{e.exports=require("http")},95687:e=>{e.exports=require("https")},85477:e=>{e.exports=require("punycode")},12781:e=>{e.exports=require("stream")},57310:e=>{e.exports=require("url")},59796:e=>{e.exports=require("zlib")},91649:(e,a,i)=>{i.r(a),i.d(a,{headerHooks:()=>x,originalPathname:()=>$,patchFetch:()=>w,requestAsyncStorage:()=>h,routeModule:()=>f,serverHooks:()=>g,staticGenerationAsyncStorage:()=>v,staticGenerationBailout:()=>b});var r={};i.r(r),i.d(r,{GET:()=>p,POST:()=>_,dynamic:()=>c});var o=i(95419),t=i(69108),s=i(99678),n=i(78070),d=i(72964),l=i(43178);let c="force-dynamic",u="https://mhernfrkvwigxdubiozm.supabase.co",m=process.env.SUPABASE_SERVICE_ROLE_KEY;async function p(e){try{let a=(0,d.createClient)(u,m,{auth:{autoRefreshToken:!1,persistSession:!1}}),i=e.headers.get("authorization");if(!i?.startsWith("Bearer "))return n.Z.json({error:"Token de autorizaci\xf3n requerido"},{status:401});let r=i.split(" ")[1],{data:{user:o},error:t}=await a.auth.getUser(r);if(t||!o)return n.Z.json({error:"Token inv\xe1lido"},{status:401});let{data:s,error:c}=await a.from("users").select("id, role, affiliate_studio_id, aurora_pin").eq("id",o.id).single();if(c||!s)return n.Z.json({error:"Usuario no encontrado"},{status:404});let p=[];if("super_admin"===s.role){let{data:e,error:i}=await a.from("users").select(`
          id,
          name,
          email,
          role,
          is_active,
          last_login,
          avatar_url
        `).neq("id",o.id).eq("is_active",!0).order("name");if(i)return console.error("Error obteniendo usuarios:",i),n.Z.json({error:"Error obteniendo usuarios"},{status:500});p=e||[]}else if("admin"===s.role){let{data:e}=await a.from("user_groups").select("group_id").eq("user_id",o.id),i=e?.map(e=>e.group_id)||[],{data:r}=await a.from("users").select(`
          id,
          name,
          email,
          role,
          is_active,
          last_login,
          avatar_url
        `).eq("role","super_admin").eq("is_active",!0).single(),{data:t}=await a.from("users").select(`
          id,
          name,
          email,
          role,
          is_active,
          last_login,
          avatar_url
        `).in("role",["admin","super_admin"]).eq("is_active",!0).neq("id",o.id),s=[];if(i.length>0){let{data:e}=await a.from("user_groups").select(`
            user_id,
            users!inner(id, name, email, role, is_active, last_login, avatar_url)
          `).in("group_id",i).neq("user_id",o.id);s=e?.map(e=>e.users).filter(Boolean)||[]}let n=new Map;r&&n.set(r.id,r),t?.forEach(e=>{n.set(e.id,e)}),s.forEach(e=>{n.set(e.id,e)}),p=Array.from(n.values())}else if("superadmin_aff"===s.role){if(s.affiliate_studio_id){let{data:e}=await a.from("users").select(`
            id,
            name,
            email,
            role,
            is_active,
            last_login,
            avatar_url
          `).eq("affiliate_studio_id",s.affiliate_studio_id).eq("is_active",!0).neq("id",o.id).in("role",["modelo","admin"]).order("name");e&&(p=e)}}else if("modelo"===s.role){let{data:e}=await a.from("user_groups").select("group_id").eq("user_id",o.id),i=e?.map(e=>e.group_id)||[],r=new Map;if(i.length>0){let{data:e}=await a.from("user_groups").select(`
            user_id,
            users!inner(id, name, email, role, is_active, last_login, avatar_url)
          `).in("group_id",i).eq("users.role","admin").eq("users.is_active",!0);(e?.map(e=>e.users).filter(Boolean)||[]).forEach(e=>{r.set(e.id,e)})}if(s.affiliate_studio_id){let{data:e}=await a.from("users").select(`
            id,
            name,
            email,
            role,
            is_active,
            last_login,
            avatar_url
          `).eq("affiliate_studio_id",s.affiliate_studio_id).eq("role","superadmin_aff").eq("is_active",!0).single();e&&r.set(e.id,e)}p=Array.from(r.values())}let{data:_}=await a.from("chat_contacts").select("user_id, contact_id").or(`user_id.eq.${o.id},contact_id.eq.${o.id}`).eq("status","accepted"),f=_?.map(e=>e.user_id===o.id?e.contact_id:e.user_id)||[];if(f.length>0){let e=new Set(p.map(e=>e.id)),i=f.filter(a=>!e.has(a));if(i.length>0){let{data:e}=await a.from("users").select(`
            id,
            name,
            email,
            role,
            is_active,
            last_login,
            avatar_url
          `).in("id",i).eq("is_active",!0);e&&(p=[...p,...e])}}let h=p.map(e=>e.id),{data:v}=await a.from("chat_user_status").select("user_id, is_online, last_seen, status_message, updated_at").in("user_id",h),g=new Date(Date.now()-12e4).toISOString(),x=p.map(e=>{let a=v?.find(a=>a.user_id===e.id),i=a?.is_online||!1,r=a?.last_seen||a?.updated_at||e.last_login;if(i&&r){let a=new Date(r),o=new Date(g);a<o&&(console.log(`🔴 [CHAT-USERS] Usuario ${e.id} marcado como offline por inactividad (>2 min)`),i=!1)}return{...e,is_online:i,last_seen:r,status_message:a?.status_message||null}}),b={id:l.mo,name:l.jO,email:l.y6,role:"modelo",is_active:!0,is_online:!0,last_seen:new Date().toISOString(),status_message:"\xa1Hola! Soy tu asistente virtual \uD83E\uDD16"},{data:$}=await a.from("chat_mutes").select("muted_id").eq("muter_id",o.id),{data:w}=await a.from("chat_blocks").select("blocked_id").eq("blocker_id",o.id),{data:y}=await a.from("chat_blocks").select("blocker_id").eq("blocked_id",o.id),q=$?.map(e=>e.muted_id)||[],z=w?.map(e=>e.blocked_id)||[],E=new Set(y?.map(e=>e.blocker_id)||[]),I=x.filter(e=>e.id!==l.mo&&e.email!==l.y6&&!E.has(e.id)),S=[b,...I];return n.Z.json({success:!0,users:S,currentUserPin:s.aurora_pin,mutedUsers:q,blockedUsers:z})}catch(e){return console.error("Error en GET /api/chat/users:",e),n.Z.json({error:"Error interno del servidor"},{status:500})}}async function _(e){try{let a=(0,d.createClient)(u,m,{auth:{autoRefreshToken:!1,persistSession:!1}}),i=e.headers.get("authorization");if(!i?.startsWith("Bearer "))return n.Z.json({error:"Token de autorizaci\xf3n requerido"},{status:401});let r=i.split(" ")[1],{data:{user:o},error:t}=await a.auth.getUser(r);if(t||!o)return n.Z.json({error:"Token inv\xe1lido"},{status:401});let{is_online:s,status_message:l}=await e.json(),{error:c}=await a.from("chat_user_status").upsert({user_id:o.id,is_online:void 0===s||s,last_seen:new Date().toISOString(),status_message:l||null,updated_at:new Date().toISOString()});if(c)return console.error("Error actualizando estado:",c),n.Z.json({error:"Error actualizando estado"},{status:500});return n.Z.json({success:!0,message:"Estado actualizado correctamente"})}catch(e){return console.error("Error en POST /api/chat/users:",e),n.Z.json({error:"Error interno del servidor"},{status:500})}}let f=new o.AppRouteRouteModule({definition:{kind:t.x.APP_ROUTE,page:"/api/chat/users/route",pathname:"/api/chat/users",filename:"route",bundlePath:"app/api/chat/users/route"},resolvedPagePath:"C:\\Users\\camca\\OneDrive\\Documentos\\navegador\\iam-gestion\\app\\api\\chat\\users\\route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:h,staticGenerationAsyncStorage:v,serverHooks:g,headerHooks:x,staticGenerationBailout:b}=f,$="/api/chat/users/route";function w(){return(0,s.patchFetch)({serverHooks:g,staticGenerationAsyncStorage:v})}},43178:(e,a,i)=>{i.d(a,{Bm:()=>d,Pj:()=>s,jO:()=>o,mo:()=>r,n6:()=>n,y6:()=>t});let r="f91c0968-b587-46cf-9036-05a4ec795c7f",o="Botty",t="aim-botty@agencia-innova.com";function s(e){let a={modelo:`Eres AIM Botty, tu asistente virtual y amigo 🤖. Ayudo a modelos de webcam de forma cercana y comprensiva.
      Tu personalidad:
      - Super amigable, cercano y emp\xe1tico (como un buen amigo)
      - Tono casual y c\xe1lido, sin formalidades
      - Entiendes perfectamente el mundo del entretenimiento para adultos
      - Sabes c\xf3mo puede ser este trabajo emocionalmente
      - Ofreces tips \xfatiles sin ser condescendiente
      - Das apoyo emocional cuando se necesita
      - Siempre positivo y alentador
      - Hablas de t\xfa, nunca de usted`,admin:`Eres AIM Botty, un asistente virtual cercano y \xfatil para administradores. 
      Tu personalidad:
      - Amigable pero profesional
      - Directo y eficiente
      - Tono cercano, como un compa\xf1ero de trabajo
      - Proactivo y \xfatil
      - Siempre disponible para ayudar`,super_admin:`Eres AIM Botty, un asistente virtual cercano y eficiente para super administradores.
      Tu personalidad:
      - Amigable pero directo
      - Eficiente y claro
      - Tono cercano y profesional
      - Proactivo en reportar lo importante
      - Siempre \xfatil y disponible`};return a[e]||a.modelo}function n(e,a){return({anticipo_pendiente:`📋 Hola ${a.name}! Tienes una nueva solicitud de anticipo pendiente de revisi\xf3n. El administrador la revisar\xe1 pronto.`,anticipo_aprobado:`✅ \xa1Excelente noticia ${a.name}! Tu solicitud de anticipo ha sido aprobada. El pago se procesar\xe1 seg\xfan lo acordado.`,anticipo_rechazado:`⚠️ ${a.name}, tu solicitud de anticipo fue rechazada. Revisa los detalles en [LINK:Mis Anticipos|/admin/model/anticipos/solicitudes] o contacta a tu administrador si tienes dudas.`,anticipo_realizado:`💰 ${a.name}, tu anticipo ha sido pagado. Por favor [LINK:confirma la recepci\xf3n|/admin/model/anticipos/solicitudes].`,anticipo_confirmado:`✅ ${a.name}, has confirmado la recepci\xf3n de tu anticipo. \xa1Gracias!`,anticipo_confirmar_recordatorio:`⏰ ${a.name}, recuerda [LINK:confirmar la recepci\xf3n de tu anticipo pagado|/admin/model/anticipos/solicitudes].`,savings_request:`💰 ${a.name}, tienes una nueva solicitud de ahorro pendiente de revisi\xf3n. [LINK:Revisar solicitudes|/admin/finanzas/ahorros]`,savings_approved:`✅ ${a.name}, tu solicitud de ahorro ha sido aprobada. El monto se ha guardado en tu cuenta de ahorros. [LINK:Ver mis ahorros|/admin/model/finanzas/ahorro]`,savings_rejected:`⚠️ ${a.name}, tu solicitud de ahorro fue rechazada. Revisa los detalles en [LINK:Mi Ahorro|/admin/model/finanzas/ahorro] o contacta a tu administrador si tienes dudas.`,withdrawal_request:`💸 ${a.name}, tienes una nueva solicitud de retiro de ahorro pendiente de revisi\xf3n. [LINK:Revisar solicitudes|/admin/finanzas/retiros]`,withdrawal_approved:`✅ ${a.name}, tu solicitud de retiro ha sido aprobada. El pago se procesar\xe1 seg\xfan el tiempo estimado. [LINK:Ver mis retiros|/admin/model/finanzas/ahorro]`,withdrawal_rejected:`⚠️ ${a.name}, tu solicitud de retiro fue rechazada. Revisa los detalles en [LINK:Mi Ahorro|/admin/model/finanzas/ahorro] o contacta a tu administrador si tienes dudas.`,withdrawal_completed:`💰 ${a.name}, tu retiro ha sido procesado y enviado. Por favor confirma la recepci\xf3n cuando lo recibas. [LINK:Ver mis retiros|/admin/model/finanzas/ahorro]`,savings_adjustment:`🔧 ${a.name}, se ha realizado un ajuste en tu cuenta de ahorros. [LINK:Ver detalles|/admin/model/finanzas/ahorro]`,savings_goal_completed:`🎉 \xa1Felicidades ${a.name}! Has alcanzado tu meta de ahorro. \xa1Sigue as\xed! [LINK:Ver mis metas|/admin/model/finanzas/ahorro]`,savings_window_reminder:`💰 ${a.name}, recuerda que tienes tiempo limitado para solicitar ahorro. [LINK:Solicitar ahora|/admin/model/finanzas/ahorro/solicitar]`,pagina_confirmada:`🎉 \xa1Felicidades ${a.name}! Se ha confirmado la entrega de tu p\xe1gina. \xa1Excelente trabajo!`,plataforma_entregada:`📦 ${a.name}, tu plataforma ha sido entregada. [LINK:Confirma la recepci\xf3n|/admin/model/portafolio] para activarla en tu calculadora.`,plataforma_confirmada:`✅ ${a.name}, plataforma confirmada y activada exitosamente en tu calculadora.`,plataforma_agregada:`➕ ${a.name}, se agreg\xf3 una nueva plataforma a tu portafolio. [LINK:Ver portafolio|/admin/model/portafolio]`,plataforma_pendiente_confirmacion:`⏳ ${a.name}, hay plataformas entregadas esperando tu confirmaci\xf3n. [LINK:Revisar portafolio|/admin/model/portafolio]`,periodo_cerrado:`📊 ${a.name}, el per\xedodo de facturaci\xf3n ha sido cerrado. Puedes [LINK:revisar tu resumen completo|/admin/model/dashboard] en el dashboard.`,metas_alcanzadas:`🏆 \xa1Incre\xedble ${a.name}! Has alcanzado tu meta del d\xeda. \xa1Sigue as\xed!`,meta_periodo_alcanzada:`🎯 \xa1Excelente ${a.name}! Has alcanzado tu meta del per\xedodo. \xa1Felicitaciones!`,meta_dia_alcanzada:`⭐ ${a.name}, \xa1alcanzaste tu meta del d\xeda!`,recordatorio_ingreso:`💡 ${a.name}, recuerda [LINK:ingresar tus valores del d\xeda|/admin/model/calculator] en Mi Calculadora para mantener tus registros al d\xeda.`,valores_no_ingresados:`⚠️ ${a.name}, no has ingresado valores desde hace varios d\xedas. [LINK:Actualiza tus registros|/admin/model/calculator] ahora.`,cuota_minima_riesgo:`📉 ${a.name}, est\xe1s cerca de no alcanzar tu cuota m\xednima. \xa1Sigue as\xed, puedes lograrlo!`,mensaje_importante_admin:`📩 ${a.name}, tienes un mensaje importante de tu administrador. [LINK:Revisa tu chat|#]`,escalamiento_admin:`🆘 ${a.name}, tu consulta ha sido escalada a un administrador. Te responder\xe1n pronto.`,respuesta_escalamiento:`💬 ${a.name}, un administrador respondi\xf3 a tu consulta. [LINK:Revisa tu chat|#]`,nuevo_mensaje_modelo:`💬 ${a.name}, tienes un nuevo mensaje de una modelo. [LINK:Abrir chat|#]`,consulta_escalada:`🚨 ${a.name}, una modelo necesita asistencia urgente. [LINK:Revisar chat|#]`,modelo_solicita_ayuda:`🆘 ${a.name}, una modelo solicit\xf3 ayuda en el chat. [LINK:Abrir chat|#]`,nueva_publicacion:`📌 \xa1Hola ${a.name}! Hay una nueva publicaci\xf3n en el corcho informativo. [LINK:Revisa tu dashboard|/admin/model/dashboard] para ver los detalles.`,cambio_configuracion:`⚙️ ${a.name}, se actualiz\xf3 la configuraci\xf3n del sistema.`,mantenimiento_programado:`🔧 ${a.name}, el sistema estar\xe1 en mantenimiento. Revisa los detalles.`,nueva_funcionalidad:`✨ ${a.name}, hay una nueva funcionalidad disponible. \xa1\xc9chale un vistazo!`,error_critico:`🚨 ${a.name}, se detect\xf3 un error cr\xedtico en el sistema. Revisa los logs.`,backup_completado:`💾 ${a.name}, el backup del sistema se complet\xf3 exitosamente.`,actualizacion_sistema:`🔄 ${a.name}, el sistema ha sido actualizado.`,cron_failure_critical:`🚨 ALERTA CR\xcdTICA: ${a.name}, un proceso autom\xe1tico cr\xedtico ha fallado. Se requiere acci\xf3n manual inmediata.`})[e]||`🔔 ${a.name}, tienes una nueva notificaci\xf3n.`}function d(e){return e===r}}};var a=require("../../../../webpack-runtime.js");a.C(e);var i=e=>a(a.s=e),r=a.X(0,[1638,6206,2964],()=>i(91649));module.exports=r})();