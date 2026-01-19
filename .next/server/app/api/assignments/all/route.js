"use strict";(()=>{var e={};e.id=1378,e.ids=[1378],e.modules={30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13685:e=>{e.exports=require("http")},95687:e=>{e.exports=require("https")},85477:e=>{e.exports=require("punycode")},12781:e=>{e.exports=require("stream")},57310:e=>{e.exports=require("url")},59796:e=>{e.exports=require("zlib")},82138:(e,o,r)=>{r.r(o),r.d(o,{headerHooks:()=>g,originalPathname:()=>h,patchFetch:()=>v,requestAsyncStorage:()=>l,routeModule:()=>m,serverHooks:()=>p,staticGenerationAsyncStorage:()=>c,staticGenerationBailout:()=>_});var s={};r.r(s),r.d(s,{GET:()=>u});var a=r(95419),t=r(69108),n=r(99678),i=r(78070);let d=r(66569).R;async function u(){try{console.log("\uD83D\uDD0D [API] Obteniendo todas las asignaciones...");let{data:e,error:o}=await d.from("modelo_assignments").select(`
        id,
        model_id,
        room_id,
        jornada,
        assigned_at,
        is_active,
        users!inner(
          id,
          name,
          email
        ),
        group_rooms!inner(
          id,
          room_name,
          groups!inner(
            id,
            name
          )
        )
      `).eq("is_active",!0).order("assigned_at",{ascending:!1});if(o)return console.error("❌ [API] Error obteniendo asignaciones:",o),i.Z.json({success:!1,error:"Error obteniendo asignaciones de la base de datos"},{status:500});console.log("✅ [API] Asignaciones obtenidas:",e?.length||0);let r=e?.map(e=>({id:e.id,model_id:e.model_id,modelo_name:e.users?.name||"Modelo desconocido",modelo_email:e.users?.email||"",group_id:e.group_rooms?.groups?.id||"",grupo_name:e.group_rooms?.groups?.name||"Grupo desconocido",room_id:e.room_id,room_name:e.group_rooms?.room_name||"Room desconocido",jornada:e.jornada,assigned_at:e.assigned_at,is_active:e.is_active}))||[];return i.Z.json({success:!0,assignments:r})}catch(e){return console.error("❌ [API] Error inesperado:",e),i.Z.json({success:!1,error:"Error interno del servidor"},{status:500})}}let m=new a.AppRouteRouteModule({definition:{kind:t.x.APP_ROUTE,page:"/api/assignments/all/route",pathname:"/api/assignments/all",filename:"route",bundlePath:"app/api/assignments/all/route"},resolvedPagePath:"C:\\Users\\camca\\OneDrive\\Documentos\\GitHub\\iam-sistema-de-gestion\\app\\api\\assignments\\all\\route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:l,staticGenerationAsyncStorage:c,serverHooks:p,headerHooks:g,staticGenerationBailout:_}=m,h="/api/assignments/all/route";function v(){return(0,n.patchFetch)({serverHooks:p,staticGenerationAsyncStorage:c})}},66569:(e,o,r)=>{r.d(o,{A:()=>i,R:()=>n});var s=r(72964);let a="https://mhernfrkvwigxdubiozm.supabase.co",t=process.env.SUPABASE_SERVICE_ROLE_KEY||"",n=(0,s.createClient)(a,t,{auth:{autoRefreshToken:!1,persistSession:!1}}),i=(0,s.createClient)(a,t,{auth:{autoRefreshToken:!1,persistSession:!1}})}};var o=require("../../../../webpack-runtime.js");o.C(e);var r=e=>o(o.s=e),s=o.X(0,[1638,6206,2964],()=>r(82138));module.exports=s})();