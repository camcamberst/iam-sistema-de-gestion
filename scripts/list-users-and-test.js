/**
 * Listar usuarios y probar endpoints
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch').default || require('node-fetch');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('\n🔍 Buscando usuarios...\n');

  // Buscar super_admin
  const { data: superAdmins } = await supabase
    .from('users')
    .select('id, email, name, role')
    .eq('role', 'super_admin')
    .limit(5);

  console.log(`📊 Super Admins encontrados: ${superAdmins?.length || 0}`);
  superAdmins?.forEach((u, i) => {
    console.log(`   ${i + 1}. ${u.email} - ${u.name || 'Sin nombre'}`);
  });

  // Buscar admins
  const { data: admins } = await supabase
    .from('users')
    .select('id, email, name, role')
    .eq('role', 'admin')
    .limit(5);

  console.log(`\n📊 Admins encontrados: ${admins?.length || 0}`);
  admins?.forEach((u, i) => {
    console.log(`   ${i + 1}. ${u.email} - ${u.name || 'Sin nombre'}`);
  });

  // Probar endpoints
  console.log('\n🧪 Probando endpoints...\n');

  // Test 1: Check Status
  try {
    const res1 = await fetch(`${API_URL}/api/calculator/period-closure/check-status`);
    const data1 = await res1.json();
    console.log('✅ Check Status:', JSON.stringify(data1, null, 2));
  } catch (error) {
    console.log('❌ Check Status error:', error.message);
  }

  // Test 2: Platform Freeze Status (necesita modelId)
  if (superAdmins && superAdmins.length > 0) {
    try {
      const res2 = await fetch(`${API_URL}/api/calculator/period-closure/platform-freeze-status?modelId=${superAdmins[0].id}`);
      const data2 = await res2.json();
      console.log('\n✅ Platform Freeze Status:', JSON.stringify(data2, null, 2));
    } catch (error) {
      console.log('\n❌ Platform Freeze Status error:', error.message);
    }
  }

  // Test 3: Verificar estado en BD
  const { data: statusData } = await supabase
    .from('calculator_period_closure_status')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log(`\n📊 Estados de cierre en BD: ${statusData?.length || 0}`);
  statusData?.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.period_date} - ${s.status}`);
  });
}

main().catch(console.error);

