/*
  Test de flujo de confirmación → activación automática en calculadora.

  Requisitos:
  - Variables de entorno: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  - Node 18+

  Uso:
    node scripts/test_confirm_flow.js --target https://iam-sistema-de-gestion.vercel.app
*/

const { createClient } = require('@supabase/supabase-js');

function getArg(name, def) {
  const idx = process.argv.indexOf(name);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return def;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const target = getArg('--target', 'http://localhost:3000');
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('🔍 Iniciando test de confirmación → activación automática');

  // 1) Elegir una modelo y una plataforma del catálogo
  const { data: model, error: modelErr } = await supabase
    .from('users')
    .select('id, role')
    .eq('role', 'modelo')
    .limit(1)
    .maybeSingle();
  if (modelErr || !model) throw new Error('No se pudo obtener una modelo');

  const { data: platform, error: platErr } = await supabase
    .from('calculator_platforms')
    .select('id, name, active')
    .eq('active', true)
    .order('name')
    .limit(1)
    .maybeSingle();
  if (platErr || !platform) throw new Error('No se pudo obtener una plataforma activa');

  const modelId = model.id;
  const platformId = platform.id;
  console.log('👤 Modelo:', modelId, '| 🧩 Plataforma:', platformId);

  // 2) Chequear si ya estaba en enabled_platforms para poder revertir correctamente
  const { data: existingConfig } = await supabase
    .from('calculator_config')
    .select('id, enabled_platforms')
    .eq('model_id', modelId)
    .eq('active', true)
    .maybeSingle();

  const alreadyEnabled = !!(existingConfig && Array.isArray(existingConfig.enabled_platforms) && existingConfig.enabled_platforms.includes(platformId));

  // 3) Sembrar un registro en modelo_plataformas con estado 'entregada' si no existe
  const { data: existingMp } = await supabase
    .from('modelo_plataformas')
    .select('*')
    .eq('model_id', modelId)
    .eq('platform_id', platformId)
    .maybeSingle();

  let createdTestRow = false;
  if (!existingMp) {
    const { error: insertErr } = await supabase
      .from('modelo_plataformas')
      .insert({
        model_id: modelId,
        platform_id: platformId,
        status: 'entregada',
        requested_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
        notes: '[TEST_CONFIRM_FLOW]'
      });
    if (insertErr) throw new Error('No se pudo insertar modelo_plataformas de prueba: ' + insertErr.message);
    createdTestRow = true;
  } else if (existingMp.status !== 'entregada' && existingMp.status !== 'confirmada') {
    // Pasar a entregada para poder confirmar
    const { error: updErr } = await supabase
      .from('modelo_plataformas')
      .update({ status: 'entregada', delivered_at: new Date().toISOString(), notes: '[TEST_CONFIRM_FLOW] set entregada' })
      .eq('model_id', modelId)
      .eq('platform_id', platformId);
    if (updErr) throw new Error('No se pudo preparar estado entregada: ' + updErr.message);
  }

  // 4) Llamar a la ruta de confirmación
  const confirmRes = await fetch(`${target}/api/modelo-portafolio/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platformId, modelId })
  });
  const confirmJson = await confirmRes.json().catch(() => ({}));
  if (!confirmRes.ok || !confirmJson.success) {
    throw new Error('Confirmación falló: ' + (confirmJson.error || confirmRes.status));
  }
  console.log('✅ Confirmación OK');

  // 5) Verificar efectos en DB
  const { data: mpAfter, error: mpErr } = await supabase
    .from('modelo_plataformas')
    .select('status, calculator_sync, calculator_activated_at')
    .eq('model_id', modelId)
    .eq('platform_id', platformId)
    .single();
  if (mpErr) throw new Error('Error consultando modelo_plataformas post-confirm: ' + mpErr.message);
  if (mpAfter.status !== 'confirmada' || mpAfter.calculator_sync !== true || !mpAfter.calculator_activated_at) {
    throw new Error('Efectos en modelo_plataformas no correctos');
  }

  const { data: cfgAfter, error: cfgErr } = await supabase
    .from('calculator_config')
    .select('id, enabled_platforms')
    .eq('model_id', modelId)
    .eq('active', true)
    .maybeSingle();
  if (cfgErr) throw new Error('Error consultando calculator_config: ' + cfgErr.message);
  if (!cfgAfter || !Array.isArray(cfgAfter.enabled_platforms) || !cfgAfter.enabled_platforms.includes(platformId)) {
    throw new Error('La plataforma no quedó habilitada en calculator_config');
  }
  console.log('✅ Activación en calculadora verificada');

  // 6) Limpieza
  // - Si no estaba enabled antes, removerla
  if (!alreadyEnabled) {
    const filtered = cfgAfter.enabled_platforms.filter((p) => p !== platformId);
    await supabase
      .from('calculator_config')
      .update({ enabled_platforms: filtered, updated_at: new Date().toISOString() })
      .eq('id', cfgAfter.id);
  }
  // - Si creamos el registro, eliminarlo; si lo modificamos, revertir a disponible
  if (createdTestRow) {
    await supabase
      .from('modelo_plataformas')
      .delete()
      .eq('model_id', modelId)
      .eq('platform_id', platformId)
      .eq('notes', '[TEST_CONFIRM_FLOW]');
  } else {
    await supabase
      .from('modelo_plataformas')
      .update({ status: 'disponible', confirmed_at: null, confirmed_by: null, calculator_sync: false, calculator_activated_at: null })
      .eq('model_id', modelId)
      .eq('platform_id', platformId);
  }

  console.log('🧹 Limpieza realizada');
  console.log('🎉 Test OK');
}

main().catch((err) => {
  console.error('❌ Test falló:', err.message || err);
  process.exit(1);
});






