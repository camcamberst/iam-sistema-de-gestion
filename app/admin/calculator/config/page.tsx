'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AppleDropdown from '@/components/ui/AppleDropdown';
import PageHeader from '@/components/ui/PageHeader';
import { supabase } from '@/lib/supabase';

interface Model {
  id: string;
  email: string;
  name: string;
  groups: Array<{ id: string; name: string }>;
  hasConfig: boolean;
  currentConfig: any;
}

interface Platform {
  id: string;
  name: string;
  description: string;
  currency: string;
  token_rate: number | null;
  discount_factor: number | null;
  tax_rate: number | null;
  direct_payout: boolean;
  payment_frequency?: 'quincenal' | 'mensual'; // 🔧 NUEVO: Frecuencia de pago
}

// Porcentajes estandarizados por grupos
// Modelos presenciales (pertenecen a una sede): 60%
// Modelos Satélite: 80%
// Modelos Otros: 70%
const getStandardPercentageByGroup = (groupName: string): number => {
  // Normalizar nombre del grupo (case insensitive)
  const normalizedName = groupName?.trim() || '';
  
  // Grupos Satélite
  if (normalizedName.toLowerCase().includes('satélite') || normalizedName.toLowerCase().includes('satelite')) {
    return 80;
  }
  
  // Grupo Otros
  if (normalizedName.toLowerCase() === 'otros') {
    return 70;
  }
  
  // Todos los demás grupos son sedes (modelos presenciales): 60%
  // Esto incluye: Cabecera, Diamante, Sede MP, Terrazas, Victoria, y cualquier otra sede
  return 60;
};

// Objetivos estandarizados por grupos (en USD)
// Modelos presenciales (pertenecen a una sede): 500 USD
// Modelos Satélite: 800 USD
// Modelos Otros: 1000 USD
const getStandardGoalByGroup = (groupName: string): number => {
  // Normalizar nombre del grupo (case insensitive)
  const normalizedName = groupName?.trim() || '';
  
  // Grupos Satélite
  if (normalizedName.toLowerCase().includes('satélite') || normalizedName.toLowerCase().includes('satelite')) {
    return 800;
  }
  
  // Grupo Otros
  if (normalizedName.toLowerCase() === 'otros') {
    return 1000;
  }
  
  // Todos los demás grupos son sedes (modelos presenciales): 500 USD
  return 500;
};

// Función para obtener el color del estado del Portafolio (Zero-Bubble Rule)
const getPortfolioStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'entregada': 
    case 'confirmada':
      return 'text-green-500 drop-shadow-[0_0_4px_rgba(34,197,94,0.8)]';
    case 'pendiente': 
      return 'text-yellow-500 drop-shadow-[0_0_4px_rgba(234,179,8,0.8)]';
    case 'solicitada': 
      return 'text-blue-500 drop-shadow-[0_0_4px_rgba(59,130,246,0.8)]';
    case 'inviable': 
      return 'text-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.8)]';
    case 'desactivada': 
      return 'text-white/50 drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]';
    default: 
      return 'text-white/50 drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]';
  }
};

// Función para renderizar el icono de estado en lugar de texto (Zero-Bubble Rule)
const renderPortfolioStatus = (status: string) => {
  switch (status.toLowerCase()) {
    case 'entregada':
    case 'confirmada':
    case 'disponible':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <title>{status}</title>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'pendiente':
    case 'solicitada':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <title>{status}</title>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'inviable':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <title>{status}</title>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <title>{status}</title>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      );
  }
};

export default function ConfigCalculatorPage() {
  const router = useRouter();
  
  // Estados principales
  const [models, setModels] = useState<Model[]>([]);
  const [allModels, setAllModels] = useState<Model[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para filtro por grupo
  const [availableGroups, setAvailableGroups] = useState<Array<{id: string, name: string}>>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Estado para buscar modelo
  const [searchQuery, setSearchQuery] = useState('');
  
  // Estados de configuración
  const [enabledPlatforms, setEnabledPlatforms] = useState<string[]>([]);
  const [percentageOverride, setPercentageOverride] = useState<string>('');
  const [minQuotaOverride, setMinQuotaOverride] = useState<string>('');
  const [groupPercentage, setGroupPercentage] = useState<string>('');
  const [groupMinQuota, setGroupMinQuota] = useState<string>('');
  const [portfolioData, setPortfolioData] = useState<Record<string, any>>({});
  
  // Estados para secciones colapsables (móvil)
  const [expandedSections, setExpandedSections] = useState({
    platforms: true,
    reparto: false
  });
  const [isMobile, setIsMobile] = useState(false);
  const [expandedPlatformDescriptions, setExpandedPlatformDescriptions] = useState<Record<string, boolean>>({});
  const [activeSlide, setActiveSlide] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Modelos filtrados por la búsqueda
  const filteredModelsForDropdown = useMemo(() => {
    let result = models;
    if (searchQuery.trim() !== '') {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(m => 
        (m.name && m.name.toLowerCase().includes(lowerQuery)) || 
        (m.email && m.email.toLowerCase().includes(lowerQuery))
      );
    }
    return result;
  }, [models, searchQuery]);

  useEffect(() => {
    loadData();
  }, []);

  // Detectar si estamos en móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Expandir sección de configuración automáticamente cuando se selecciona un modelo
  useEffect(() => {
    if (selectedModel && isMobile) {
      setExpandedSections(prev => ({
        ...prev,
        platforms: true
      }));
    }
  }, [selectedModel, isMobile]);

  // Cargar grupos desde API con filtro de afiliado
  const loadGroups = async (userData?: any) => {
    try {
      console.log('🔍 [LOAD-GROUPS] Cargando grupos desde API...');
      
      // Obtener token de autenticación
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error('❌ [LOAD-GROUPS] No hay token de autenticación');
        return;
      }
      
      // Cargar grupos desde /api/groups que ya aplica el filtro de afiliado
      const response = await fetch('/api/groups', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.error('❌ [LOAD-GROUPS] Error en response:', response.status);
        return;
      }
      
      const data = await response.json();
      console.log('🔍 [LOAD-GROUPS] Response data:', data);
      
      if (data.success && data.groups) {
        const filteredGroups = data.groups
          .map((g: any) => ({ id: g.id, name: g.name }));
        
        console.log('✅ [LOAD-GROUPS] Grupos cargados y filtrados:', filteredGroups.length);
        console.log('🔍 [LOAD-GROUPS] Grupos:', filteredGroups.map((g: any) => g.name));
        
        // Usar userData pasado como parámetro
        const userForFilter = userData;
        
        // Si es admin (no super_admin), filtrar por sus grupos asignados
        if (userForFilter && userForFilter.role === 'admin' && userForFilter.groups?.length > 0) {
          const userGroupIds = userForFilter.groups.map((g: any) => g.id || g);
          const adminGroups = filteredGroups.filter((group: any) => 
            userGroupIds.includes(group.id)
          );
          console.log('🔍 [LOAD-GROUPS] Grupos filtrados para admin:', adminGroups.length);
          setAvailableGroups(adminGroups);
        } else {
          setAvailableGroups(filteredGroups);
        }
      } else {
        console.error('❌ [LOAD-GROUPS] Error en response:', data.error);
      }
    } catch (err: any) {
      console.error('❌ [LOAD-GROUPS] Error en catch:', err);
    }
  };

  const loadData = async () => {
    try {
      console.log('🔍 [LOAD] Iniciando loadData...');
      setLoading(true);
      setError(null);

      // Cargar datos del usuario actual
      console.log('🔍 [LOAD] Cargando datos del usuario...');
      const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || 'current-user';
      console.log('🔍 [LOAD] User data:', user);
      setCurrentUser(user);
      
      // Cargar modelos disponibles
      console.log('🔍 [LOAD] Cargando modelos...');
      const modelsResponse = await fetch(`/api/calculator/models?adminId=${userId}`);
      console.log('🔍 [LOAD] Models response status:', modelsResponse.status);
      const modelsData = await modelsResponse.json();
      console.log('🔍 [LOAD] Models data:', modelsData);

      if (!modelsData.success) {
        throw new Error(modelsData.error || 'Error al cargar modelos');
      }

      setAllModels(modelsData.models);
      setModels(modelsData.models);
      
      // Los grupos ahora se cargan desde /api/groups con filtro de afiliado
      // No extraer grupos de los modelos para evitar mezclar Innova con afiliados
      await loadGroups(user);
      console.log('✅ [LOAD] Modelos cargados. Grupos se cargan por separado desde /api/groups');
      console.log('🔍 [LOAD] Models set successfully');

      // Cargar plataformas disponibles
      console.log('🔍 [LOAD] Cargando plataformas...');
      const platformsResponse = await fetch('/api/calculator/platforms');
      console.log('🔍 [LOAD] Platforms response status:', platformsResponse.status);
      const platformsData = await platformsResponse.json();
      console.log('🔍 [LOAD] Platforms data:', platformsData);

      if (!platformsData.success) {
        throw new Error(platformsData.error || 'Error al cargar plataformas');
      }

      // 🔧 FIX: Usar estado normal de React
      const platformsArray = platformsData.config?.platforms || [];
      setPlatforms(platformsArray);
      console.log('🔍 [LOAD] platforms set with:', platformsArray.length, 'plataformas');
      console.log('🔍 [LOAD] loadData completado exitosamente');

    } catch (err: any) {
      console.error('❌ [LOAD] Error en loadData:', err);
      setError(err.message || 'Error al cargar datos');
    } finally {
      console.log('🔍 [LOAD] Setting loading to false');
      setLoading(false);
    }
  };

  const handleModelSelect = async (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    if (!model) return;

    setSelectedModel(model);
    setHasChanges(false);

    // Cargar configuración existente si la hay
    if (model.hasConfig && model.currentConfig) {
      const config = model.currentConfig;
      setEnabledPlatforms(config.enabled_platforms || []);
      setPercentageOverride(config.percentage_override?.toString() || '');
      setMinQuotaOverride(config.min_quota_override?.toString() || '');
      
      // Si no hay group_percentage o es 0, usar el estándar del grupo
      const groupName = model.groups[0]?.name;
      if (config.group_percentage && config.group_percentage > 0) {
        setGroupPercentage(config.group_percentage.toString());
      } else if (groupName) {
        const standardPercentage = getStandardPercentageByGroup(groupName);
        setGroupPercentage(standardPercentage.toString());
        console.log(`🔍 [EXISTING CONFIG] Usando porcentaje estándar para ${groupName}: ${standardPercentage}%`);
      } else {
        setGroupPercentage('');
      }
      
      // Si no hay group_min_quota o es 0, usar el estándar del grupo
      if (config.group_min_quota && config.group_min_quota > 0) {
        setGroupMinQuota(config.group_min_quota.toString());
      } else if (groupName) {
        const standardGoal = getStandardGoalByGroup(groupName);
        setGroupMinQuota(standardGoal.toString());
        console.log(`🔍 [EXISTING CONFIG] Usando objetivo estándar para ${groupName}: ${standardGoal} USD`);
      } else {
        setGroupMinQuota('');
      }
    } else {
      // Resetear formulario y cargar porcentaje estándar del grupo
      setEnabledPlatforms([]);
      setPercentageOverride('');
      setMinQuotaOverride('');
      
      // Cargar porcentaje y objetivo estándar del grupo como valores por defecto
      const groupName = model.groups[0]?.name;
      if (groupName) {
        const standardPercentage = getStandardPercentageByGroup(groupName);
        const standardGoal = getStandardGoalByGroup(groupName);
        setGroupPercentage(standardPercentage.toString());
        setGroupMinQuota(standardGoal.toString());
        console.log(`🔍 [DEFAULT VALUES] Cargando valores estándar para ${groupName}: ${standardPercentage}% y ${standardGoal} USD`);
      } else {
        setGroupPercentage('');
        setGroupMinQuota('');
      }
    }
    
    // Cargar datos del Portafolio para este modelo
    try {
      const response = await fetch(`/api/modelo-plataformas?model_id=${model.id}`);
      const portfolioData = await response.json();
      
      // Crear un mapa de platform_id -> datos del portafolio
      const portfolioMap: Record<string, any> = {};
      portfolioData.forEach((item: any) => {
        portfolioMap[item.platform_id] = item;
      });
      
      setPortfolioData(portfolioMap);
    } catch (error) {
      console.error('Error cargando datos del Portafolio:', error);
      setPortfolioData({});
    }
  };

  const handlePlatformToggle = async (platformId: string) => {
    // Si se está desactivando, permitir siempre
    if (enabledPlatforms.includes(platformId)) {
      setEnabledPlatforms(prev => prev.filter(id => id !== platformId));
      return;
    }

    // Si se está activando, validar estado del Portafolio
    if (!selectedModel) {
      console.error('No hay modelo seleccionado');
      return;
    }

    // Verificar si es configuración inicial (modelo sin configuración previa)
    const isInitialConfig = !selectedModel.hasConfig;
    
    if (isInitialConfig) {
      // Para configuración inicial, permitir cualquier plataforma
      console.log('🔍 [INITIAL CONFIG] Permitir plataforma para configuración inicial:', platformId);
      setEnabledPlatforms(prev => [...prev, platformId]);
      return;
    }

    // Para configuraciones posteriores, validar estado del Portafolio
    try {
      // Consultar el estado de la plataforma en el Portafolio
      const response = await fetch(`/api/modelo-plataformas?model_id=${selectedModel.id}&platform_id=${platformId}`);
      const portfolioData = await response.json();
      
      if (portfolioData && portfolioData.length > 0) {
        const platformStatus = portfolioData[0].status;

        // Permitir activar si está en estado 'entregada' o 'confirmada', o es configuración inicial
        if (platformStatus === 'entregada' || platformStatus === 'confirmada' || portfolioData[0].is_initial_config) {
          setEnabledPlatforms(prev => [...prev, platformId]);
        } else {
          // Mostrar mensaje de error
          alert(`No se puede activar esta plataforma. Estado actual en Portafolio: ${platformStatus}. Debe estar en estado "Entregada" o "Confirmada" para poder activarla.`);
        }
      } else {
        // Si no existe en el Portafolio, es una plataforma nueva que no se puede activar
        alert('Esta plataforma no está disponible. Debe ser solicitada a través del Portafolio Modelos primero.');
      }
    } catch (error) {
      console.error('Error validando estado del Portafolio:', error);
      alert('Error al validar el estado de la plataforma. Intenta nuevamente.');
    }
  };

  const handleGroupFilter = (groupId: string) => {
    setSelectedGroup(groupId);
    setSelectedModel(null); // Reset selected model when changing group
    
    if (groupId === 'all') {
      setModels(allModels);
    } else {
      const filteredModels = allModels.filter(model => 
        model.groups.some(group => group.id === groupId)
      );
      setModels(filteredModels);
    }
  };

  const handleSave = async () => {
    if (!selectedModel) return;

    try {
      setSaving(true);
      setError(null);

      // Obtener ID del usuario actual
      const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      const userId = userData ? JSON.parse(userData).id : 'current-user';

      const response = await fetch('/api/calculator/config-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: selectedModel.id,
          adminId: userId,
          groupId: selectedModel.groups[0]?.id || 'default-group',
          enabledPlatforms,
          percentageOverride: percentageOverride ? parseFloat(percentageOverride) : null,
          minQuotaOverride: minQuotaOverride ? parseFloat(minQuotaOverride) : null,
          groupPercentage: groupPercentage ? parseFloat(groupPercentage) : null,
          groupMinQuota: groupMinQuota ? parseFloat(groupMinQuota) : null,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Error al guardar configuración');
      }

      alert('Configuración guardada correctamente');

      // Recargar datos
      await loadData();
      setSelectedModel(null);

    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fuchsia-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16">
        <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 dark:border-gray-600/20 p-8 max-w-md dark:shadow-lg dark:shadow-red-900/15 dark:ring-0.5 dark:ring-red-400/20">
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Error</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{error}</p>
            <button
              onClick={loadData}
              className="px-3 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300 text-sm shadow-md hover:shadow-lg transform hover:scale-105"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-screen-2xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-8 pt-16">
        {/* Header estandarizado */}
        <PageHeader 
          title="Gestión de Calculadora"
          subtitle="Configura las tasas y parámetros de cálculo para cada modelo"
          icon={
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
          glow="admin"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 px-3 sm:px-0">
        {/* Panel izquierdo: Filtros y Selección de modelo */}
        <div className="md:col-span-1">
          {/* Título exterior: Por Grupo */}
          {availableGroups.length > 0 && (
            <div className="flex items-center gap-2 px-1 sm:px-2 mb-2 sm:mb-3">
              <svg className="w-[18px] h-[18px] text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <h2 className="text-[15px] sm:text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">Por Grupo</h2>
            </div>
          )}
          
          <div className="relative bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-2xl md:rounded-3xl shadow-lg border border-white/50 dark:border-white/10 p-2 sm:p-3 space-y-4 sm:space-y-6">
            
            {/* Filtro por Grupo */}
            {availableGroups.length > 0 && (
              <div>
                <AppleDropdown
                  options={availableGroups.map(group => ({
                    value: group.id,
                    label: group.name
                  }))}
                  value={selectedGroup}
                  onChange={handleGroupFilter}
                  placeholder="Selecciona un grupo"
                  className="text-sm"
                />
              </div>
            )}
            
            {/* Buscador y Selección de Modelo Integrados */}
            <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-xl p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <svg className="w-[18px] h-[18px] text-cyan-500 dark:text-cyan-400 drop-shadow-[0_0_4px_rgba(6,182,212,0.5)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h2 className="text-[15px] sm:text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">Buscar o Seleccionar</h2>
                </div>
                {searchQuery.trim() !== '' && (
                  <span className="text-[10px] font-medium bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    {filteredModelsForDropdown.length} resultados
                  </span>
                )}
              </div>
              
              <div className="space-y-2 relative">
                {/* Input de Búsqueda */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-[15px] h-[15px] text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por nombre o correo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="apple-input w-full text-sm h-[38px] pl-9 pr-8 rounded-xl border border-black/[0.06] dark:border-white/[0.08]"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                
                {/* Dropdown vinculado automáticamente */}
                <AppleDropdown
                  options={filteredModelsForDropdown.map(model => ({
                    value: model.id,
                    label: model.email ? model.email.split('@')[0] : model.name,
                    badge: model.hasConfig ? 'Configurado' : undefined,
                    badgeColor: model.hasConfig ? 'green' as const : undefined
                  }))}
                  value={selectedModel?.id || ''}
                  onChange={(value) => value ? handleModelSelect(value) : setSelectedModel(null)}
                  placeholder="Seleccionar modelo..."
                  className="text-sm"
                  autoOpen={searchQuery.trim().length > 0}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Panel derecho: Configuración */}
        {selectedModel && (
          <div className="md:col-span-2">
            
            {/* =========================================
                VISTA MÓVIL: Carrusel Horizontal Estricto (Slide por Slide)
               ========================================= */}
            <div className="relative w-full md:hidden overflow-hidden">
              <div 
                className="flex w-full transition-transform duration-300 ease-out pb-4"
                style={{ transform: `translateX(-${activeSlide * 100}%)` }}
                onTouchStart={(e) => {
                  setTouchEnd(null);
                  setTouchStart(e.targetTouches[0].clientX);
                }}
                onTouchMove={(e) => setTouchEnd(e.targetTouches[0].clientX)}
                onTouchEnd={() => {
                  if (!touchStart || !touchEnd) return;
                  const distance = touchStart - touchEnd;
                  // Si el deslizamiento es mayor a 40px, cambiar de diapositiva
                  if (distance > 40 && activeSlide < 2) setActiveSlide(prev => prev + 1);
                  if (distance < -40 && activeSlide > 0) setActiveSlide(prev => prev - 1);
                }}
              >
                
                {/* Slide 1: Seleccionar Páginas */}
                <div className="w-full flex-shrink-0 px-1">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <svg className="w-[18px] h-[18px] text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                      Páginas <span className="text-black/40 dark:text-white/40 font-medium ml-0.5">({platforms.length})</span>
                    </h3>
                  </div>
                  
                  <div className="relative bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-2xl md:rounded-3xl shadow-lg border border-white/50 dark:border-white/10 p-2 sm:p-3">
                    <div className="border border-black/5 dark:border-white/5 rounded-xl p-2 max-h-[320px] overflow-y-auto apple-scroll bg-white/30 dark:bg-black/20 backdrop-blur-sm">
                      <div className="space-y-2">
                        {platforms.length === 0 ? (
                          <div className="text-center py-6 text-gray-500">Cargando...</div>
                        ) : (
                          platforms.map(platform => (
                            <div key={`mobile-${platform.id}`} className="flex items-center justify-between p-2 bg-white/50 dark:bg-white/5 backdrop-blur-sm rounded-lg border border-black/5 dark:border-white/5">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-0.5">
                                  <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{platform.name}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedPlatformDescriptions(prev => ({ ...prev, [platform.id]: !prev[platform.id] }));
                                  }}
                                  className="text-[10px] text-black/50 dark:text-white/50 text-left w-full mt-0.5"
                                >
                                  <span className={expandedPlatformDescriptions[platform.id] ? '' : 'line-clamp-1'}>
                                    {platform.description}
                                  </span>
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => handlePlatformToggle(platform.id)}
                                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors flex-shrink-0 ml-2 ${
                                  enabledPlatforms.includes(platform.id) ? 'bg-gradient-to-r from-sky-400 to-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.4)]' : 'bg-black/10 dark:bg-white/10'
                                }`}
                              >
                                <span
                                  className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform shadow-sm ${
                                    enabledPlatforms.includes(platform.id) ? 'translate-x-3.5' : 'translate-x-0.5'
                                  }`}
                                />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Slide 2: Configuración Individual */}
              <div className="w-full flex-shrink-0 px-1">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <svg className="w-[18px] h-[18px] text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <h3 className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">Individual</h3>
                  </div>
                  
                  <div className="relative bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-2xl md:rounded-3xl shadow-lg border border-white/50 dark:border-white/10 p-4 sm:p-5 h-[calc(100%-28px)]">
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="percentageOverride-mobile" className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                          Porcentaje Individual
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            id="percentageOverride-mobile"
                            className="apple-input w-full h-10 pr-8"
                            value={percentageOverride}
                            onChange={(e) => { setPercentageOverride(e.target.value); setHasChanges(true); }}
                            placeholder="70"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black/40 dark:text-white/40 font-medium pointer-events-none">%</span>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
                          Dejar vacío para usar el del grupo
                        </p>
                      </div>
                      
                      <div>
                        <label htmlFor="minQuotaOverride-mobile" className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                          Objetivo Individual
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            id="minQuotaOverride-mobile"
                            className="apple-input w-full h-10 pr-10"
                            value={minQuotaOverride}
                            onChange={(e) => { setMinQuotaOverride(e.target.value); setHasChanges(true); }}
                            placeholder="300000"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black/40 dark:text-white/40 font-medium pointer-events-none">USD</span>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
                          Dejar vacío para usar el del grupo
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Botón Guardar Móvil (Adosado a la Caja 2) */}
                  {hasChanges && (
                    <div className="pt-1 animate-fade-in-up">
                      <div className="p-1.5 rounded-2xl md:rounded-3xl bg-white/5 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl border border-white/50 dark:border-white/10 shadow-lg">
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={saving}
                          className="w-full py-3 text-sm font-medium text-white bg-gradient-to-r from-sky-400 to-fuchsia-500 hover:from-sky-300 hover:to-fuchsia-400 rounded-xl transition-all duration-300 shadow-[0_0_15px_rgba(56,189,248,0.4)] hover:shadow-[0_0_25px_rgba(217,70,239,0.6)] active:scale-95 touch-manipulation disabled:opacity-50"
                        >
                          {saving ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Slide 3: Configuración Grupo */}
              <div className="w-full flex-shrink-0 px-1">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <svg className="w-[18px] h-[18px] text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <h3 className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">Grupo</h3>
                  </div>
                  
                  <div className="relative bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-2xl md:rounded-3xl shadow-lg border border-white/50 dark:border-white/10 p-4 sm:p-5 h-[calc(100%-28px)]">
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="groupPercentage-mobile" className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                          Porcentaje Grupo
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            id="groupPercentage-mobile"
                            className="apple-input w-full h-10 pr-8"
                            value={groupPercentage}
                            onChange={(e) => setGroupPercentage(e.target.value)}
                            placeholder={selectedModel?.groups?.[0] ? getStandardPercentageByGroup(selectedModel.groups[0].name).toString() : "60"}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black/40 dark:text-white/40 font-medium pointer-events-none">%</span>
                        </div>
                        <p className="text-[10px] invisible mt-1.5">Espaciador</p>
                      </div>
                      
                      <div>
                        <label htmlFor="groupMinQuota-mobile" className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                          Objetivo Grupo
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            id="groupMinQuota-mobile"
                            className="apple-input w-full h-10 pr-10"
                            value={groupMinQuota}
                            onChange={(e) => setGroupMinQuota(e.target.value)}
                            placeholder={selectedModel?.groups?.[0] ? getStandardGoalByGroup(selectedModel.groups[0].name).toString() : "500"}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black/40 dark:text-white/40 font-medium pointer-events-none">USD</span>
                        </div>
                        <p className="text-[10px] invisible mt-1.5">Espaciador</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Botón Guardar Móvil (Adosado a la Caja 3) */}
                  {(activeSlide === 2 || hasChanges) && (
                    <div className="pt-1 animate-fade-in-up">
                      <div className="p-1.5 rounded-2xl md:rounded-3xl bg-white/5 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl border border-white/50 dark:border-white/10 shadow-lg">
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={saving}
                          className="w-full py-3 text-sm font-medium text-white bg-gradient-to-r from-sky-400 to-fuchsia-500 hover:from-sky-300 hover:to-fuchsia-400 rounded-xl transition-all duration-300 shadow-[0_0_15px_rgba(56,189,248,0.4)] hover:shadow-[0_0_25px_rgba(217,70,239,0.6)] active:scale-95 touch-manipulation disabled:opacity-50"
                        >
                          {saving ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              </div>
              
              {/* Indicadores de Puntos (Dots) */}
              <div className="flex justify-center items-center gap-2 mt-2 mb-4">
                {[0, 1, 2].map((index) => (
                  <button 
                    key={index} 
                    onClick={() => setActiveSlide(index)}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      activeSlide === index 
                        ? 'bg-gray-800 dark:bg-gray-200 scale-125' 
                        : 'bg-black/15 dark:bg-white/15'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* =========================================
                VISTA ESCRITORIO: Estructura Original Intacta
               ========================================= */}
            <div className="hidden md:flex flex-col gap-4 sm:gap-6">
            {/* Sección: Seleccionar Páginas */}
            <div className="space-y-2 sm:space-y-3">
              {/* Header colapsable exterior */}
              <button
                type="button"
                onClick={() => isMobile && setExpandedSections(prev => ({ ...prev, platforms: !prev.platforms }))}
                className={`w-full flex items-center justify-between px-1 sm:px-2 ${isMobile ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-[18px] h-[18px] text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2 className="text-[15px] sm:text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100 truncate">
                    Seleccionar Páginas <span className="text-black/40 dark:text-white/40 font-medium ml-0.5">({platforms.length})</span>
                  </h2>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <h2 className="text-[15px] sm:text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100 truncate max-w-[150px] sm:max-w-[300px] text-right">
                    {selectedModel.name || selectedModel.email}
                  </h2>
                  {isMobile && (
                    <svg 
                      className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${expandedSections.platforms ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </button>

              {/* Primera Caja: Contenedor GlassCard */}
              <div className={`relative bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-2xl md:rounded-3xl shadow-lg border border-white/50 dark:border-white/10 p-2 sm:p-3 ${isMobile && !expandedSections.platforms ? 'hidden' : ''} transition-all duration-200`}>
                <div className="space-y-3 sm:space-y-6">
              {/* Plataformas habilitadas */}
              <div>
                <div className="border border-black/5 dark:border-white/5 rounded-lg p-2 sm:p-4 max-h-[280px] sm:max-h-80 overflow-y-auto apple-scroll bg-white/30 dark:bg-black/20 backdrop-blur-sm">
                  <div className="space-y-2 sm:space-y-3">
                    {platforms.length === 0 ? (
                      <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-gray-400">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                        <p className="text-xs sm:text-sm font-medium">No hay plataformas disponibles</p>
                        <p className="text-[10px] sm:text-xs">Cargando datos...</p>
                      </div>
                    ) : (
                      platforms.map(platform => (
                        <div key={platform.id} className="flex items-center justify-between p-2 sm:p-3 bg-white/50 dark:bg-white/5 backdrop-blur-sm rounded-lg border border-black/5 dark:border-white/5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 sm:space-x-2.5 mb-0.5 sm:mb-1">
                              <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{platform.name}</span>
                              {portfolioData[platform.id] && selectedModel?.hasConfig && (
                                <span className={`flex-shrink-0 ${getPortfolioStatusColor(portfolioData[platform.id].status)}`}>
                                  {renderPortfolioStatus(portfolioData[platform.id].status)}
                                </span>
                              )}
                              {!selectedModel?.hasConfig && (
                                <span className="text-green-500 drop-shadow-[0_0_4px_rgba(34,197,94,0.8)] flex-shrink-0">
                                  {renderPortfolioStatus('disponible')}
                                </span>
                              )}
                            </div>
                            {isMobile ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedPlatformDescriptions(prev => ({ ...prev, [platform.id]: !prev[platform.id] }));
                                }}
                                className="text-[10px] text-black/50 dark:text-white/50 text-left w-full mt-0.5"
                              >
                                <span className={expandedPlatformDescriptions[platform.id] ? '' : 'line-clamp-1'}>
                                  {platform.description}
                                </span>
                              </button>
                            ) : (
                              <p className="text-xs text-black/50 dark:text-white/50">{platform.description}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePlatformToggle(platform.id)}
                            className={`relative inline-flex h-4 w-7 sm:h-5 sm:w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:ring-offset-2 flex-shrink-0 ml-2 ${
                              enabledPlatforms.includes(platform.id) ? 'bg-gradient-to-r from-sky-400 to-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.4)]' : 'bg-black/10 dark:bg-white/10'
                            }`}
                          >
                            <span className="sr-only">Enable platform</span>
                            <span
                              className={`inline-block h-2.5 w-2.5 sm:h-3 sm:w-3 transform rounded-full bg-white transition-transform shadow-sm ${
                                enabledPlatforms.includes(platform.id) ? 'translate-x-3.5 sm:translate-x-5' : 'translate-x-0.5 sm:translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

                </div>
              </div>
            </div>

            {/* Sección: Configuración de reparto */}
            <div className="space-y-2 sm:space-y-3">
              {/* Título exterior */}
              <button
                type="button"
                onClick={() => isMobile && setExpandedSections(prev => ({ ...prev, reparto: !prev.reparto }))}
                className={`w-full flex items-center justify-between px-1 sm:px-2 ${isMobile ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-[18px] h-[18px] text-fuchsia-500 dark:text-fuchsia-400 drop-shadow-[0_0_4px_rgba(217,70,239,0.5)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  <h3 className="text-[15px] sm:text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">Configuración de Reparto</h3>
                </div>
                {isMobile && (
                  <svg 
                    className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${expandedSections.reparto ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
              
              {/* Segunda Caja: Contenedor GlassCard */}
              <div className={`relative bg-white/80 dark:bg-[#1a1a1c]/80 backdrop-blur-3xl rounded-2xl md:rounded-3xl shadow-lg border border-white/50 dark:border-white/10 p-2 sm:p-3 ${isMobile && !expandedSections.reparto ? 'hidden' : ''} transition-all duration-200`}>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                  {/* Columna Grupo */}
                  <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl p-4 sm:p-5 h-full">
                    <div className="flex items-center gap-2 mb-4 sm:mb-6">
                      <svg className="w-[18px] h-[18px] text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <h4 className="text-[15px] sm:text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">Configuración Grupo</h4>
                    </div>
                    
                    <div className="space-y-4 sm:space-y-6">
                      <div>
                        <label htmlFor="groupPercentage" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5 sm:mb-2">
                          Porcentaje Grupo
                        </label>
                        <div className="relative max-w-[180px]">
                          <input
                            type="number"
                            id="groupPercentage"
                            className="apple-input w-full h-10 sm:h-auto pr-8"
                            value={groupPercentage}
                            onChange={(e) => setGroupPercentage(e.target.value)}
                            placeholder={selectedModel?.groups?.[0] ? getStandardPercentageByGroup(selectedModel.groups[0].name).toString() : "60"}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-black/40 dark:text-white/40 font-medium pointer-events-none">%</span>
                        </div>
                        {selectedModel?.groups?.[0] && (
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1.5 sm:mt-2">
                            Valor por defecto: {getStandardPercentageByGroup(selectedModel.groups[0].name)}%
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <label htmlFor="groupMinQuota" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5 sm:mb-2">
                          Objetivo Grupo
                        </label>
                        <div className="relative max-w-[180px]">
                          <input
                            type="number"
                            id="groupMinQuota"
                            className="apple-input w-full h-10 sm:h-auto pr-10"
                            value={groupMinQuota}
                            onChange={(e) => setGroupMinQuota(e.target.value)}
                            placeholder={selectedModel?.groups?.[0] ? getStandardGoalByGroup(selectedModel.groups[0].name).toString() : "500"}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-black/40 dark:text-white/40 font-medium pointer-events-none">USD</span>
                        </div>
                        {selectedModel?.groups?.[0] && (
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1.5 sm:mt-2">
                            Valor sugerido: {getStandardGoalByGroup(selectedModel.groups[0].name)} USD
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Columna Modelo */}
                  <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl p-4 sm:p-5 h-full">
                    <div className="flex items-center gap-2 mb-4 sm:mb-6">
                      <svg className="w-[18px] h-[18px] text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <h4 className="text-[15px] sm:text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">Configuración Individual</h4>
                    </div>
                    
                    <div className="space-y-4 sm:space-y-6">
                      <div>
                        <label htmlFor="percentageOverride" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5 sm:mb-2">
                          Porcentaje Individual
                        </label>
                        <div className="relative max-w-[180px]">
                          <input
                            type="number"
                            id="percentageOverride"
                            className="apple-input w-full h-10 sm:h-auto pr-8"
                            value={percentageOverride}
                            onChange={(e) => { setPercentageOverride(e.target.value); setHasChanges(true); }}
                            placeholder="70"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-black/40 dark:text-white/40 font-medium pointer-events-none">%</span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1.5 sm:mt-2">
                          Dejar vacío para usar el porcentaje del grupo
                        </p>
                      </div>
                      
                      <div>
                        <label htmlFor="minQuotaOverride" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5 sm:mb-2">
                          Objetivo Individual
                        </label>
                        <div className="relative max-w-[180px]">
                          <input
                            type="number"
                            id="minQuotaOverride"
                            className="apple-input w-full h-10 sm:h-auto pr-10"
                            value={minQuotaOverride}
                            onChange={(e) => { setMinQuotaOverride(e.target.value); setHasChanges(true); }}
                            placeholder="300000"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-black/40 dark:text-white/40 font-medium pointer-events-none">USD</span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1.5 sm:mt-2">
                          Dejar vacío para usar el objetivo del grupo
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Botón guardar - Desktop */}
              <div className="hidden sm:flex justify-end mt-8">
                <div className="p-1 rounded-full bg-white/5 dark:bg-gray-800/30 backdrop-blur-xl border border-white/10 dark:border-gray-700/50 shadow-lg">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-sky-400 to-fuchsia-500 hover:from-sky-300 hover:to-fuchsia-400 rounded-full focus:ring-2 focus:ring-fuchsia-500/20 transition-all duration-300 shadow-[0_0_15px_rgba(56,189,248,0.4)] hover:shadow-[0_0_25px_rgba(217,70,239,0.6)] disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
              </div>
            </div>
          </div>
        </div>
        )}

        </div>
      </div>
    </div>
  );
}
