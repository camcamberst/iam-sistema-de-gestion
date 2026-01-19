"use strict";exports.id=4528,exports.ids=[4528],exports.modules={31057:(e,a,o)=>{o.d(a,{DN:()=>s,iu:()=>d,sJ:()=>r});class t{get(e){let a=this.cache.get(e);return a?Date.now()>a.expiresAt?(this.cache.delete(e),null):a.data:null}set(e,a,o){let t=Date.now(),r=t+(o||this.defaultTTL);this.cache.set(e,{data:a,timestamp:t,expiresAt:r})}invalidate(e){this.cache.delete(e)}invalidatePattern(e){for(let a of Array.from(this.cache.keys()))e.test(a)&&this.cache.delete(a)}cleanup(){let e=Date.now();for(let[a,o]of Array.from(this.cache.entries()))e>o.expiresAt&&this.cache.delete(a)}clear(){this.cache.clear()}getStats(){return this.cleanup(),{size:this.cache.size,keys:Array.from(this.cache.keys())}}constructor(){this.cache=new Map,this.defaultTTL=6e4}}let r=new t;async function s(e,a,o){let t=r.get(e);if(null!==t)return console.log(`💾 [CACHE] Hit: ${e}`),t;console.log(`🔄 [CACHE] Miss: ${e}`);let s=await a();return r.set(e,s,o),s}function d(e,a){let o=Object.keys(a).sort().map(e=>`${e}:${a[e]}`).join("|");return`${e}|${o}`}setInterval(()=>{r.cleanup()},3e5)},43178:(e,a,o)=>{o.d(a,{Bm:()=>n,Pj:()=>d,jO:()=>r,mo:()=>t,n6:()=>i,y6:()=>s});let t="f91c0968-b587-46cf-9036-05a4ec795c7f",r="AIM Botty",s="aim-botty@agencia-innova.com";function d(e){let a={modelo:`Eres AIM Botty, tu asistente virtual y amigo 🤖. Ayudo a modelos de webcam de forma cercana y comprensiva.
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
      - Siempre \xfatil y disponible`};return a[e]||a.modelo}function i(e,a){return({anticipo_pendiente:`📋 Hola ${a.name}! Tienes una nueva solicitud de anticipo pendiente de revisi\xf3n. El administrador la revisar\xe1 pronto.`,anticipo_aprobado:`✅ \xa1Excelente noticia ${a.name}! Tu solicitud de anticipo ha sido aprobada. El pago se procesar\xe1 seg\xfan lo acordado.`,anticipo_rechazado:`⚠️ ${a.name}, tu solicitud de anticipo fue rechazada. Revisa los detalles en [LINK:Mis Anticipos|/admin/model/anticipos/solicitudes] o contacta a tu administrador si tienes dudas.`,anticipo_realizado:`💰 ${a.name}, tu anticipo ha sido pagado. Por favor [LINK:confirma la recepci\xf3n|/admin/model/anticipos/solicitudes].`,anticipo_confirmado:`✅ ${a.name}, has confirmado la recepci\xf3n de tu anticipo. \xa1Gracias!`,anticipo_confirmar_recordatorio:`⏰ ${a.name}, recuerda [LINK:confirmar la recepci\xf3n de tu anticipo pagado|/admin/model/anticipos/solicitudes].`,pagina_confirmada:`🎉 \xa1Felicidades ${a.name}! Se ha confirmado la entrega de tu p\xe1gina. \xa1Excelente trabajo!`,plataforma_entregada:`📦 ${a.name}, tu plataforma ha sido entregada. [LINK:Confirma la recepci\xf3n|/admin/model/portafolio] para activarla en tu calculadora.`,plataforma_confirmada:`✅ ${a.name}, plataforma confirmada y activada exitosamente en tu calculadora.`,plataforma_agregada:`➕ ${a.name}, se agreg\xf3 una nueva plataforma a tu portafolio. [LINK:Ver portafolio|/admin/model/portafolio]`,plataforma_pendiente_confirmacion:`⏳ ${a.name}, hay plataformas entregadas esperando tu confirmaci\xf3n. [LINK:Revisar portafolio|/admin/model/portafolio]`,periodo_cerrado:`📊 ${a.name}, el per\xedodo de facturaci\xf3n ha sido cerrado. Puedes [LINK:revisar tu resumen completo|/admin/model/dashboard] en el dashboard.`,metas_alcanzadas:`🏆 \xa1Incre\xedble ${a.name}! Has alcanzado tu meta del d\xeda. \xa1Sigue as\xed!`,meta_periodo_alcanzada:`🎯 \xa1Excelente ${a.name}! Has alcanzado tu meta del per\xedodo. \xa1Felicitaciones!`,meta_dia_alcanzada:`⭐ ${a.name}, \xa1alcanzaste tu meta del d\xeda!`,recordatorio_ingreso:`💡 ${a.name}, recuerda [LINK:ingresar tus valores del d\xeda|/admin/model/calculator] en Mi Calculadora para mantener tus registros al d\xeda.`,valores_no_ingresados:`⚠️ ${a.name}, no has ingresado valores desde hace varios d\xedas. [LINK:Actualiza tus registros|/admin/model/calculator] ahora.`,cuota_minima_riesgo:`📉 ${a.name}, est\xe1s cerca de no alcanzar tu cuota m\xednima. \xa1Sigue as\xed, puedes lograrlo!`,mensaje_importante_admin:`📩 ${a.name}, tienes un mensaje importante de tu administrador. [LINK:Revisa tu chat|#]`,escalamiento_admin:`🆘 ${a.name}, tu consulta ha sido escalada a un administrador. Te responder\xe1n pronto.`,respuesta_escalamiento:`💬 ${a.name}, un administrador respondi\xf3 a tu consulta. [LINK:Revisa tu chat|#]`,nuevo_mensaje_modelo:`💬 ${a.name}, tienes un nuevo mensaje de una modelo. [LINK:Abrir chat|#]`,consulta_escalada:`🚨 ${a.name}, una modelo necesita asistencia urgente. [LINK:Revisar chat|#]`,modelo_solicita_ayuda:`🆘 ${a.name}, una modelo solicit\xf3 ayuda en el chat. [LINK:Abrir chat|#]`,nueva_publicacion:`📌 \xa1Hola ${a.name}! Hay una nueva publicaci\xf3n en el corcho informativo. [LINK:Revisa tu dashboard|/admin/model/dashboard] para ver los detalles.`,cambio_configuracion:`⚙️ ${a.name}, se actualiz\xf3 la configuraci\xf3n del sistema.`,mantenimiento_programado:`🔧 ${a.name}, el sistema estar\xe1 en mantenimiento. Revisa los detalles.`,nueva_funcionalidad:`✨ ${a.name}, hay una nueva funcionalidad disponible. \xa1\xc9chale un vistazo!`,error_critico:`🚨 ${a.name}, se detect\xf3 un error cr\xedtico en el sistema. Revisa los logs.`,backup_completado:`💾 ${a.name}, el backup del sistema se complet\xf3 exitosamente.`,actualizacion_sistema:`🔄 ${a.name}, el sistema ha sido actualizado.`})[e]||`🔔 ${a.name}, tienes una nueva notificaci\xf3n.`}function n(e){return e===t}},84528:(e,a,o)=>{o.d(a,{_:()=>i});var t=o(72964),r=o(43178),s=o(31057);let d=process.env.SUPABASE_SERVICE_ROLE_KEY;async function i(e,a,o){let r=(0,t.createClient)("https://mhernfrkvwigxdubiozm.supabase.co",d,{auth:{autoRefreshToken:!1,persistSession:!1}});try{var s;if(s=e.type,!("super_admin"===o||("admin"===o?["productivity_by_group","top_models","productivity_trend","group_ranking","model_statistics"].includes(s):"modelo"===o&&"model_statistics"===s)))return{success:!1,error:`No tienes permisos para ejecutar esta consulta anal\xedtica: ${e.type}`};switch(e.type){case"productivity_by_sede":return await n(r,e.params,o,a);case"productivity_by_group":return await l(r,e.params,o,a);case"top_models":return await u(r,e.params,o,a);case"productivity_trend":return await c(r,e.params,o,a);case"period_comparison":return await m(r,e.params,o,a);case"group_ranking":return await p(r,e.params,o,a);case"sede_ranking":return await _(r,e.params,o,a);case"model_statistics":return await f(r,e.params,o,a);default:return{success:!1,error:`Tipo de consulta no reconocida: ${e.type}`}}}catch(e){return console.error("❌ [BOT-ANALYTICS] Error ejecutando consulta:",e),{success:!1,error:e.message||"Error ejecutando consulta anal\xedtica"}}}async function n(e,a,o,t){try{let o=a?.months||6,t=a?.startDate||new Date(Date.now()-2592e6*o).toISOString().split("T")[0],d=a?.endDate||new Date().toISOString().split("T")[0],i=(0,s.iu)("productivity_by_sede",{startDate:t,endDate:d});return await (0,s.DN)(i,async()=>{try{console.log("\uD83D\uDCCA [BOT-ANALYTICS] Productividad por sede:",{startDate:t,endDate:d});let{data:a,error:s}=await e.from("calculator_history").select(`
              period_date,
              period_type,
              model_id,
              value_usd_bruto,
              value_usd_modelo,
              value_cop_modelo,
              users!inner(
                id,
                email,
                name,
                organization_id,
                user_groups(
                  groups!inner(
                    id,
                    name,
                    organization_id
                  )
                )
              )
            `).gte("period_date",t).lte("period_date",d).neq("model_id",r.mo);if(s)return console.error("❌ [BOT-ANALYTICS] Error obteniendo historial:",s),{success:!1,error:"Error obteniendo datos hist\xf3ricos"};let i=new Map,n=Array.from(new Set(a?.map(e=>e.users?.organization_id).filter(Boolean)||[])),{data:l}=await e.from("organizations").select("id, name").in("id",n.length>0?n:["00000000-0000-0000-0000-000000000000"]),u=new Map;l?.forEach(e=>{u.set(e.id,e.name)}),a?.forEach(e=>{let a=e.users?.organization_id||"unknown",o=u.get(a)||"Sede Desconocida",t=`${e.period_date}-${e.period_type}`;i.has(a)||i.set(a,{sedeId:a,sedeName:o,totalUsdBruto:0,totalUsdModelo:0,totalCopModelo:0,totalModels:new Set,periods:new Set});let r=i.get(a);r.totalUsdBruto+=Number(e.value_usd_bruto||0),r.totalUsdModelo+=Number(e.value_usd_modelo||0),r.totalCopModelo+=Number(e.value_cop_modelo||0),r.totalModels.add(e.model_id),r.periods.add(t)});let c=Array.from(i.values()).map(e=>({sedeId:e.sedeId,sedeName:e.sedeName,totalUsdBruto:e.totalUsdBruto,totalUsdModelo:e.totalUsdModelo,totalCopModelo:e.totalCopModelo,totalUsdSede:e.totalUsdBruto-e.totalUsdModelo,totalModels:e.totalModels.size,totalPeriods:e.periods.size,averageUsdBrutoPerPeriod:e.totalUsdBruto/(e.periods.size||1)})).sort((e,a)=>a.totalUsdBruto-e.totalUsdBruto);return{success:!0,data:c,message:`An\xe1lisis de productividad por sede para los \xfaltimos ${o} meses`}}catch(e){return{success:!1,error:e.message}}},6e5)}catch(e){return{success:!1,error:e.message}}}async function l(e,a,o,t){try{let s=a?.months||6,d=a?.startDate||new Date(Date.now()-2592e6*s).toISOString().split("T")[0],i=a?.endDate||new Date().toISOString().split("T")[0],n=[];if("admin"===o){let{data:a}=await e.from("user_groups").select("group_id").eq("user_id",t);n=(a||[]).map(e=>e.group_id)}let{data:l,error:u}=await e.from("calculator_history").select(`
        period_date,
        period_type,
        model_id,
        value_usd_bruto,
        value_usd_modelo,
        value_cop_modelo,
        users!inner(
          id,
          user_groups(
            groups!inner(
              id,
              name
            )
          )
        )
      `).gte("period_date",d).lte("period_date",i).neq("model_id",r.mo);if(u)return{success:!1,error:"Error obteniendo datos hist\xf3ricos"};let c=new Map;l?.forEach(e=>{(e.users?.user_groups||[]).forEach(a=>{let t=a.groups;if(!t||"admin"===o&&!n.includes(t.id))return;let r=t.id,s=t.name;c.has(r)||c.set(r,{groupId:r,groupName:s,totalUsdBruto:0,totalUsdModelo:0,totalCopModelo:0,totalModels:new Set});let d=c.get(r);d.totalUsdBruto+=Number(e.value_usd_bruto||0),d.totalUsdModelo+=Number(e.value_usd_modelo||0),d.totalCopModelo+=Number(e.value_cop_modelo||0),d.totalModels.add(e.model_id)})});let m=Array.from(c.values()).map(e=>({groupId:e.groupId,groupName:e.groupName,totalUsdBruto:e.totalUsdBruto,totalUsdModelo:e.totalUsdModelo,totalCopModelo:e.totalCopModelo,totalUsdSede:e.totalUsdBruto-e.totalUsdModelo,totalModels:e.totalModels.size})).sort((e,a)=>a.totalUsdBruto-e.totalUsdBruto);return{success:!0,data:m,message:`An\xe1lisis de productividad por grupo para los \xfaltimos ${s} meses`}}catch(e){return{success:!1,error:e.message}}}async function u(e,a,o,t){try{let s=a?.limit||10,d=a?.months||6,i=a?.startDate||new Date(Date.now()-2592e6*d).toISOString().split("T")[0],n=a?.endDate||new Date().toISOString().split("T")[0],l=[];if("admin"===o){let{data:a}=await e.from("user_groups").select("group_id").eq("user_id",t),o=(a||[]).map(e=>e.group_id);if(o.length>0){let{data:a}=await e.from("user_groups").select("user_id").in("group_id",o);l=(a||[]).map(e=>e.user_id)}}let{data:u,error:c}=await e.from("calculator_history").select(`
        model_id,
        value_usd_bruto,
        value_usd_modelo,
        value_cop_modelo,
        users!inner(
          id,
          email,
          name
        )
      `).gte("period_date",i).lte("period_date",n).neq("model_id",r.mo);if(c)return{success:!1,error:"Error obteniendo datos hist\xf3ricos"};let m=new Map;u?.forEach(e=>{if("admin"===o&&l.length>0&&!l.includes(e.model_id))return;m.has(e.model_id)||m.set(e.model_id,{modelId:e.model_id,modelName:e.users?.name||"Modelo",modelEmail:e.users?.email||"",totalUsdBruto:0,totalUsdModelo:0,totalCopModelo:0});let a=m.get(e.model_id);a.totalUsdBruto+=Number(e.value_usd_bruto||0),a.totalUsdModelo+=Number(e.value_usd_modelo||0),a.totalCopModelo+=Number(e.value_cop_modelo||0)});let p=Array.from(m.values()).sort((e,a)=>a.totalUsdBruto-e.totalUsdBruto).slice(0,s).map((e,a)=>({rank:a+1,...e}));return{success:!0,data:p,message:`Top ${s} modelos por productividad (USD Bruto) en los \xfaltimos ${d} meses`}}catch(e){return{success:!1,error:e.message}}}async function c(e,a,o,t){try{let o=a?.months||6,t=a?.startDate||new Date(Date.now()-2592e6*o).toISOString().split("T")[0],s=a?.endDate||new Date().toISOString().split("T")[0],{data:d,error:i}=await e.from("calculator_history").select(`
        period_date,
        period_type,
        value_usd_bruto,
        value_usd_modelo,
        value_cop_modelo
      `).gte("period_date",t).lte("period_date",s).neq("model_id",r.mo);if(i)return{success:!1,error:"Error obteniendo datos hist\xf3ricos"};let n=new Map;d?.forEach(e=>{let a=e.period_date.substring(0,7);n.has(a)||n.set(a,{month:a,totalUsdBruto:0,totalUsdModelo:0,totalCopModelo:0,periods:0});let o=n.get(a);o.totalUsdBruto+=Number(e.value_usd_bruto||0),o.totalUsdModelo+=Number(e.value_usd_modelo||0),o.totalCopModelo+=Number(e.value_cop_modelo||0),o.periods+=1});let l=Array.from(n.values()).sort((e,a)=>e.month.localeCompare(a.month)).map(e=>({...e,averageUsdBruto:e.totalUsdBruto/(e.periods||1)}));return{success:!0,data:l,message:`Tendencia de productividad por mes (\xfaltimos ${o} meses)`}}catch(e){return{success:!1,error:e.message}}}async function m(e,a,o,t){return{success:!1,error:"Funci\xf3n en desarrollo"}}async function p(e,a,o,t){let r=await l(e,a,o,t);return r.success&&r.data?{...r,message:`Ranking de grupos por productividad (${a?.months||6} meses)`}:r}async function _(e,a,o,t){let r=await n(e,a,o,t);return r.success&&r.data?{...r,message:`Ranking de sedes por productividad (${a?.months||6} meses)`}:r}async function f(e,a,o,t){try{let r=a?.modelId||t,s=a?.months||6,d=a?.startDate||new Date(Date.now()-2592e6*s).toISOString().split("T")[0],i=a?.endDate||new Date().toISOString().split("T")[0];if("modelo"===o&&r!==t)return{success:!1,error:"No tienes permisos para ver estas estad\xedsticas"};let{data:n,error:l}=await e.from("calculator_history").select(`
        period_date,
        period_type,
        value_usd_bruto,
        value_usd_modelo,
        value_cop_modelo,
        platform_id
      `).eq("model_id",r).gte("period_date",d).lte("period_date",i);if(l)return{success:!1,error:"Error obteniendo datos hist\xf3ricos"};let u=n?.reduce((e,a)=>({totalUsdBruto:e.totalUsdBruto+Number(a.value_usd_bruto||0),totalUsdModelo:e.totalUsdModelo+Number(a.value_usd_modelo||0),totalCopModelo:e.totalCopModelo+Number(a.value_cop_modelo||0),periods:e.periods+1}),{totalUsdBruto:0,totalUsdModelo:0,totalCopModelo:0,periods:0})||{totalUsdBruto:0,totalUsdModelo:0,totalCopModelo:0,periods:0};return{success:!0,data:{...u,averageUsdBrutoPerPeriod:u.totalUsdBruto/(u.periods||1),averageUsdModeloPerPeriod:u.totalUsdModelo/(u.periods||1)},message:`Estad\xedsticas del modelo para los \xfaltimos ${s} meses`}}catch(e){return{success:!1,error:e.message}}}}};