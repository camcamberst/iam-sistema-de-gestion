import { NextRequest, NextResponse } from 'next/server';
import { getColombiaDate, getCurrentCalculatorPeriod } from '@/utils/calculator-dates';

// CRON JOB: Cierre automático de calculadora
// Se ejecuta los días 15 y 30 a las 17:00 Colombia (sincronizado con medianoche europea)
export async function GET(request: NextRequest) {
  try {
    console.log('🕐 [CRON] Iniciando cierre automático de calculadora...');
    
    const currentDate = getColombiaDate();
    const period = getCurrentCalculatorPeriod();
    
    console.log('🕐 [CRON] Fecha actual:', currentDate);
    console.log('🕐 [CRON] Período:', period.description);
    
    // Verificar si es un día de corte (15 o 30)
    const today = new Date();
    const day = today.getDate();
    
    if (day !== 15 && day !== 30) {
      console.log('🕐 [CRON] No es día de corte. Día actual:', day);
      return NextResponse.json({
        success: true,
        message: 'No es día de corte automático',
        current_day: day,
        cutoff_days: [15, 30]
      });
    }
    
    console.log('🕐 [CRON] Es día de corte. Ejecutando cierre automático...');
    
    // Llamar al endpoint de cierre automático
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/calculator/auto-close-period`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET_KEY || 'cron-secret'}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ [CRON] Error en cierre automático:', errorData);
      return NextResponse.json({
        success: false,
        error: 'Error ejecutando cierre automático',
        details: errorData
      }, { status: 500 });
    }
    
    const result = await response.json();
    
    console.log('✅ [CRON] Cierre automático completado:', result);
    
    return NextResponse.json({
      success: true,
      message: 'Cierre automático ejecutado exitosamente',
      execution_time: new Date().toISOString(),
      period: period.description,
      date: currentDate,
      results: result
    });
    
  } catch (error) {
    console.error('❌ [CRON] Error en cron job:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

// POST: Ejecutar manualmente (para testing)
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [CRON-MANUAL] Ejecutando cierre manual...');
    
    const currentDate = getColombiaDate();
    const period = getCurrentCalculatorPeriod();
    
    // Llamar al endpoint de cierre automático
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/calculator/auto-close-period`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET_KEY || 'cron-secret'}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ [CRON-MANUAL] Error en cierre automático:', errorData);
      return NextResponse.json({
        success: false,
        error: 'Error ejecutando cierre automático',
        details: errorData
      }, { status: 500 });
    }
    
    const result = await response.json();
    
    console.log('✅ [CRON-MANUAL] Cierre manual completado:', result);
    
    return NextResponse.json({
      success: true,
      message: 'Cierre manual ejecutado exitosamente',
      execution_time: new Date().toISOString(),
      period: period.description,
      date: currentDate,
      results: result
    });
    
  } catch (error) {
    console.error('❌ [CRON-MANUAL] Error en cierre manual:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
