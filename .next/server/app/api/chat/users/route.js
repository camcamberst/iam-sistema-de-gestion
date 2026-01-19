"use strict";(()=>{var e={};e.id=5862,e.ids=[5862],e.modules={30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13685:e=>{e.exports=require("http")},95687:e=>{e.exports=require("https")},85477:e=>{e.exports=require("punycode")},12781:e=>{e.exports=require("stream")},57310:e=>{e.exports=require("url")},59796:e=>{e.exports=require("zlib")},9029:(e,a,i)=>{i.r(a),i.d(a,{headerHooks:()=>v,originalPathname:()=>y,patchFetch:()=>b,requestAsyncStorage:()=>_,routeModule:()=>f,serverHooks:()=>x,staticGenerationAsyncStorage:()=>g,staticGenerationBailout:()=>h});var o={};i.r(o),i.d(o,{GET:()=>m,POST:()=>p});var r=i(95419),t=i(69108),s=i(99678),n=i(78070),d=i(72964),l=i(43178);let u="https://mhernfrkvwigxdubiozm.supabase.co",c=process.env.SUPABASE_SERVICE_ROLE_KEY;async function m(e){try{let a=(0,d.createClient)(u,c,{auth:{autoRefreshToken:!1,persistSession:!1}}),i=e.headers.get("authorization");if(!i?.startsWith("Bearer "))return n.Z.json({error:"Token de autorizaci\xf3n requerido"},{status:401});let o=i.split(" ")[1],{data:{user:r},error:t}=await a.auth.getUser(o);if(t||!r)return n.Z.json({error:"Token inv\xe1lido"},{status:401});let{data:s,error:m}=await a.from("users").select("id, role, affiliate_studio_id").eq("id",r.id).single();if(m||!s)return n.Z.json({error:"Usuario no encontrado"},{status:404});let p=[];if("super_admin"===s.role){let{data:e,error:i}=await a.from("users").select(`
          id,
          name,
          email,
          role,
          is_active,
          last_login
        `).neq("id",r.id).eq("is_active",!0).order("name");if(i)return console.error("Error obteniendo usuarios:",i),n.Z.json({error:"Error obteniendo usuarios"},{status:500});p=e||[]}else if("admin"===s.role){let{data:e}=await a.from("user_groups").select("group_id").eq("user_id",r.id),i=e?.map(e=>e.group_id)||[],{data:o}=await a.from("users").select(`
          id,
          name,
          email,
          role,
          is_active,
          last_login
        `).eq("role","super_admin").eq("is_active",!0).single(),{data:t}=await a.from("users").select(`
          id,
          name,
          email,
          role,
          is_active,
          last_login
        `).in("role",["admin","super_admin"]).eq("is_active",!0).neq("id",r.id),s=[];if(i.length>0){let{data:e}=await a.from("user_groups").select(`
            user_id,
            users!inner(id, name, email, role, is_active, last_login)
          `).in("group_id",i).neq("user_id",r.id);s=e?.map(e=>e.users).filter(Boolean)||[]}let n=new Map;o&&n.set(o.id,o),t?.forEach(e=>{n.set(e.id,e)}),s.forEach(e=>{n.set(e.id,e)}),p=Array.from(n.values())}else if("superadmin_aff"===s.role){if(s.affiliate_studio_id){let{data:e}=await a.from("users").select(`
            id,
            name,
            email,
            role,
            is_active,
            last_login
          `).eq("affiliate_studio_id",s.affiliate_studio_id).eq("is_active",!0).neq("id",r.id).in("role",["modelo","admin"]).order("name");e&&(p=e)}}else if("modelo"===s.role){let{data:e}=await a.from("user_groups").select("group_id").eq("user_id",r.id),i=e?.map(e=>e.group_id)||[],o=new Map;if(i.length>0){let{data:e}=await a.from("user_groups").select(`
            user_id,
            users!inner(id, name, email, role, is_active, last_login)
          `).in("group_id",i).eq("users.role","admin").eq("users.is_active",!0);(e?.map(e=>e.users).filter(Boolean)||[]).forEach(e=>{o.set(e.id,e)})}if(s.affiliate_studio_id){let{data:e}=await a.from("users").select(`
            id,
            name,
            email,
            role,
            is_active,
            last_login
          `).eq("affiliate_studio_id",s.affiliate_studio_id).eq("role","superadmin_aff").eq("is_active",!0).single();e&&o.set(e.id,e)}p=Array.from(o.values())}let f=p.map(e=>e.id),{data:_}=await a.from("chat_user_status").select("user_id, is_online, last_seen, status_message, updated_at").in("user_id",f),g=new Date(Date.now()-12e4).toISOString(),x=p.map(e=>{let i=_?.find(a=>a.user_id===e.id),o=i?.is_online||!1,r=i?.last_seen||i?.updated_at||e.last_login;if(o&&r){let i=new Date(r),t=new Date(g);i<t&&(console.log(`🔴 [CHAT-USERS] Usuario ${e.id} marcado como offline por inactividad (>2 min)`),o=!1,(async()=>{try{let{error:i}=await a.from("chat_user_status").update({is_online:!1}).eq("user_id",e.id);i?console.error(`❌ [CHAT-USERS] Error actualizando usuario ${e.id} a offline:`,i):console.log(`✅ [CHAT-USERS] Usuario ${e.id} actualizado a offline por inactividad`)}catch(a){console.error(`❌ [CHAT-USERS] Error inesperado al actualizar usuario ${e.id} a offline:`,a)}})())}return{...e,is_online:o,last_seen:r,status_message:i?.status_message||null}}),v={id:l.mo,name:l.jO,email:l.y6,role:"modelo",is_active:!0,is_online:!0,last_seen:new Date().toISOString(),status_message:"\xa1Hola! Soy tu asistente virtual \uD83E\uDD16"},h=x.filter(e=>e.id!==l.mo&&e.email!==l.y6),y=[v,...h];return n.Z.json({success:!0,users:y})}catch(e){return console.error("Error en GET /api/chat/users:",e),n.Z.json({error:"Error interno del servidor"},{status:500})}}async function p(e){try{let a=(0,d.createClient)(u,c,{auth:{autoRefreshToken:!1,persistSession:!1}}),i=e.headers.get("authorization");if(!i?.startsWith("Bearer "))return n.Z.json({error:"Token de autorizaci\xf3n requerido"},{status:401});let o=i.split(" ")[1],{data:{user:r},error:t}=await a.auth.getUser(o);if(t||!r)return n.Z.json({error:"Token inv\xe1lido"},{status:401});let{is_online:s,status_message:l}=await e.json(),{error:m}=await a.from("chat_user_status").upsert({user_id:r.id,is_online:void 0===s||s,last_seen:new Date().toISOString(),status_message:l||null,updated_at:new Date().toISOString()});if(m)return console.error("Error actualizando estado:",m),n.Z.json({error:"Error actualizando estado"},{status:500});return n.Z.json({success:!0,message:"Estado actualizado correctamente"})}catch(e){return console.error("Error en POST /api/chat/users:",e),n.Z.json({error:"Error interno del servidor"},{status:500})}}let f=new r.AppRouteRouteModule({definition:{kind:t.x.APP_ROUTE,page:"/api/chat/users/route",pathname:"/api/chat/users",filename:"route",bundlePath:"app/api/chat/users/route"},resolvedPagePath:"C:\\Users\\camca\\OneDrive\\Documentos\\GitHub\\iam-sistema-de-gestion\\app\\api\\chat\\users\\route.ts",nextConfigOutput:"",userland:o}),{requestAsyncStorage:_,staticGenerationAsyncStorage:g,serverHooks:x,headerHooks:v,staticGenerationBailout:h}=f,y="/api/chat/users/route";function b(){return(0,s.patchFetch)({serverHooks:x,staticGenerationAsyncStorage:g})}},43178:(e,a,i)=>{i.d(a,{Bm:()=>d,Pj:()=>s,jO:()=>r,mo:()=>o,n6:()=>n,y6:()=>t});let o="f91c0968-b587-46cf-9036-05a4ec795c7f",r="AIM Botty",t="aim-botty@agencia-innova.com";function s(e){let a={modelo:`Eres AIM Botty, tu asistente virtual y amigo 🤖. Ayudo a modelos de webcam de forma cercana y comprensiva.
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
      - Siempre \xfatil y disponible`};return a[e]||a.modelo}function n(e,a){return({anticipo_pendiente:`📋 Hola ${a.name}! Tienes una nueva solicitud de anticipo pendiente de revisi\xf3n. El administrador la revisar\xe1 pronto.`,anticipo_aprobado:`✅ \xa1Excelente noticia ${a.name}! Tu solicitud de anticipo ha sido aprobada. El pago se procesar\xe1 seg\xfan lo acordado.`,anticipo_rechazado:`⚠️ ${a.name}, tu solicitud de anticipo fue rechazada. Revisa los detalles en [LINK:Mis Anticipos|/admin/model/anticipos/solicitudes] o contacta a tu administrador si tienes dudas.`,anticipo_realizado:`💰 ${a.name}, tu anticipo ha sido pagado. Por favor [LINK:confirma la recepci\xf3n|/admin/model/anticipos/solicitudes].`,anticipo_confirmado:`✅ ${a.name}, has confirmado la recepci\xf3n de tu anticipo. \xa1Gracias!`,anticipo_confirmar_recordatorio:`⏰ ${a.name}, recuerda [LINK:confirmar la recepci\xf3n de tu anticipo pagado|/admin/model/anticipos/solicitudes].`,pagina_confirmada:`🎉 \xa1Felicidades ${a.name}! Se ha confirmado la entrega de tu p\xe1gina. \xa1Excelente trabajo!`,plataforma_entregada:`📦 ${a.name}, tu plataforma ha sido entregada. [LINK:Confirma la recepci\xf3n|/admin/model/portafolio] para activarla en tu calculadora.`,plataforma_confirmada:`✅ ${a.name}, plataforma confirmada y activada exitosamente en tu calculadora.`,plataforma_agregada:`➕ ${a.name}, se agreg\xf3 una nueva plataforma a tu portafolio. [LINK:Ver portafolio|/admin/model/portafolio]`,plataforma_pendiente_confirmacion:`⏳ ${a.name}, hay plataformas entregadas esperando tu confirmaci\xf3n. [LINK:Revisar portafolio|/admin/model/portafolio]`,periodo_cerrado:`📊 ${a.name}, el per\xedodo de facturaci\xf3n ha sido cerrado. Puedes [LINK:revisar tu resumen completo|/admin/model/dashboard] en el dashboard.`,metas_alcanzadas:`🏆 \xa1Incre\xedble ${a.name}! Has alcanzado tu meta del d\xeda. \xa1Sigue as\xed!`,meta_periodo_alcanzada:`🎯 \xa1Excelente ${a.name}! Has alcanzado tu meta del per\xedodo. \xa1Felicitaciones!`,meta_dia_alcanzada:`⭐ ${a.name}, \xa1alcanzaste tu meta del d\xeda!`,recordatorio_ingreso:`💡 ${a.name}, recuerda [LINK:ingresar tus valores del d\xeda|/admin/model/calculator] en Mi Calculadora para mantener tus registros al d\xeda.`,valores_no_ingresados:`⚠️ ${a.name}, no has ingresado valores desde hace varios d\xedas. [LINK:Actualiza tus registros|/admin/model/calculator] ahora.`,cuota_minima_riesgo:`📉 ${a.name}, est\xe1s cerca de no alcanzar tu cuota m\xednima. \xa1Sigue as\xed, puedes lograrlo!`,mensaje_importante_admin:`📩 ${a.name}, tienes un mensaje importante de tu administrador. [LINK:Revisa tu chat|#]`,escalamiento_admin:`🆘 ${a.name}, tu consulta ha sido escalada a un administrador. Te responder\xe1n pronto.`,respuesta_escalamiento:`💬 ${a.name}, un administrador respondi\xf3 a tu consulta. [LINK:Revisa tu chat|#]`,nuevo_mensaje_modelo:`💬 ${a.name}, tienes un nuevo mensaje de una modelo. [LINK:Abrir chat|#]`,consulta_escalada:`🚨 ${a.name}, una modelo necesita asistencia urgente. [LINK:Revisar chat|#]`,modelo_solicita_ayuda:`🆘 ${a.name}, una modelo solicit\xf3 ayuda en el chat. [LINK:Abrir chat|#]`,nueva_publicacion:`📌 \xa1Hola ${a.name}! Hay una nueva publicaci\xf3n en el corcho informativo. [LINK:Revisa tu dashboard|/admin/model/dashboard] para ver los detalles.`,cambio_configuracion:`⚙️ ${a.name}, se actualiz\xf3 la configuraci\xf3n del sistema.`,mantenimiento_programado:`🔧 ${a.name}, el sistema estar\xe1 en mantenimiento. Revisa los detalles.`,nueva_funcionalidad:`✨ ${a.name}, hay una nueva funcionalidad disponible. \xa1\xc9chale un vistazo!`,error_critico:`🚨 ${a.name}, se detect\xf3 un error cr\xedtico en el sistema. Revisa los logs.`,backup_completado:`💾 ${a.name}, el backup del sistema se complet\xf3 exitosamente.`,actualizacion_sistema:`🔄 ${a.name}, el sistema ha sido actualizado.`})[e]||`🔔 ${a.name}, tienes una nueva notificaci\xf3n.`}function d(e){return e===o}}};var a=require("../../../../webpack-runtime.js");a.C(e);var i=e=>a(a.s=e),o=a.X(0,[1638,6206,2964],()=>i(9029));module.exports=o})();