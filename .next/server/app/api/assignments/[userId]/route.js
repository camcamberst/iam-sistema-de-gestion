"use strict";(()=>{var e={};e.id=3180,e.ids=[3180],e.modules={30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13685:e=>{e.exports=require("http")},95687:e=>{e.exports=require("https")},85477:e=>{e.exports=require("punycode")},12781:e=>{e.exports=require("stream")},57310:e=>{e.exports=require("url")},59796:e=>{e.exports=require("zlib")},45436:(e,r,o)=>{o.r(r),o.d(r,{headerHooks:()=>_,originalPathname:()=>S,patchFetch:()=>A,requestAsyncStorage:()=>p,routeModule:()=>m,serverHooks:()=>l,staticGenerationAsyncStorage:()=>g,staticGenerationBailout:()=>c});var s={};o.r(s),o.d(s,{GET:()=>u});var a=o(95419),n=o(69108),t=o(99678),i=o(72964),d=o(78070);async function u(e,{params:r}){try{console.log("\uD83D\uDD0D [ASSIGNMENTS API] Obteniendo asignaciones para usuario:",r.userId);let e=(0,i.createClient)("https://mhernfrkvwigxdubiozm.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY),{data:o,error:s}=await e.from("modelo_assignments").select(`
        id,
        jornada,
        room_id,
        group_id,
        assigned_at,
        is_active,
        group_rooms!inner(
          room_name
        ),
        groups!inner(
          name
        )
      `).eq("model_id",r.userId).eq("is_active",!0).order("assigned_at",{ascending:!1}),a=[];if(s)console.error("❌ [ASSIGNMENTS API] Error en modelo_assignments:",s);else if(o&&o.length>0)a=o.map(e=>({id:e.id,jornada:e.jornada,room_id:e.room_id,room_name:e.group_rooms?.[0]?.room_name||null,group_id:e.group_id,group_name:e.groups?.[0]?.name||null,assigned_at:e.assigned_at,is_active:e.is_active}));else{console.log("\uD83D\uDD0D [ASSIGNMENTS API] No hay asignaciones en modelo_assignments, buscando en jornada_states...");let{data:o,error:s}=await e.from("jornada_states").select(`
          id,
          jornada,
          room_id,
          group_id,
          updated_at,
          model_id,
          state,
          group_rooms!inner(
            room_name
          ),
          groups!inner(
            name
          )
        `).eq("model_id",r.userId).eq("state","OCUPADA").order("updated_at",{ascending:!1});s?console.error("❌ [ASSIGNMENTS API] Error en jornada_states:",s):o&&o.length>0&&(a=o.map(e=>({id:e.id,jornada:e.jornada,room_id:e.room_id,room_name:e.group_rooms?.[0]?.room_name||null,group_id:e.group_id,group_name:e.groups?.[0]?.name||null,assigned_at:e.updated_at,is_active:!0})),console.log("✅ [ASSIGNMENTS API] Asignaciones encontradas en jornada_states:",a.length))}return console.log("✅ [ASSIGNMENTS API] Asignaciones obtenidas:",a.length),d.Z.json({success:!0,assignments:a})}catch(e){return console.error("❌ [ASSIGNMENTS API] Error general:",e),d.Z.json({success:!1,error:"Error interno"},{status:500})}}let m=new a.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/assignments/[userId]/route",pathname:"/api/assignments/[userId]",filename:"route",bundlePath:"app/api/assignments/[userId]/route"},resolvedPagePath:"C:\\Users\\camca\\OneDrive\\Documentos\\GitHub\\iam-sistema-de-gestion\\app\\api\\assignments\\[userId]\\route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:p,staticGenerationAsyncStorage:g,serverHooks:l,headerHooks:_,staticGenerationBailout:c}=m,S="/api/assignments/[userId]/route";function A(){return(0,t.patchFetch)({serverHooks:l,staticGenerationAsyncStorage:g})}}};var r=require("../../../../webpack-runtime.js");r.C(e);var o=e=>r(r.s=e),s=r.X(0,[1638,6206,2964],()=>o(45436));module.exports=s})();