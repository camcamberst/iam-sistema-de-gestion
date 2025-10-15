'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface BillingSummaryCompactProps {
  userRole: 'admin' | 'super_admin';
  userId: string;
}

interface BillingData {
  modelId: string;
  email: string;
  name: string;
  organizationId: string;
  groupId: string;
  groupName: string;
  usdBruto: number;
  usdModelo: number;
  usdSede: number;
  copModelo: number;
  copSede: number;
}

interface Summary {
  totalModels: number;
  totalUsdBruto: number;
  totalUsdModelo: number;
  totalUsdSede: number;
  totalCopModelo: number;
  totalCopSede: number;
}

export default function BillingSummaryCompact({ userRole, userId }: BillingSummaryCompactProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    if (currency === 'COP') {
      return new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    }
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const loadBillingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const today = new Date().toISOString().split('T')[0];
      const params = new URLSearchParams({
        adminId: userId,
        userRole,
        periodDate: today,
      });

      const response = await fetch(`/api/admin/billing-summary?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar los datos');
      }

      // Calcular resumen
      const billingData: BillingData[] = data.data || [];
      const summaryData: Summary = {
        totalModels: billingData.length,
        totalUsdBruto: billingData.reduce((sum, model) => sum + model.usdBruto, 0),
        totalUsdModelo: billingData.reduce((sum, model) => sum + model.usdModelo, 0),
        totalUsdSede: billingData.reduce((sum, model) => sum + model.usdSede, 0),
        totalCopModelo: billingData.reduce((sum, model) => sum + model.copModelo, 0),
        totalCopSede: billingData.reduce((sum, model) => sum + model.copSede, 0),
      };

      setSummary(summaryData);
    } catch (error: any) {
      console.error('Error loading billing data:', error);
      setError(error.message || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId && userRole) {
      loadBillingData();
    }
  }, [userId, userRole]);

  if (loading) {
    return (
      <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-md flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">Resumen de Facturación</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-6 h-6 bg-gradient-to-br from-red-500 to-red-600 rounded-md flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">Resumen de Facturación</h3>
        </div>
        <div className="text-center py-4">
          <div className="text-sm text-red-600 mb-2">{error}</div>
          <button
            onClick={loadBillingData}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 hover:shadow-xl hover:bg-white/95 hover:scale-[1.02] transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-md flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">Resumen de Facturación</h3>
        </div>
        <Link 
          href="/admin/sedes/dashboard" 
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          Ver completo →
        </Link>
      </div>

      {summary && (
        <div className="space-y-3">
          {/* Resumen compacto */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-gray-50/80">
              <div className="text-lg font-bold text-gray-800">${formatCurrency(summary.totalUsdBruto)}</div>
              <div className="text-xs text-gray-600">USD Bruto</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-50/80">
              <div className="text-lg font-bold text-green-600">${formatCurrency(summary.totalUsdModelo)}</div>
              <div className="text-xs text-gray-600">USD Modelo</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-orange-50/80">
              <div className="text-lg font-bold text-orange-600">${formatCurrency(summary.totalUsdSede)}</div>
              <div className="text-xs text-gray-600">USD Sede</div>
            </div>
          </div>

          {/* Información adicional compacta */}
          <div className="text-center pt-2 border-t border-gray-200/50">
            <div className="text-xs text-gray-500">
              {summary.totalModels} modelos • {userRole === 'super_admin' ? 'Todas las sedes' : 'Tu sede'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
