"use strict";(()=>{var e={};e.id=6675,e.ids=[6675],e.modules={30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13685:e=>{e.exports=require("http")},95687:e=>{e.exports=require("https")},85477:e=>{e.exports=require("punycode")},12781:e=>{e.exports=require("stream")},57310:e=>{e.exports=require("url")},59796:e=>{e.exports=require("zlib")},63231:(e,t,a)=>{a.r(t),a.d(t,{headerHooks:()=>f,originalPathname:()=>v,patchFetch:()=>y,requestAsyncStorage:()=>m,routeModule:()=>p,serverHooks:()=>g,staticGenerationAsyncStorage:()=>_,staticGenerationBailout:()=>h});var r={};a.r(r),a.d(r,{GET:()=>u,dynamic:()=>d});var o=a(95419),s=a(69108),i=a(99678),n=a(78070),l=a(72964);let d="force-dynamic",c=(0,l.createClient)("https://mhernfrkvwigxdubiozm.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY);async function u(e){try{let{searchParams:t}=new URL(e.url),a=t.get("modelId");if(!a)return n.Z.json({success:!1,error:"modelId es requerido"},{status:400});let{data:r,error:o}=await c.from("modelo_plataformas").select(`
        id,
        platform_id,
        status,
        requested_at,
        delivered_at,
        confirmed_at,
        deactivated_at,
        notes,
        is_initial_config,
        calculator_sync,
        calculator_activated_at,
        created_at,
        updated_at,
        calculator_platforms (
          id,
          name,
          currency
        )
      `).eq("model_id",a).in("status",["entregada","confirmada","desactivada"]).order("updated_at",{ascending:!1});if(o)return console.error("Error obteniendo plataformas:",o),n.Z.json({success:!1,error:"Error al obtener plataformas"},{status:500});let{data:s,error:i}=await c.from("calculator_history").select(`
        platform_id,
        value,
        usd_bruto,
        usd_modelo,
        cop_modelo,
        period_date,
        calculator_platforms (
          name,
          id
        )
      `).eq("model_id",a).gte("period_date",new Date(Date.now()-2592e6).toISOString()).order("period_date",{ascending:!1});i&&console.warn("Error obteniendo datos de calculadora:",i);let{data:l}=await c.from("users").select("monthly_connection_avg, last_avg_calculation_date, last_avg_month").eq("id",a).single(),d=new Date().toISOString().slice(0,7),u=0;if(l?.last_avg_month===d&&l?.monthly_connection_avg)u=Math.round(l.monthly_connection_avg);else{new Date().getDate();let e=s?.length||0;u=Math.round(e/13*100)}let p=await Promise.all(r.map(async e=>{let t=s?.filter(t=>t.platform_id===e.platform_id)||[],r=t.reduce((e,t)=>e+(t.value||0),0),o=t.reduce((e,t)=>e+(t.usd_bruto||0),0),i=t.reduce((e,t)=>e+(t.usd_modelo||0),0),n=t.reduce((e,t)=>e+(t.cop_modelo||0),0),l=t.length>0?r/t.length:0,d=0,p="=";try{let{data:r,error:o}=await c.rpc("get_moving_average_daily_avg",{p_model_id:a,p_platform_id:e.platform_id,p_quincenas_back:4});if(!o&&r&&r.length>0){let e=r[0];d=e.current_avg||0,p=e.trend||"="}else d=t.length>0?i/t.length:0}catch(a){console.warn(`Error obteniendo promedio quincenal para ${e.platform_id}:`,a),d=t.length>0?i/t.length:0}let m=e.is_initial_config&&"desactivada"!==e.status?"confirmada":e.status;return{...e,status:m,stats:{totalDays:t.length,connectionPercentage:u,totalValue:r,totalUsdBruto:o,totalUsdModelo:i,totalCopModelo:n,avgValue:l,avgUsdModelo:d,lastActivity:t[0]?.period_date||null,trend:p}}})),m=r.length,_=p.filter(e=>"confirmada"===e.status).length,g=p.filter(e=>"entregada"===e.status&&!e.is_initial_config).length,f=p.reduce((e,t)=>e+t.stats.totalUsdModelo,0),h=p.reduce((e,t)=>e+t.stats.totalCopModelo,0);return n.Z.json({success:!0,data:{platforms:p,summary:{totalPlatforms:m,activePlatforms:_,pendingConfirmation:g,totalUsdModelo:f,totalCopModelo:h,avgUsdPerPlatform:m>0?f/m:0},lastUpdated:new Date().toISOString()}})}catch(e){return console.error("Error en portafolio de modelo:",e),n.Z.json({success:!1,error:e.message||"Error interno del servidor"},{status:500})}}let p=new o.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/modelo-portafolio/route",pathname:"/api/modelo-portafolio",filename:"route",bundlePath:"app/api/modelo-portafolio/route"},resolvedPagePath:"C:\\Users\\camca\\OneDrive\\Documentos\\GitHub\\iam-sistema-de-gestion\\app\\api\\modelo-portafolio\\route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:m,staticGenerationAsyncStorage:_,serverHooks:g,headerHooks:f,staticGenerationBailout:h}=p,v="/api/modelo-portafolio/route";function y(){return(0,i.patchFetch)({serverHooks:g,staticGenerationAsyncStorage:_})}}};var t=require("../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),r=t.X(0,[1638,6206,2964],()=>a(63231));module.exports=r})();