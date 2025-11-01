/**
 * Verificar rol de usuario en Supabase
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function verifyUserRole() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const email = 'cardozosergio@gmail.com';

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, name, role, is_active')
    .eq('email', email)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!user) {
    console.log('❌ Usuario no encontrado');
    return;
  }

  console.log('✅ Usuario encontrado:');
  console.log('   ID:', user.id);
  console.log('   Email:', user.email);
  console.log('   Nombre:', user.name);
  console.log('   Rol:', user.role);
  console.log('   Activo:', user.is_active);

  if (user.role !== 'super_admin') {
    console.log('\n⚠️ El usuario no tiene rol super_admin');
    console.log('   Actual:', user.role);
    console.log('   Requerido: super_admin');
  }
}

verifyUserRole().catch(console.error);

