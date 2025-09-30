import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener tasas activas para la calculadora
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [RATES-ACTIVE] Loading active rates...');

    // Obtener tasas activas
    const { data: rates, error } = await supabase
      .from('rates')
      .select('*')
      .eq('active', true)
      .is('valid_to', null)
      .order('valid_from', { ascending: false });

    if (error) {
      console.error('Error al obtener tasas:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Formatear tasas para la calculadora
    const activeRates = {
      usd_cop: rates.find(r => r.kind === 'USD→COP')?.value || 3900,
      eur_usd: rates.find(r => r.kind === 'EUR→USD')?.value || 1.01,
      gbp_usd: rates.find(r => r.kind === 'GBP→USD')?.value || 1.20
    };

    console.log('🔍 [RATES-ACTIVE] Active rates:', activeRates);
    return NextResponse.json({ success: true, rates: activeRates });

  } catch (error: any) {
    console.error('❌ [RATES-ACTIVE] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
