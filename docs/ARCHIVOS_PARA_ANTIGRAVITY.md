# Acceso al código del AIM Sistema de Gestión – Para Antigravity

Documento para entender la integración (en particular cómo alimentar **"Mis Plataformas"** con datos de Desktop|AIM). Incluye archivos clave del proyecto.

---

## 1. Acceso al repositorio

- **Opción recomendada:** Dar acceso de **lectura** al repo de GitHub del AIM Sistema de Gestión a quien vaya a integrar (Antigravity / tu amigo).
- **URL del repo:**  
  `https://github.com/camcamberst/iam-sistema-de-gestion`  
  (Confirmar con el dueño del repo si es privado; en ese caso, añadir como colaborador con rol “Read”.)

Con acceso de lectura se pueden revisar siempre las últimas versiones de estos archivos y el resto del código.

---

## 2. Archivos clave (contenido completo)

A continuación se incluye el contenido actual de los archivos solicitados.

---

### 2.1 `lib/supabase.ts`

Cliente de Supabase usado en el **frontend** (navegador). Crea la sesión con la anon key y permite autenticación y acceso a datos según RLS.

```ts
"use client";
import { createClient } from "@supabase/supabase-js";

// Valores hardcodeados garantizados - SIEMPRE usar estos valores
// Estos son los valores reales de producción y garantizan que el cliente se inicialice correctamente
const SUPABASE_URL = "https://mhernfrkvwigxdubiozm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTY1NDcsImV4cCI6MjA3NDM5MjU0N30.v7qBceGTwaqyDZe5h9yLBjWwuuGEwAq6KVsAH_RNw8c";

// Crear el cliente directamente con valores garantizados
// Esto evita problemas durante el prefetch de Next.js
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

---

### 2.2 `app/api/aim-browser/platform-credentials/route.ts`

API usada por **AIM Browser** (o Desktop|AIM) para obtener credenciales de plataformas de un modelo.  
- **GET:** `?model_id=UUID` (opcional: `&platform_id=UUID`). No requiere auth (pensado para consumo desde el navegador/desktop con `model_id`).  
- **POST:** body `{ model_id, platform_id? }` + header `Authorization: Bearer <token>`. Comprueba que el usuario sea el modelo o admin/super_admin antes de devolver credenciales.  
- Las contraseñas se guardan encriptadas en BD; esta API las desencripta con `@/lib/encryption` y devuelve `login_url` (desde `calculator_platforms`), `login_username`, `login_password` por plataforma.  
- Solo se incluyen plataformas con `status = 'entregada'` y con `login_url` configurado en `calculator_platforms`.

```ts
// =====================================================
// 🌐 API PARA AIM BROWSER
// =====================================================
// Endpoint para que AIM Browser consuma credenciales de plataformas
// Formato optimizado para integración con navegador
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET - Obtener todas las credenciales de plataformas para un modelo
// Formato: { platform_id: { login_url, login_username, login_password } }
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('model_id');
    const platformId = searchParams.get('platform_id'); // Opcional: filtrar por plataforma específica

    if (!modelId) {
      return NextResponse.json(
        { error: 'model_id es requerido' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Construir query (obtener login_url desde calculator_platforms)
    let query = supabase
      .from('modelo_plataformas')
      .select(`
        platform_id,
        login_username,
        login_password_encrypted,
        status,
        calculator_platforms (
          id,
          name,
          login_url
        )
      `)
      .eq('model_id', modelId)
      .eq('status', 'entregada')
      .not('login_username', 'is', null)
      .not('login_password_encrypted', 'is', null);

    if (platformId) {
      query = query.eq('platform_id', platformId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error obteniendo credenciales para AIM Browser:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        model_id: modelId,
        credentials: {},
        count: 0
      });
    }

    // Procesar y desencriptar credenciales
    const credentials: Record<string, {
      platform_name: string;
      login_url: string;
      login_username: string;
      login_password: string;
      status: string;
    }> = {};

    for (const item of data) {
      try {
        const password = decrypt(item.login_password_encrypted);
        const platformInfo = item.calculator_platforms as any;
        const platformName = platformInfo?.name || item.platform_id;
        const platformLoginUrl = platformInfo?.login_url;

        // Solo incluir si la plataforma tiene URL configurado
        if (!platformLoginUrl) {
          console.warn(`Plataforma ${item.platform_id} no tiene URL de login configurado`);
          continue;
        }

        credentials[item.platform_id] = {
          platform_name: platformName,
          login_url: platformLoginUrl,
          login_username: item.login_username!,
          login_password: password,
          status: item.status
        };
      } catch (decryptError) {
        console.error(`Error desencriptando contraseña para plataforma ${item.platform_id}:`, decryptError);
        // Continuar con otras plataformas aunque una falle
      }
    }

    return NextResponse.json({
      success: true,
      model_id: modelId,
      credentials,
      count: Object.keys(credentials).length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in GET /api/aim-browser/platform-credentials:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Obtener credenciales con autenticación (más seguro)
// Requiere token de autenticación
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de autorización requerido' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { model_id, platform_id } = body;

    if (!model_id) {
      return NextResponse.json(
        { error: 'model_id es requerido' },
        { status: 400 }
      );
    }

    // Verificar que el usuario tiene acceso (es el modelo o es admin/super_admin)
    const { data: userData } = await supabase
      .from('users')
      .select('role, id')
      .eq('id', user.id)
      .single();

    const isAuthorized = userData?.id === model_id || 
                        userData?.role === 'admin' || 
                        userData?.role === 'super_admin';

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'No autorizado para acceder a estas credenciales' },
        { status: 403 }
      );
    }

    // Misma lógica que GET pero con autenticación (obtener login_url desde calculator_platforms)
    let query = supabase
      .from('modelo_plataformas')
      .select(`
        platform_id,
        login_username,
        login_password_encrypted,
        status,
        calculator_platforms (
          id,
          name,
          login_url
        )
      `)
      .eq('model_id', model_id)
      .eq('status', 'entregada')
      .not('login_username', 'is', null)
      .not('login_password_encrypted', 'is', null);

    if (platform_id) {
      query = query.eq('platform_id', platform_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error obteniendo credenciales para AIM Browser:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        model_id,
        credentials: {},
        count: 0
      });
    }

    // Procesar y desencriptar credenciales (mismo bloque que en GET)
    const credentials: Record<string, {
      platform_name: string;
      login_url: string;
      login_username: string;
      login_password: string;
      status: string;
    }> = {};

    for (const item of data) {
      try {
        const password = decrypt(item.login_password_encrypted);
        const platformInfo = item.calculator_platforms as any;
        const platformName = platformInfo?.name || item.platform_id;
        const platformLoginUrl = platformInfo?.login_url;

        if (!platformLoginUrl) {
          console.warn(`Plataforma ${item.platform_id} no tiene URL de login configurado`);
          continue;
        }

        credentials[item.platform_id] = {
          platform_name: platformName,
          login_url: platformLoginUrl,
          login_username: item.login_username!,
          login_password: password,
          status: item.status
        };
      } catch (decryptError) {
        console.error(`Error desencriptando contraseña para plataforma ${item.platform_id}:`, decryptError);
      }
    }

    return NextResponse.json({
      success: true,
      model_id,
      credentials,
      count: Object.keys(credentials).length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in POST /api/aim-browser/platform-credentials:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
```

---

### 2.3 `app/api/modelo-portafolio/route.ts` – "Mis Plataformas"

API que alimenta la vista **"Mis Plataformas"** (portafolio de la modelo):

- **GET** `?modelId=UUID`
- Obtiene de `modelo_plataformas` las filas del modelo con `status` en `['entregada', 'confirmada', 'desactivada']`, con join a `calculator_platforms` (id, name, currency, login_url).
- Obtiene de `calculator_history` datos de los últimos 30 días por plataforma (value, usd_bruto, usd_modelo, cop_modelo, period_date).
- Obtiene de `users` el `monthly_connection_avg` y fechas de cálculo para el “promedio de conexión”.
- Por cada plataforma calcula estadísticas (totalDays, connectionPercentage, totalUsdModelo, totalCopModelo, avgUsdModelo con RPC `get_moving_average_daily_avg`, trend, lastActivity).
- Devuelve `platforms` (lista con stats), `summary` (totalPlatforms, activePlatforms, pendingConfirmation, totalUsdModelo, totalCopModelo, avgUsdPerPlatform), `lastUpdated`.

Así, **Desktop|AIM** puede consumir esta misma API (con el `modelId` de la modelo logueada) para mostrar “Mis Plataformas” con los mismos criterios y datos que el front actual.

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener portafolio de la modelo
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json({ 
        success: false, 
        error: 'modelId es requerido' 
      }, { status: 400 });
    }

    // Obtener plataformas activas de la modelo
    const { data: platforms, error: platformsError } = await supabase
      .from('modelo_plataformas')
      .select(`
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
          currency,
          login_url
        )
      `)
      .eq('model_id', modelId)
      .in('status', ['entregada', 'confirmada', 'desactivada'])
      .order('updated_at', { ascending: false });

    if (platformsError) {
      console.error('Error obteniendo plataformas:', platformsError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error al obtener plataformas' 
      }, { status: 500 });
    }

    // Obtener estadísticas de la calculadora (datos de Mi Historial)
    const { data: calculatorData, error: calculatorError } = await supabase
      .from('calculator_history')
      .select(`
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
      `)
      .eq('model_id', modelId)
      .gte('period_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('period_date', { ascending: false });

    if (calculatorError) {
      console.warn('Error obteniendo datos de calculadora:', calculatorError);
    }

    // Obtener promedio acumulado mensual de conexión
    const { data: userData } = await supabase
      .from('users')
      .select('monthly_connection_avg, last_avg_calculation_date, last_avg_month')
      .eq('id', modelId)
      .single();
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    let connectionPercentage = 0;
    
    if (userData?.last_avg_month === currentMonth && userData?.monthly_connection_avg) {
      connectionPercentage = Math.round(userData.monthly_connection_avg);
    } else {
      const currentDate = new Date();
      const currentDay = currentDate.getDate();
      const currentPeriod = currentDay >= 1 && currentDay <= 15 ? '1-15' : '16-31';
      const periodDays = 13;
      const totalDaysWithActivity = calculatorData?.length || 0;
      connectionPercentage = periodDays > 0 ? Math.round((totalDaysWithActivity / periodDays) * 100) : 0;
    }

    // Procesar estadísticas por plataforma
    const platformStats = await Promise.all(platforms.map(async (platform) => {
      const platformHistory = calculatorData?.filter(data => 
        data.platform_id === platform.platform_id
      ) || [];

      const totalValue = platformHistory.reduce((sum, data) => sum + (data.value || 0), 0);
      const totalUsdBruto = platformHistory.reduce((sum, data) => sum + (data.usd_bruto || 0), 0);
      const totalUsdModelo = platformHistory.reduce((sum, data) => sum + (data.usd_modelo || 0), 0);
      const totalCopModelo = platformHistory.reduce((sum, data) => sum + (data.cop_modelo || 0), 0);
      const avgValue = platformHistory.length > 0 ? totalValue / platformHistory.length : 0;
      
      let dailyAvgQuincenal = 0;
      let trend = '=';
      
      try {
        const { data: movingAvgData, error: movingAvgError } = await supabase.rpc('get_moving_average_daily_avg', {
          p_model_id: modelId,
          p_platform_id: platform.platform_id,
          p_quincenas_back: 4
        });

        if (!movingAvgError && movingAvgData && movingAvgData.length > 0) {
          const avgData = movingAvgData[0];
          dailyAvgQuincenal = avgData.current_avg || 0;
          trend = avgData.trend || '=';
        } else {
          dailyAvgQuincenal = platformHistory.length > 0 ? totalUsdModelo / platformHistory.length : 0;
        }
      } catch (error) {
        dailyAvgQuincenal = platformHistory.length > 0 ? totalUsdModelo / platformHistory.length : 0;
      }

      const effectiveStatus = (platform.is_initial_config && platform.status !== 'desactivada')
        ? 'confirmada'
        : platform.status;

      return {
        ...platform,
        status: effectiveStatus,
        stats: {
          totalDays: platformHistory.length,
          connectionPercentage,
          totalValue,
          totalUsdBruto,
          totalUsdModelo,
          totalCopModelo,
          avgValue,
          avgUsdModelo: dailyAvgQuincenal,
          lastActivity: platformHistory[0]?.period_date || null,
          trend
        }
      };
    }));

    const totalPlatforms = platforms.length;
    const activePlatforms = platformStats.filter(p => p.status === 'confirmada').length;
    const pendingConfirmation = platformStats.filter(p => p.status === 'entregada' && !p.is_initial_config).length;
    const totalUsdModelo = platformStats.reduce((sum, p) => sum + p.stats.totalUsdModelo, 0);
    const totalCopModelo = platformStats.reduce((sum, p) => sum + p.stats.totalCopModelo, 0);

    const summary = {
      totalPlatforms,
      activePlatforms,
      pendingConfirmation,
      totalUsdModelo,
      totalCopModelo,
      avgUsdPerPlatform: totalPlatforms > 0 ? totalUsdModelo / totalPlatforms : 0
    };

    return NextResponse.json({ 
      success: true, 
      data: {
        platforms: platformStats,
        summary,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Error en portafolio de modelo:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
```

---

### 2.4 `docs/flujo-sistema-roles.md`

Contenido completo del archivo (flujos por rol, auditoría, seguridad, persistencia):

```markdown
# 🔄 DIAGRAMA DE FLUJO DEL SISTEMA IAM - POR ROLES

## 🏠 ARQUITECTURA GENERAL DEL SISTEMA
(Sistema IAM Modernizado - Smart Home Architecture)

## 🔐 FLUJO DE AUTENTICACIÓN INICIAL
Usuario → Login Page /login → Supabase Auth → Validación (email, password) → 
Obtener datos (auth.users, public.users, user_groups) → Redirección por rol

## 🎭 FLUJOS POR ROL
- SUPER ADMIN: Dashboard /admin/dashboard → Acceso total, gestión usuarios/grupos, auditoría, reportes.
- ADMIN: Dashboard /admin/dashboard → Gestión usuarios/grupos, reportes, auditoría limitada.
- MODELO: Dashboard /modelo/dashboard → Perfil personal, sesiones, grupos asignados, actividades limitadas.

## 🔄 GESTIÓN DE USUARIOS (SUPER ADMIN/ADMIN)
/admin/users → Lista usuarios → Acciones (Crear, Editar, Eliminar, Activar/Desactivar) → Modales → 
Validación → API (POST /api/users, PATCH /api/users/[id], DELETE) → Auditoría.

## 🔍 AUDITORÍA
/admin/audit → Logs (tabla, timestamp, usuario, IP) → Filtros (severidad, acción, estado, fecha) → Estadísticas.

## 🛡️ SEGURIDAD Y PERMISOS
Petición API → Middleware → Verificación (autenticación, permisos, organización) → Permitir/Denegar/Log.

## 📊 FLUJO DE DATOS
Frontend (React/Next.js) → API Routes /api/* → Supabase (auth.users, public.users, user_groups, audit_logs) → Validación → Respuesta JSON.

## 🎯 PUNTOS CLAVE
- Autenticación: usuario en auth.users, perfil en public.users, activo, organización válida.
- Autorización: Super Admin total; Admin limitada; Modelo solo perfil.
- Auditoría y seguridad en todas las acciones.

## 🔗 ENLACES
- Login: /login
- Dashboard Admin: /admin/dashboard
- Gestión Usuarios: /admin/users
- Auditoría: /admin/audit
```
(El archivo completo en el repo tiene diagramas ASCII detallados.)

---

## 3. Cómo usar esto para Desktop|AIM

- **Mis Plataformas:**  
  Llamar a `GET /api/modelo-portafolio?modelId=<UUID>` con el `modelId` de la modelo logueada (o con un token Bearer si en el futuro se añade auth a esta ruta). La respuesta tiene la misma estructura que usa el front actual.  
- **Credenciales para el navegador/desktop:**  
  Usar `GET /api/aim-browser/platform-credentials?model_id=<UUID>` o `POST` con body `{ model_id }` y `Authorization: Bearer <token>` para obtener login_url, usuario y contraseña por plataforma y alimentar el flujo de login automático.  
- **Cliente Supabase (solo si Desktop|AIM usa Supabase directo):**  
  Misma URL y anon key que en `lib/supabase.ts`; las políticas RLS y el rol en `public.users` definen qué puede ver cada usuario.

Si Antigravity necesita más archivos (p. ej. `lib/encryption` para el formato de cifrado, o tipos de `calculator_platforms` / `modelo_plataformas`), se pueden añadir al repo o a este mismo documento en una siguiente iteración.

---

*Documento generado para compartir con Antigravity. Última actualización: enero 2025.*
