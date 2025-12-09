import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// GET: Obtener todas las plataformas disponibles
export async function GET() {
  try {
    console.log('🔍 [API-PLATFORMS] Iniciando consulta a calculator_platforms...');
    
    const { data, error } = await supabase
      .from('calculator_platforms')
      .select('*')
      .eq('active', true)
      .order('name');

    console.log('🔍 [API-PLATFORMS] Error de Supabase:', error);
    console.log('🔍 [API-PLATFORMS] Data raw:', data);
    console.log('🔍 [API-PLATFORMS] Data type:', typeof data);
    console.log('🔍 [API-PLATFORMS] Data length:', data?.length);
    console.log('🔍 [API-PLATFORMS] Data is array:', Array.isArray(data));

    if (error) {
      console.error('❌ [API-PLATFORMS] Error al obtener plataformas:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const response = {
      success: true,
      config: {
        platforms: data || []
      }
    };

    console.log('🔍 [API-PLATFORMS] Response final:', response);
    console.log('🔍 [API-PLATFORMS] Response platforms length:', response.config.platforms?.length);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ [API-PLATFORMS] Error en /api/calculator/platforms:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}

// POST: Crear nueva plataforma (solo Super Admin)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      id, 
      name, 
      description, 
      currency, 
      token_rate, 
      discount_factor, 
      tax_rate, 
      direct_payout,
      payment_frequency,
      created_by 
    } = body;

    console.log('🔍 [API-PLATFORMS-POST] Iniciando creación de plataforma:', { id, name, currency });

    // 1. VALIDACIÓN DE PERMISOS
    if (!created_by) {
      return NextResponse.json({ 
        success: false, 
        error: 'created_by es requerido' 
      }, { status: 400 });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', created_by)
      .single();

    if (userError || !user || user.role !== 'super_admin') {
      console.error('❌ [API-PLATFORMS-POST] Usuario no autorizado:', { userError, user });
      return NextResponse.json({ 
        success: false, 
        error: 'Solo Super Admins pueden crear plataformas' 
      }, { status: 403 });
    }

    // 2. VALIDACIÓN DE CAMPOS OBLIGATORIOS
    if (!id || !name || !currency) {
      return NextResponse.json({ 
        success: false, 
        error: 'id, name y currency son requeridos' 
      }, { status: 400 });
    }

    // 3. VALIDACIÓN DE FORMATO DE ID
    const idRegex = /^[a-z0-9_-]+$/;
    const normalizedId = id.toLowerCase().trim();
    if (!idRegex.test(normalizedId)) {
      return NextResponse.json({ 
        success: false, 
        error: 'ID debe contener solo letras minúsculas, números, guiones y guiones bajos' 
      }, { status: 400 });
    }

    // 4. VALIDACIÓN DE CURRENCY
    const validCurrencies = ['USD', 'EUR', 'GBP'];
    const normalizedCurrency = currency.toUpperCase();
    if (!validCurrencies.includes(normalizedCurrency)) {
      return NextResponse.json({ 
        success: false, 
        error: 'currency debe ser USD, EUR o GBP' 
      }, { status: 400 });
    }

    // 5. VALIDACIÓN DE ID ÚNICO
    const { data: existingPlatform, error: checkError } = await supabase
      .from('calculator_platforms')
      .select('id')
      .eq('id', normalizedId)
      .single();

    if (existingPlatform) {
      console.error('❌ [API-PLATFORMS-POST] ID duplicado:', normalizedId);
      return NextResponse.json({ 
        success: false, 
        error: 'Ya existe una plataforma con ese ID' 
      }, { status: 409 });
    }

    // 6. VALIDACIÓN DE LÓGICA DE NEGOCIO
    const hasTokenRate = token_rate !== null && token_rate !== undefined && token_rate !== '';
    const hasDiscountFactor = discount_factor !== null && discount_factor !== undefined && discount_factor !== '';
    const hasTaxRate = tax_rate !== null && tax_rate !== undefined && tax_rate !== '';
    const isDirectPayout = direct_payout === true;

    // Validar según tipo de plataforma
    if (normalizedCurrency === 'USD' && hasTokenRate) {
      // Tipo: Tokens
      if (hasDiscountFactor || hasTaxRate) {
        return NextResponse.json({ 
          success: false, 
          error: 'Plataformas con token_rate no pueden tener discount_factor o tax_rate' 
        }, { status: 400 });
      }
      const tokenRateValue = Number(token_rate);
      if (isNaN(tokenRateValue) || tokenRateValue <= 0 || tokenRateValue > 1) {
        return NextResponse.json({ 
          success: false, 
          error: 'token_rate debe ser un número entre 0 y 1' 
        }, { status: 400 });
      }
    } else if (normalizedCurrency === 'USD' && !hasTokenRate) {
      // Tipo: USD con descuento o directo
      if (isDirectPayout && (hasDiscountFactor || hasTaxRate)) {
        return NextResponse.json({ 
          success: false, 
          error: 'Plataformas con direct_payout no pueden tener discount_factor o tax_rate' 
        }, { status: 400 });
      }
      if (hasDiscountFactor) {
        const discountValue = Number(discount_factor);
        if (isNaN(discountValue) || discountValue <= 0 || discountValue > 1) {
          return NextResponse.json({ 
            success: false, 
            error: 'discount_factor debe ser un número entre 0 y 1' 
          }, { status: 400 });
        }
      }
    } else if (normalizedCurrency === 'EUR' || normalizedCurrency === 'GBP') {
      // Tipo: EUR o GBP
      if (hasTokenRate) {
        return NextResponse.json({ 
          success: false, 
          error: 'Plataformas EUR/GBP no pueden tener token_rate' 
        }, { status: 400 });
      }
      if (hasDiscountFactor) {
        const discountValue = Number(discount_factor);
        if (isNaN(discountValue) || discountValue <= 0 || discountValue > 1) {
          return NextResponse.json({ 
            success: false, 
            error: 'discount_factor debe ser un número entre 0 y 1' 
          }, { status: 400 });
        }
      }
      if (hasTaxRate) {
        const taxValue = Number(tax_rate);
        if (isNaN(taxValue) || taxValue < 0 || taxValue > 1) {
          return NextResponse.json({ 
            success: false, 
            error: 'tax_rate debe ser un número entre 0 y 1' 
          }, { status: 400 });
        }
      }
    }

    // 7. VALIDACIÓN DE PAYMENT_FREQUENCY
    if (payment_frequency && !['quincenal', 'mensual'].includes(payment_frequency)) {
      return NextResponse.json({ 
        success: false, 
        error: 'payment_frequency debe ser "quincenal" o "mensual"' 
      }, { status: 400 });
    }

    // 8. PREPARAR DATOS PARA INSERCIÓN
    const platformData: any = {
      id: normalizedId,
      name: name.trim(),
      description: description?.trim() || null,
      currency: normalizedCurrency,
      token_rate: hasTokenRate ? Number(token_rate) : null,
      discount_factor: hasDiscountFactor ? Number(discount_factor) : null,
      tax_rate: hasTaxRate ? Number(tax_rate) : null,
      direct_payout: isDirectPayout || false,
      payment_frequency: payment_frequency || 'quincenal',
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('🔍 [API-PLATFORMS-POST] Datos a insertar:', platformData);

    // 9. CREAR PLATAFORMA
    const { data: newPlatform, error: insertError } = await supabase
      .from('calculator_platforms')
      .insert(platformData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ [API-PLATFORMS-POST] Error al crear plataforma:', insertError);
      return NextResponse.json({ 
        success: false, 
        error: insertError.message || 'Error al crear plataforma' 
      }, { status: 500 });
    }

    console.log('✅ [API-PLATFORMS-POST] Plataforma creada exitosamente:', newPlatform.id);

    return NextResponse.json({ 
      success: true, 
      platform: newPlatform,
      message: 'Plataforma creada exitosamente' 
    });

  } catch (error: any) {
    console.error('❌ [API-PLATFORMS-POST] Error en POST:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}

// PATCH: Actualizar payment_frequency de una plataforma
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { platformId, payment_frequency } = body;

    if (!platformId || !payment_frequency) {
      return NextResponse.json({ 
        success: false, 
        error: 'platformId y payment_frequency son requeridos' 
      }, { status: 400 });
    }

    if (!['quincenal', 'mensual'].includes(payment_frequency)) {
      return NextResponse.json({ 
        success: false, 
        error: 'payment_frequency debe ser "quincenal" o "mensual"' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('calculator_platforms')
      .update({ 
        payment_frequency,
        updated_at: new Date().toISOString()
      })
      .eq('id', platformId)
      .select()
      .single();

    if (error) {
      console.error('❌ [API-PLATFORMS] Error al actualizar plataforma:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, platform: data });

  } catch (error: any) {
    console.error('❌ [API-PLATFORMS] Error en PATCH:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
