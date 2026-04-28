import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('modelId');
  const periodDate = searchParams.get('periodDate') || new Date().toISOString().split('T')[0];

  console.log('🔍 [DEBUG-MODEL-VALUES] Starting debug...');
  console.log('🔍 [DEBUG-MODEL-VALUES] ModelId:', modelId);
  console.log('🔍 [DEBUG-MODEL-VALUES] PeriodDate:', periodDate);

  try {
    // 1. Verificar conexión a Supabase
    console.log('🔍 [DEBUG-MODEL-VALUES] Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('model_values')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.log('❌ [DEBUG-MODEL-VALUES] Supabase connection failed:', testError);
      return NextResponse.json({ 
        success: false, 
        error: 'Supabase connection failed',
        details: testError 
      }, { status: 500 });
    }
    
    console.log('✅ [DEBUG-MODEL-VALUES] Supabase connection OK');

    // 2. Verificar si existen datos para el modelo
    console.log('🔍 [DEBUG-MODEL-VALUES] Checking if data exists for model...');
    const { data: allData, error: allError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId);
    
    console.log('🔍 [DEBUG-MODEL-VALUES] All data for model:', allData?.length || 0);
    console.log('🔍 [DEBUG-MODEL-VALUES] All data error:', allError);

    // 3. Verificar datos para el período específico
    console.log('🔍 [DEBUG-MODEL-VALUES] Checking data for specific period...');
    const { data: periodData, error: periodError } = await supabase
      .from('model_values')
      .select('*')
      .eq('model_id', modelId)
      .eq('period_date', periodDate);
    
    console.log('🔍 [DEBUG-MODEL-VALUES] Period data:', periodData?.length || 0);
    console.log('🔍 [DEBUG-MODEL-VALUES] Period error:', periodError);

    // 4. Verificar estructura de la tabla
    console.log('🔍 [DEBUG-MODEL-VALUES] Checking table structure...');
    const { data: structureData, error: structureError } = await supabase
      .rpc('get_table_columns', { table_name: 'model_values' });
    
    console.log('🔍 [DEBUG-MODEL-VALUES] Table structure:', structureData);
    console.log('🔍 [DEBUG-MODEL-VALUES] Structure error:', structureError);

    return NextResponse.json({
      success: true,
      debug: {
        supabaseConnection: testError ? false : true,
        allDataCount: allData?.length || 0,
        periodDataCount: periodData?.length || 0,
        allData: allData || [],
        periodData: periodData || [],
        structureData: structureData || null,
        errors: {
          test: testError,
          all: allError,
          period: periodError,
          structure: structureError
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [DEBUG-MODEL-VALUES] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor',
      stack: error.stack
    }, { status: 500 });
  }
}
