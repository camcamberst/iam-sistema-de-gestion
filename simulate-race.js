const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Starting race condition simulation...');
  
  const { data: inventories } = await supabase.from('shop_inventory').select('*');
  
  console.log('Waiting 20 seconds before zeroing stock...');
  await new Promise(r => setTimeout(r, 20000));
  
  // Set all to 0
  for (const inv of inventories) {
    await supabase.from('shop_inventory').update({ quantity: 0 }).eq('id', inv.id);
  }
  console.log('All stock set to 0! Race condition triggered!');
  
  // Wait 15 seconds
  console.log('Waiting 15 seconds for UI to show error...');
  await new Promise(r => setTimeout(r, 15000));
  
  // Restore all
  for (const inv of inventories) {
    await supabase.from('shop_inventory').update({ quantity: inv.quantity }).eq('id', inv.id);
  }
  console.log(`Stock restored.`);
}

run();
