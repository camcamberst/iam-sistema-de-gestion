import { NextRequest, NextResponse } from 'next/server';

// Datos mock (mismo que en route.ts - en producción sería BD)
let mockRates = [
  {
    id: '1',
    scope: 'global',
    kind: 'USD_COP',
    value_raw: 4094,
    adjustment: -200,
    value_effective: 3894,
    source: 'system',
    author_id: 'system',
    valid_from: new Date('2024-01-01T00:00:00Z'),
    valid_to: null,
    period_base: true,
    created_at: new Date('2024-01-01T00:00:00Z')
  },
  {
    id: '2',
    scope: 'global',
    kind: 'EUR_USD',
    value_raw: 1.01,
    adjustment: 0,
    value_effective: 1.01,
    source: 'ECB',
    author_id: 'system',
    valid_from: new Date('2024-01-01T00:00:00Z'),
    valid_to: null,
    period_base: true,
    created_at: new Date('2024-01-01T00:00:00Z')
  },
  {
    id: '3',
    scope: 'global',
    kind: 'GBP_USD',
    value_raw: 1.2,
    adjustment: 0,
    value_effective: 1.2,
    source: 'OXR',
    author_id: 'system',
    valid_from: new Date('2024-01-01T00:00:00Z'),
    valid_to: null,
    period_base: true,
    created_at: new Date('2024-01-01T00:00:00Z')
  }
];

export const dynamic = 'force-dynamic';

// GET /api/rates/[id] - Obtener tasa específica
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rate = mockRates.find(r => r.id === params.id);
    
    if (!rate) {
      return NextResponse.json(
        { success: false, error: 'Tasa no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: rate
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Error al obtener tasa' },
      { status: 500 }
    );
  }
}

// PATCH /api/rates/[id] - Actualizar tasa
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { value_effective, adjustment, source, author_id } = body;

    const rateIndex = mockRates.findIndex(r => r.id === params.id);
    
    if (rateIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Tasa no encontrada' },
        { status: 404 }
      );
    }

    // Actualizar campos permitidos
    if (value_effective !== undefined) {
      mockRates[rateIndex].value_effective = value_effective;
    }
    if (adjustment !== undefined) {
      mockRates[rateIndex].adjustment = adjustment;
    }
    if (source) {
      mockRates[rateIndex].source = source;
    }
    if (author_id) {
      mockRates[rateIndex].author_id = author_id;
    }

    return NextResponse.json({
      success: true,
      data: mockRates[rateIndex],
      message: 'Tasa actualizada exitosamente'
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Error al actualizar tasa' },
      { status: 500 }
    );
  }
}

// DELETE /api/rates/[id] - Eliminar tasa (marcar como inactiva)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateIndex = mockRates.findIndex(r => r.id === params.id);
    
    if (rateIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Tasa no encontrada' },
        { status: 404 }
      );
    }

    // Marcar como inactiva (no eliminar físicamente)
    mockRates[rateIndex].valid_to = new Date().toISOString();

    return NextResponse.json({
      success: true,
      message: 'Tasa eliminada exitosamente'
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message ?? 'Error al eliminar tasa' },
      { status: 500 }
    );
  }
}
