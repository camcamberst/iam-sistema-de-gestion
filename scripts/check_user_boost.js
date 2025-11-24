require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan variables de entorno SUPABASE_URL o SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser(searchTerm) {
  console.log(`\n🔍 Buscando término: "${searchTerm}"`);

  // 1. Búsqueda exacta como la hace Botty
  const { data: exactData, error: exactError } = await supabase
    .from('users')
    .select('id, full_name, email, role')
    .in('role', ['modelo', 'model', 'user'])
    .or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);

  if (exactError) console.error('❌ Error búsqueda exacta:', exactError);
  else {
    console.log(`📊 Resultados búsqueda exacta: ${exactData.length}`);
    exactData.forEach(u => console.log(`   ✅ ${u.full_name} | ${u.email} | Rol: ${u.role}`));
  }

  // 2. Búsqueda amplia (sin filtro de rol) para ver si existe pero tiene otro rol
  const { data: anyRoleData } = await supabase
    .from('users')
    .select('id, full_name, email, role')
    .or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);

  if (anyRoleData && anyRoleData.length > 0) {
    console.log(`\n🌍 Resultados sin filtro de rol: ${anyRoleData.length}`);
    anyRoleData.forEach(u => {
        const match = exactData.find(e => e.id === u.id);
        if (!match) console.log(`   ⚠️ ${u.full_name} | ${u.email} | Rol: ${u.role} (NO MATCHEA FILTRO DE ROL)`);
    });
  } else {
      console.log('\n❌ No se encontró ningún usuario con ese nombre/email en NINGÚN rol.');
  }
}

checkUser('hollyrogers');



