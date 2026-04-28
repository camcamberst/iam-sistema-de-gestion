require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const startDate = '2026-04-16';
  const endDate = '2026-04-30';
  const userId = '0976437e-15e6-424d-8122-afb65580239a';

  const { data: totals } = await supabase
    .from('calculator_totals')
    .select('total_cop_modelo')
    .eq('model_id', userId)
    .gte('period_date', startDate)
    .lte('period_date', endDate)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log('TOTALS:', totals);

  // also query model_values for this model directly to calculate manually
  const { data: values } = await supabase
    .from('model_values')
    .select('*')
    .eq('model_id', userId)
    .gte('period_date', startDate)
    .lte('period_date', endDate);

  console.log('Model values count:', values?.length);
  
  // Try calling the API endpoint logic directly
  const res = await fetch('http://localhost:3000/api/shop/neto-disponible', {
    headers: {
      // Need a valid token to fetch this, or I can just print the exact math
      'Content-Type': 'application/json'
    }
  });
  
  // let's just print total_usd_modelo
  const { data: fullTotals } = await supabase
    .from('calculator_totals')
    .select('*')
    .eq('model_id', userId);
  console.log('Full totals:', fullTotals);

}
run();
