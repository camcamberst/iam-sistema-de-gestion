"use strict";(()=>{var e={};e.id=2103,e.ids=[2103],e.modules={30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},13685:e=>{e.exports=require("http")},95687:e=>{e.exports=require("https")},85477:e=>{e.exports=require("punycode")},12781:e=>{e.exports=require("stream")},57310:e=>{e.exports=require("url")},59796:e=>{e.exports=require("zlib")},55658:(e,a,t)=>{t.r(a),t.d(a,{headerHooks:()=>D,originalPathname:()=>w,patchFetch:()=>S,requestAsyncStorage:()=>h,routeModule:()=>f,serverHooks:()=>v,staticGenerationAsyncStorage:()=>x,staticGenerationBailout:()=>_});var r={};t.r(r),t.d(r,{POST:()=>m});var o=t(95419),n=t(69108),i=t(99678),s=t(78070),d=t(72964),c=t(70973);let l=(0,d.createClient)("https://mhernfrkvwigxdubiozm.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY),u=new c.$D(process.env.GOOGLE_GEMINI_API_KEY);async function m(e){try{let{userId:a,userRole:t}=await e.json();if(!a)return s.Z.json({success:!1,error:"userId es requerido"},{status:400});if("modelo"!==t)return s.Z.json({success:!1,error:"Solo disponible para modelos"},{status:403});let r=await p(a);if(!r)return s.Z.json({success:!1,error:"No se encontraron datos del usuario"},{status:404});let o=await g(r);return s.Z.json({success:!0,data:o})}catch(e){return console.error("Error en AI Dashboard:",e),s.Z.json({success:!1,error:e.message||"Error interno del servidor"},{status:500})}}async function p(e){try{let a=new Date().toISOString().split("T")[0],t=new Date(Date.now()-864e5).toISOString().split("T")[0],{data:r}=await l.from("model_values").select(`
        platform_id,
        value,
        calculator_platforms (
          name,
          currency
        )
      `).eq("model_id",e).eq("period_date",a),{data:o}=await l.from("model_values").select(`
        platform_id,
        value,
        calculator_platforms (
          name,
          currency
        )
      `).eq("model_id",e).eq("period_date",t),n=(r||[]).reduce((e,a)=>e+(a.value||0),0),i=(o||[]).reduce((e,a)=>e+(a.value||0),0),s=new Date(Date.now()-6048e5).toISOString().split("T")[0],{data:d}=await l.from("model_values").select(`
        platform_id,
        value,
        period_date,
        calculator_platforms (
          name,
          currency
        )
      `).eq("model_id",e).gte("period_date",s).order("period_date",{ascending:!0}),{data:c}=await l.from("calculator_configs").select("*").eq("user_id",e).single(),{data:u}=await l.from("modelo_plataformas").select(`
        platform_id,
        status,
        calculator_platforms (
          name,
          currency
        )
      `).eq("model_id",e).in("status",["entregada","confirmada"]);return{todayEarnings:n-i,todayTotal:n,yesterdayTotal:i,weeklyData:d||[],config:c||{},portfolio:u||[],userId:e}}catch(e){return console.error("Error obteniendo datos de productividad:",e),null}}async function g(e){try{let a=u.getGenerativeModel({model:"gemini-1.5-flash"}),t=e.todayEarnings,r=e.weeklyData.reduce((e,a)=>e+(a.value||0),0),o=r/7,n=new Map;e.weeklyData.forEach(e=>{let a=e.calculator_platforms?.name||"Unknown";n.has(a)||n.set(a,{total:0,days:0});let t=n.get(a);t.total+=e.value||0,t.days+=1});let i="N/A",s=0;n.forEach((e,a)=>{let t=e.total/e.days;t>s&&(s=t,i=a)});let d=`
Eres un asistente especializado en an\xe1lisis de rendimiento para modelos de webcam. 
Genera insights \xfatiles y motivadores con un tono casual y amigable, pero profesional.

DATOS DEL MODELO:
- Ganancias del d\xeda: $${t.toFixed(2)} USD (diferencia entre hoy y ayer)
- Total acumulado hoy: $${e.todayTotal.toFixed(2)} USD
- Total acumulado ayer: $${e.yesterdayTotal.toFixed(2)} USD
- Promedio diario (\xfaltima semana): $${o.toFixed(2)} USD
- Total semanal: $${r.toFixed(2)} USD
- Mejor plataforma: ${i}
- Plataformas activas: ${e.portfolio.length}

INSTRUCCIONES:
1. Genera 3 insights espec\xedficos y accionables
2. Proporciona 1 tip del d\xeda motivador
3. Da 3 recomendaciones espec\xedficas
4. Usa un tono casual y amigable, como un mentor experimentado
5. Incluye emojis apropiados
6. S\xe9 espec\xedfico pero motivador
7. Enf\xf3cate en estrategias de mejora y optimizaci\xf3n

Responde en formato JSON:
{
  "insights": [
    {
      "type": "tip|analysis|recommendation|trend",
      "title": "t\xedtulo con emoji",
      "content": "contenido detallado",
      "priority": "high|medium|low",
      "category": "engagement|performance|strategy",
      "actionable": true
    }
  ],
  "dailyTip": "tip motivador del d\xeda",
  "recommendations": ["recomendaci\xf3n 1", "recomendaci\xf3n 2", "recomendaci\xf3n 3"],
  "performanceSummary": {
    "todayEarnings": ${t},
    "weeklyTrend": ${((t-o)/(o||1)*100).toFixed(1)},
    "bestPlatform": "${i}",
    "goalProgress": 75.0
  }
}
`,c=await a.generateContent(d),l=(await c.response).text().replace(/```json\n?|\n?```/g,"").trim();try{return{...JSON.parse(l),lastUpdated:new Date().toISOString()}}catch(a){return console.error("Error parsing Gemini response:",a),y(e)}}catch(a){return console.error("Error generando insights con Gemini:",a),y(e)}}function y(e){return{insights:[{type:"tip",title:"\uD83D\uDCA1 Tip de Engagement",content:"Interact\xfaa m\xe1s con tu audiencia durante las primeras 30 minutos de tu sesi\xf3n. Los usuarios que reciben atenci\xf3n personalizada tienden a quedarse m\xe1s tiempo.",priority:"high",category:"engagement",actionable:!0},{type:"analysis",title:"\uD83D\uDCCA An\xe1lisis de Rendimiento",content:"Mant\xe9n un registro consistente de tus ingresos para obtener mejores insights. La consistencia es clave para el crecimiento.",priority:"medium",category:"performance",actionable:!0},{type:"recommendation",title:"\uD83C\uDFAF Recomendaci\xf3n Estrat\xe9gica",content:"Diversifica tu contenido con temas de conversaci\xf3n variados. Los usuarios valoran la autenticidad y la variedad.",priority:"medium",category:"strategy",actionable:!0}],dailyTip:"\uD83C\uDF1F Tip del D\xeda: Usa el chat para crear conexiones genuinas. Pregunta sobre sus intereses y comparte experiencias personales apropiadas.",recommendations:["Optimiza tu perfil con tags m\xe1s espec\xedficos","Considera horarios de mayor audiencia","Mant\xe9n consistencia en tu programaci\xf3n"],performanceSummary:{todayEarnings:e.todayEarnings,weeklyTrend:0,bestPlatform:"N/A",goalProgress:0},lastUpdated:new Date().toISOString()}}let f=new o.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/ai-dashboard/route",pathname:"/api/ai-dashboard",filename:"route",bundlePath:"app/api/ai-dashboard/route"},resolvedPagePath:"C:\\Users\\camca\\OneDrive\\Documentos\\GitHub\\iam-sistema-de-gestion\\app\\api\\ai-dashboard\\route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:h,staticGenerationAsyncStorage:x,serverHooks:v,headerHooks:D,staticGenerationBailout:_}=f,w="/api/ai-dashboard/route";function S(){return(0,i.patchFetch)({serverHooks:v,staticGenerationAsyncStorage:x})}}};var a=require("../../../webpack-runtime.js");a.C(e);var t=e=>a(a.s=e),r=a.X(0,[1638,6206,2964,973],()=>t(55658));module.exports=r})();