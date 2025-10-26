"use strict";(()=>{var e={};e.id=8424,e.ids=[8424],e.modules={30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13685:e=>{e.exports=require("http")},95687:e=>{e.exports=require("https")},85477:e=>{e.exports=require("punycode")},12781:e=>{e.exports=require("stream")},57310:e=>{e.exports=require("url")},59796:e=>{e.exports=require("zlib")},83796:(e,t,r)=>{r.r(t),r.d(t,{headerHooks:()=>_,originalPathname:()=>v,patchFetch:()=>g,requestAsyncStorage:()=>p,routeModule:()=>u,serverHooks:()=>c,staticGenerationAsyncStorage:()=>m,staticGenerationBailout:()=>f});var a={};r.r(a),r.d(a,{POST:()=>l});var o=r(95419),i=r(69108),s=r(99678),n=r(78070);let d=(0,r(72964).createClient)("https://mhernfrkvwigxdubiozm.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY);async function l(e){try{if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return n.Z.json({error:"Configuraci\xf3n de base de datos no disponible"},{status:500});let{userRole:t,userGroups:r}=await e.json(),a=d.from("modelo_plataformas_detailed").select(`
        id,
        model_id,
        model_email,
        platform_name,
        status,
        requested_at,
        delivered_at,
        confirmed_at,
        deactivated_at,
        reverted_at,
        updated_at,
        notes,
        group_name
      `).in("status",["solicitada","pendiente","entregada","inviable"]).is("closed_at",null).not("is_initial_config","eq",!0).not("requested_at","is",null).order("requested_at",{ascending:!1});"admin"===t&&r&&r.length>0&&(a=a.in("group_name",r));let{data:o,error:i}=await a;if(i)return console.error("Error fetching timeline data:",i),n.Z.json({error:"Error al obtener datos del timeline"},{status:500});return n.Z.json({requests:o||[]})}catch(e){return console.error("Timeline API error:",e),n.Z.json({error:"Error interno del servidor"},{status:500})}}let u=new o.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/modelo-plataformas/timeline/route",pathname:"/api/modelo-plataformas/timeline",filename:"route",bundlePath:"app/api/modelo-plataformas/timeline/route"},resolvedPagePath:"C:\\Users\\camca\\OneDrive\\Documentos\\GitHub\\iam-sistema-de-gestion\\app\\api\\modelo-plataformas\\timeline\\route.ts",nextConfigOutput:"",userland:a}),{requestAsyncStorage:p,staticGenerationAsyncStorage:m,serverHooks:c,headerHooks:_,staticGenerationBailout:f}=u,v="/api/modelo-plataformas/timeline/route";function g(){return(0,s.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:m})}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[1638,6206,2964],()=>r(83796));module.exports=a})();