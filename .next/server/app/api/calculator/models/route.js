"use strict";(()=>{var e={};e.id=209,e.ids=[209],e.modules={30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13685:e=>{e.exports=require("http")},95687:e=>{e.exports=require("https")},85477:e=>{e.exports=require("punycode")},12781:e=>{e.exports=require("stream")},57310:e=>{e.exports=require("url")},59796:e=>{e.exports=require("zlib")},64247:(e,r,o)=>{o.r(r),o.d(r,{headerHooks:()=>v,originalPathname:()=>h,patchFetch:()=>q,requestAsyncStorage:()=>f,routeModule:()=>m,serverHooks:()=>g,staticGenerationAsyncStorage:()=>_,staticGenerationBailout:()=>E});var t={};o.r(t),o.d(t,{GET:()=>p,dynamic:()=>d});var a=o(95419),i=o(69108),s=o(99678),u=o(78070),l=o(72964),n=o(34196);let d="force-dynamic",c=(0,l.createClient)("https://mhernfrkvwigxdubiozm.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY);async function p(e){let{searchParams:r}=new URL(e.url),o=r.get("adminId");if(!o)return u.Z.json({success:!1,error:"adminId es requerido"},{status:400});try{let{data:e,error:r}=await c.from("users").select(`
        role,
        affiliate_studio_id,
        groups:user_groups(
          group_id,
          group:groups(id, name)
        )
      `).eq("id",o).single();if(r)return console.error("Error al obtener admin:",r),u.Z.json({success:!1,error:"Admin no encontrado"},{status:404});let t="super_admin"===e.role,a="admin"===e.role,i="superadmin_aff"===e.role;if(!t&&!a&&!i)return u.Z.json({success:!1,error:"No tienes permisos para acceder a esta funci\xf3n"},{status:403});let s=c.from("users").select(`
        id,
        email,
        name,
        role,
        affiliate_studio_id,
        groups:user_groups(
          group_id,
          group:groups(id, name)
        ),
        calculator_config:calculator_config!calculator_config_model_id_fkey(
          id,
          active,
          enabled_platforms,
          percentage_override,
          min_quota_override,
          group_percentage,
          group_min_quota,
          created_at
        )
      `).eq("role","modelo");if(s=(0,n.rd)(s,{id:o,role:e.role,affiliate_studio_id:e.affiliate_studio_id||null}),a&&!t&&!i){let r=e.groups?.map(e=>e.group_id).filter(Boolean)||[];if(0===r.length)return u.Z.json({success:!0,models:[]});let{data:o,error:t}=await c.from("user_groups").select("user_id").in("group_id",r);if(t)return console.error("Error al obtener IDs de modelos:",t),u.Z.json({success:!1,error:"Error al filtrar modelos"},{status:500});let a=o?.map(e=>e.user_id)||[];if(0===a.length)return u.Z.json({success:!0,models:[]});s=s.in("id",a)}let{data:l,error:d}=await s;if(d)return console.error("Error al obtener modelos:",d),u.Z.json({success:!1,error:d.message},{status:500});let p=l?.map(e=>{let r=e.calculator_config?.find(e=>!0===e.active);return console.log(`🔍 [CONFIG CHECK] Modelo ${e.email}:`,{totalConfigs:e.calculator_config?.length||0,activeConfig:!!r,configs:e.calculator_config?.map(e=>({id:e.id,active:e.active}))||[]}),{id:e.id,email:e.email,name:e.name,role:e.role,groups:e.groups?.map(e=>e.group).filter(Boolean)||[{id:"default",name:"Sin grupo asignado"}],hasConfig:!!r,currentConfig:r||null}})||[];return u.Z.json({success:!0,models:p})}catch(e){return console.error("Error en /api/calculator/models:",e),u.Z.json({success:!1,error:e.message||"Error interno del servidor"},{status:500})}}let m=new a.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/calculator/models/route",pathname:"/api/calculator/models",filename:"route",bundlePath:"app/api/calculator/models/route"},resolvedPagePath:"C:\\Users\\camca\\OneDrive\\Documentos\\GitHub\\iam-sistema-de-gestion\\app\\api\\calculator\\models\\route.ts",nextConfigOutput:"",userland:t}),{requestAsyncStorage:f,staticGenerationAsyncStorage:_,serverHooks:g,headerHooks:v,staticGenerationBailout:E}=m,h="/api/calculator/models/route";function q(){return(0,s.patchFetch)({serverHooks:g,staticGenerationAsyncStorage:_})}},34196:(e,r,o)=>{function t(e,r){return r?"super_admin"!==r.role&&("admin"!==r.role||r.affiliate_studio_id)&&("superadmin_aff"===r.role||"admin"===r.role&&r.affiliate_studio_id)?r.affiliate_studio_id?e.eq("affiliate_studio_id",r.affiliate_studio_id):e.eq("affiliate_studio_id","00000000-0000-0000-0000-000000000000"):e:e.eq("affiliate_studio_id","00000000-0000-0000-0000-000000000000")}o.d(r,{rd:()=>t}),process.env.SUPABASE_SERVICE_ROLE_KEY}};var r=require("../../../../webpack-runtime.js");r.C(e);var o=e=>r(r.s=e),t=r.X(0,[1638,6206,2964],()=>o(64247));module.exports=t})();