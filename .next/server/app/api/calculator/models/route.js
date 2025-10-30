"use strict";(()=>{var e={};e.id=209,e.ids=[209],e.modules={30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13685:e=>{e.exports=require("http")},95687:e=>{e.exports=require("https")},85477:e=>{e.exports=require("punycode")},12781:e=>{e.exports=require("stream")},57310:e=>{e.exports=require("url")},59796:e=>{e.exports=require("zlib")},64247:(e,r,o)=>{o.r(r),o.d(r,{headerHooks:()=>_,originalPathname:()=>h,patchFetch:()=>q,requestAsyncStorage:()=>m,routeModule:()=>p,serverHooks:()=>f,staticGenerationAsyncStorage:()=>g,staticGenerationBailout:()=>v});var t={};o.r(t),o.d(t,{GET:()=>d,dynamic:()=>l});var s=o(95419),a=o(69108),i=o(99678),n=o(78070),u=o(72964);let l="force-dynamic",c=(0,u.createClient)("https://mhernfrkvwigxdubiozm.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY);async function d(e){let{searchParams:r}=new URL(e.url),o=r.get("adminId");if(!o)return n.Z.json({success:!1,error:"adminId es requerido"},{status:400});try{let{data:e,error:r}=await c.from("users").select(`
        role,
        groups:user_groups(
          group_id,
          group:groups(id, name)
        )
      `).eq("id",o).single();if(r)return console.error("Error al obtener admin:",r),n.Z.json({success:!1,error:"Admin no encontrado"},{status:404});let t="super_admin"===e.role,s="admin"===e.role;if(!t&&!s)return n.Z.json({success:!1,error:"No tienes permisos para acceder a esta funci\xf3n"},{status:403});let a=c.from("users").select(`
        id,
        email,
        name,
        role,
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
      `).eq("role","modelo");if(s&&!t){let r=e.groups?.map(e=>e.group_id).filter(Boolean)||[];if(0===r.length)return n.Z.json({success:!0,models:[]});let{data:o,error:t}=await c.from("user_groups").select("user_id").in("group_id",r);if(t)return console.error("Error al obtener IDs de modelos:",t),n.Z.json({success:!1,error:"Error al filtrar modelos"},{status:500});let s=o?.map(e=>e.user_id)||[];if(0===s.length)return n.Z.json({success:!0,models:[]});a=a.in("id",s)}let{data:i,error:u}=await a;if(u)return console.error("Error al obtener modelos:",u),n.Z.json({success:!1,error:u.message},{status:500});let l=i?.map(e=>{let r=e.calculator_config?.find(e=>!0===e.active);return console.log(`🔍 [CONFIG CHECK] Modelo ${e.email}:`,{totalConfigs:e.calculator_config?.length||0,activeConfig:!!r,configs:e.calculator_config?.map(e=>({id:e.id,active:e.active}))||[]}),{id:e.id,email:e.email,name:e.name,role:e.role,groups:e.groups?.map(e=>e.group).filter(Boolean)||[{id:"default",name:"Sin grupo asignado"}],hasConfig:!!r,currentConfig:r||null}})||[];return n.Z.json({success:!0,models:l})}catch(e){return console.error("Error en /api/calculator/models:",e),n.Z.json({success:!1,error:e.message||"Error interno del servidor"},{status:500})}}let p=new s.AppRouteRouteModule({definition:{kind:a.x.APP_ROUTE,page:"/api/calculator/models/route",pathname:"/api/calculator/models",filename:"route",bundlePath:"app/api/calculator/models/route"},resolvedPagePath:"C:\\Users\\camca\\OneDrive\\Documentos\\GitHub\\iam-sistema-de-gestion\\app\\api\\calculator\\models\\route.ts",nextConfigOutput:"",userland:t}),{requestAsyncStorage:m,staticGenerationAsyncStorage:g,serverHooks:f,headerHooks:_,staticGenerationBailout:v}=p,h="/api/calculator/models/route";function q(){return(0,i.patchFetch)({serverHooks:f,staticGenerationAsyncStorage:g})}}};var r=require("../../../../webpack-runtime.js");r.C(e);var o=e=>r(r.s=e),t=r.X(0,[1638,6206,2964],()=>o(64247));module.exports=t})();