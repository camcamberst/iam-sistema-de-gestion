'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Building2, Grid3X3, Filter, Eye, AlertCircle, CheckCircle, Clock, XCircle, Minus, AlertTriangle, Upload, Lock, Unlock } from 'lucide-react';
import AppleSelect from '@/components/AppleSelect';
import StandardModal from '@/components/ui/StandardModal';
import { getModelDisplayName } from '@/utils/model-display';
import BoostPagesModal from '@/components/BoostPagesModal';

interface ModeloPlatform {
  id: string | null;
  model_id: string;
  model_name: string;
  model_email: string;
  platform_id: string;
  platform_name: string;
  platform_code: string;
  status: 'disponible' | 'solicitada' | 'pendiente' | 'entregada' | 'desactivada' | 'inviable';
  requested_at: string | null;
  delivered_at: string | null;
  confirmed_at: string | null;
  deactivated_at: string | null;
  reverted_at: string | null;
  requested_by_name: string | null;
  delivered_by_name: string | null;
  confirmed_by_name: string | null;
  deactivated_by_name: string | null;
  reverted_by_name: string | null;
  notes: string | null;
  revert_reason: string | null;
  is_initial_config: boolean;
  calculator_sync: boolean;
  calculator_activated_at: string | null;
  group_name: string;
  group_id: string;
  created_at: string | null;
  updated_at: string | null;
}

interface Model {
  id: string;
  name: string;
  email: string;
}

interface Group {
  id: string;
  name: string;
}

interface Room {
  id: string;
  name: string;
  group_id: string;
}

interface Platform {
  id: string;
  name: string;
}

export default function PortafolioModelos() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Función para redirigir a la calculadora de la modelo
  const handleModelNameClick = (modelId: string, modelEmail: string) => {
    // Redirigir a "Ver Calculadora de Modelo" con filtro por modelo
    router.push(`/admin/calculator/view-model?modelId=${modelId}`);
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estados de datos
  const [platforms, setPlatforms] = useState<ModeloPlatform[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allPlatforms, setAllPlatforms] = useState<Platform[]>([]);
  const [allowedModelIds, setAllowedModelIds] = useState<string[]>([]);
  
  // Estados de filtros
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedJornada, setSelectedJornada] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  
  // Estados de UI
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(true);
  const [selectedPlatformForAction, setSelectedPlatformForAction] = useState<ModeloPlatform | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'request' | 'deliver' | 'deactivate' | 'revert'>('request');
  const [actionNotes, setActionNotes] = useState('');
  const [processingAction, setProcessingAction] = useState(false);
  const [modalStatus, setModalStatus] = useState<'disponible' | 'solicitada' | 'pendiente' | 'entregada' | 'desactivada' | 'inviable'>('disponible');
  const [openFiltersCount, setOpenFiltersCount] = useState(0);
  
  // Estados para credenciales de plataforma
  const [loginUrl, setLoginUrl] = useState(''); // URL de la plataforma (obtenido desde calculator_platforms)
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [platformsWithCredentials, setPlatformsWithCredentials] = useState<Set<string>>(new Set());
  
  // Estados para Boost Pages Modal
  const [showBoostPagesModal, setShowBoostPagesModal] = useState(false);
  const [selectedModelForBoost, setSelectedModelForBoost] = useState<{ id: string; name: string; email: string } | null>(null);

  // Información del usuario
  const [userRole, setUserRole] = useState('');
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [userId, setUserId] = useState('');

  const jornadas = ['MAÑANA', 'TARDE', 'NOCHE'];

  // Cargar información del usuario
  useEffect(() => {
    const loadUserInfo = () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setUserRole(user.role || '');
        setUserGroups(user.groups?.map((g: any) => g.id) || []);
        setUserId(user.id || '');
      }
    };

    loadUserInfo();
  }, []);

  // Cargar datos iniciales después de cargar la información del usuario
  useEffect(() => {
    if (userRole && userGroups.length >= 0) {
      loadInitialData();
    }
  }, [userRole, userGroups]);

  // Procesar parámetros de URL para filtro automático
  useEffect(() => {
    const modelId = searchParams.get('model');
    const modelEmail = searchParams.get('email');
    
    if (modelId && modelEmail && !loading) {
      console.log('🔍 Aplicando filtro automático por modelo:', { modelId, modelEmail });
      
      // Aplicar filtro automático por modelo
      applyModelFilter(modelId);
      
      // Limpiar parámetros de URL después de aplicarlos
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('model');
      newUrl.searchParams.delete('email');
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  }, [searchParams, router, loading]);

  // Cargar plataformas cuando cambien los filtros
  useEffect(() => {
    if (!loading) {
      const hasAnyFilter = !!(selectedGroup || selectedModel || selectedJornada || selectedPlatform);
      if (hasAnyFilter) {
        loadPlatforms();
      } else {
        setPlatforms([]);
      }
    }
  }, [selectedModel, selectedGroup, selectedJornada, selectedPlatform]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Cargar grupos según jerarquía del usuario
      const groupsResponse = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userRole: userRole,
          userGroups: userGroups
        })
      });
      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json();
        if (groupsData.success) {
          const clean = groupsData.groups.filter((g: any) => g.name !== 'Otros' && g.name !== 'Satélites');
          setGroups(clean);
        }
      }

      // Cargar catálogo de plataformas
      const platformsResponse = await fetch('/api/plataformas-catalogo');
      if (platformsResponse.ok) {
        const platformsData = await platformsResponse.json();
        setAllPlatforms(Array.isArray(platformsData) ? platformsData : []);
      }

      // Cargar IDs de usuarios con rol 'modelo' para filtrar panel
      const usersRes = await fetch('/api/users?role=modelo');
      if (usersRes.ok) {
        const raw = await usersRes.json();
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.users) ? raw.users : []);
        const onlyModels = list.filter((u: any) => (u.role === 'modelo'));
        setAllowedModelIds(onlyModels.map((u: any) => u.id));
      }

      // No cargar plataformas inicialmente; esperar a que se apliquen filtros
      
    } catch (error) {
      console.error('Error loading initial data:', error);
      setError('Error al cargar los datos iniciales');
    } finally {
      setLoading(false);
    }
  };

  const loadPlatforms = async () => {
    try {
      // Si hay un grupo seleccionado, cargar modelos de ese grupo
      if (selectedGroup) {
        await loadModelsForGroup(selectedGroup);
      }

      const params = new URLSearchParams();
      if (selectedModel) params.append('model_id', selectedModel);
      if (selectedGroup) params.append('group_id', selectedGroup);
      if (selectedJornada) params.append('jornada', selectedJornada);
      if (selectedPlatform) params.append('platform_id', selectedPlatform);

      const response = await fetch(`/api/modelo-plataformas?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        // Filtrar solo modelos reales (role = 'modelo'), no admin ni super_admin
        const filteredData = Array.isArray(data) ? data.filter(platform => {
          // Filtrar por nombres que no sean administradores
          return platform.model_name && 
                 !platform.model_name.includes('Administrator') &&
                 !platform.model_name.includes('Super Administrator');
        }) : [];
        setPlatforms(filteredData);
        
        // Cargar información de credenciales para plataformas entregadas (solo admin/super_admin)
        if ((userRole === 'admin' || userRole === 'super_admin') && filteredData.length > 0) {
          await loadCredentialsInfo(filteredData);
        }
      } else {
        setError('Error al cargar las plataformas');
      }
    } catch (error) {
      console.error('Error loading platforms:', error);
      setError('Error al cargar las plataformas');
    }
  };

  const loadModelsForGroup = async (groupId: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/models`);
      if (response.ok) {
        const raw = await response.json();
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.models) ? raw.models : []);
        setModels(list);
      }
    } catch (error) {
      console.error('Error loading models:', error);
    }
  };

  const loadRoomsForGroup = async (groupId: string) => {
    try {
      const response = await fetch(`/api/groups/rooms?group_id=${groupId}`);
      if (response.ok) {
        const raw = await response.json();
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.rooms) ? raw.rooms : []);
        setRooms(list);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
    }
  };

  const handleGroupChange = (groupId: string) => {
    setSelectedGroup(groupId);
    setSelectedModel('');
    setModels([]);
    
    if (groupId) {
      loadModelsForGroup(groupId);
    }
  };

  // Función para aplicar filtro automático por modelo
  const applyModelFilter = async (modelId: string) => {
    console.log('🔍 Aplicando filtro por modelo:', modelId);
    
    // Buscar el grupo de la modelo
    const response = await fetch(`/api/modelo-plataformas?model_id=${modelId}`);
    if (response.ok) {
      const data = await response.json();
      const platforms = Array.isArray(data) ? data : (Array.isArray(data?.platforms) ? data.platforms : []);
      
      if (platforms.length > 0) {
        const firstPlatform = platforms[0];
        const groupId = firstPlatform.group_id;
        
        if (groupId) {
          console.log('🔍 Encontrado grupo para modelo:', groupId);
          setSelectedGroup(groupId);
          await loadModelsForGroup(groupId);
        }
      }
    }
    
    setSelectedModel(modelId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'disponible': return 'bg-white border-gray-200 text-gray-700';
      case 'solicitada': return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'pendiente': return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'entregada': return 'bg-green-50 border-green-200 text-green-700';
      case 'desactivada': return 'bg-gray-900 border-gray-900 text-white';
      case 'inviable': return 'bg-red-50 border-red-200 text-red-700';
      default: return 'bg-gray-50 border-gray-200 text-gray-500';
    }
  };

  // Estilo tipo etiqueta (pill) como los ROOMs de Gestionar Sedes
  const getTagClasses = (status: string) => {
    switch (status) {
      case 'disponible':
        return 'bg-slate-200 text-slate-700 border border-slate-300 hover:bg-slate-300';
      case 'solicitada':
        return 'bg-blue-300 text-blue-800 border border-blue-400 hover:bg-blue-400';
      case 'pendiente':
        return 'bg-yellow-300 text-yellow-800 border border-yellow-400 hover:bg-yellow-400';
      case 'entregada':
        return 'bg-green-300 text-green-800 border border-green-400 hover:bg-green-400';
      case 'desactivada':
        return 'bg-gray-800 text-white border border-gray-800 hover:opacity-90';
      case 'inviable':
        return 'bg-red-300 text-red-800 border border-red-400 hover:bg-red-400';
      default:
        return 'bg-gray-50 text-gray-600 border border-gray-200';
    }
  };

  const getStatusIcon = (status: string, isInitial?: boolean) => {
    const s = (isInitial && status !== 'desactivada') ? 'confirmada' : status;
    switch (s) {
      case 'disponible': return <Eye className="w-4 h-4" />;
      case 'solicitada': return <Clock className="w-4 h-4" />;
      case 'pendiente': return <AlertCircle className="w-4 h-4" />;
      case 'entregada': return <CheckCircle className="w-4 h-4" />;
      case 'desactivada': return <Minus className="w-4 h-4" />;
      case 'inviable': return <XCircle className="w-4 h-4" />;
      case 'confirmada': return <CheckCircle className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string, isInitial?: boolean) => {
    const s = (isInitial && status !== 'desactivada') ? 'confirmada' : status;
    switch (s) {
      case 'disponible': return 'Disponible';
      case 'solicitada': return 'Solicitada';
      case 'pendiente': return 'Pendiente';
      case 'entregada': return 'Entregada';
      case 'desactivada': return 'Desactivada';
      case 'inviable': return 'Inviable';
      case 'confirmada': return 'Confirmada';
      default: return 'Confirmada';
    }
  };

  const handlePlatformAction = async (platform: ModeloPlatform, action: string) => {
    console.log('🟢 handlePlatformAction llamado', { platform: platform.platform_name, action });
    setSelectedPlatformForAction(platform);
    setActionType(action as any);
    setActionNotes('');
    // Usar el mismo criterio visual que en las etiquetas:
    // si es configuración inicial activa, tratarla como "entregada"
    const visualStatus = (platform.is_initial_config && platform.status !== 'desactivada')
      ? 'entregada'
      : platform.status;
    setModalStatus((visualStatus as any) || 'disponible');
    setShowActionModal(true);
    console.log('🟢 showActionModal establecido a true');
    
    // Si el estado visual es "entregada", cargar credenciales existentes
    if (visualStatus === 'entregada' && (userRole === 'admin' || userRole === 'super_admin')) {
      await loadPlatformCredentials(platform.model_id, platform.platform_id);
    } else {
      // Limpiar campos de credenciales
      setLoginUrl('');
      setLoginUsername('');
      setLoginPassword('');
      setHasCredentials(false);
    }
  };

  // Helper para obtener token válido
  const getValidToken = async (): Promise<string | null> => {
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        return null;
      }

      const expiresAt = session.expires_at;
      if (expiresAt) {
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = expiresAt - now;
        
        if (expiresIn < 60) {
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError || !refreshedSession) {
            return null;
          }
          
          return refreshedSession.access_token;
        }
      }
      
      return session.access_token;
    } catch (error) {
      console.error('Error obteniendo token:', error);
      return null;
    }
  };

  // Cargar credenciales de plataforma
  const loadPlatformCredentials = async (modelId: string, platformId: string) => {
    if (!userId) return;
    
    try {
      setLoadingCredentials(true);
      const token = await getValidToken();
      if (!token) {
        setLoginUrl('');
        setLoginUsername('');
        setLoginPassword('');
        setHasCredentials(false);
        return;
      }

      // Obtener URL de la plataforma desde calculator_platforms
      const platformResponse = await fetch('/api/calculator/platforms');
      if (platformResponse.ok) {
        const platformData = await platformResponse.json();
        if (platformData.success && platformData.config?.platforms) {
          const platform = platformData.config.platforms.find((p: any) => p.id === platformId);
          if (platform?.login_url) {
            setLoginUrl(platform.login_url);
          } else {
            setLoginUrl('');
          }
        }
      }

      // Obtener credenciales guardadas
      const response = await fetch(`/api/modelo-plataformas/credentials?model_id=${modelId}&platform_id=${platformId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.hasCredentials && data.data) {
          setLoginUsername(data.data.login_username || '');
          setLoginPassword(data.data.login_password || '');
          setHasCredentials(true);
        } else {
          setLoginUsername('');
          setLoginPassword('');
          setHasCredentials(false);
        }
      } else {
        setLoginUsername('');
        setLoginPassword('');
        setHasCredentials(false);
      }
    } catch (error) {
      console.error('Error cargando credenciales:', error);
      setLoginUrl('');
      setLoginUsername('');
      setLoginPassword('');
      setHasCredentials(false);
    } finally {
      setLoadingCredentials(false);
    }
  };

  // Cargar información de credenciales para múltiples plataformas (para indicadores visuales)
  const loadCredentialsInfo = async (platformsData: ModeloPlatform[]) => {
    if (!userId || (userRole !== 'admin' && userRole !== 'super_admin')) return;
    
    try {
      const token = await getValidToken();
      if (!token) return;

      const credentialsSet = new Set<string>();
      const entregadas = platformsData.filter(p => p.status === 'entregada');
      
      // Verificar credenciales en paralelo (limitado a 10 a la vez para no sobrecargar)
      const batchSize = 10;
      for (let i = 0; i < entregadas.length; i += batchSize) {
        const batch = entregadas.slice(i, i + batchSize);
        const promises = batch.map(async (platform) => {
          try {
            const response = await fetch(
              `/api/modelo-plataformas/credentials?model_id=${platform.model_id}&platform_id=${platform.platform_id}`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.hasCredentials) {
                return `${platform.model_id}-${platform.platform_id}`;
              }
            }
          } catch (error) {
            console.error(`Error verificando credenciales para ${platform.platform_id}:`, error);
          }
          return null;
        });
        
        const results = await Promise.all(promises);
        results.forEach(key => {
          if (key) credentialsSet.add(key);
        });
      }
      
      setPlatformsWithCredentials(credentialsSet);
    } catch (error) {
      console.error('Error cargando información de credenciales:', error);
    }
  };

  // Guardar credenciales de plataforma
  const savePlatformCredentials = async () => {
    if (!selectedPlatformForAction || !userId) return;

    // Validaciones (ya no validamos loginUrl porque viene de la plataforma)
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setError('Usuario y contraseña son requeridos');
      return;
    }

    // Verificar que el URL de la plataforma esté configurado
    if (!loginUrl.trim()) {
      setError('La plataforma no tiene URL de login configurado. Configúralo en "Gestión de Plataformas"');
      return;
    }

    try {
      setProcessingAction(true);
      setError('');

      const token = await getValidToken();
      if (!token) {
        setError('Error de autenticación');
        return;
      }

      const response = await fetch('/api/modelo-plataformas/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          platform_id: selectedPlatformForAction.platform_id,
          model_id: selectedPlatformForAction.model_id,
          login_username: loginUsername.trim(),
          login_password: loginPassword
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSuccess('Credenciales guardadas correctamente');
          setHasCredentials(true);
          // Actualizar el set de plataformas con credenciales
          setPlatformsWithCredentials(prev => {
            const newSet = new Set(prev);
            newSet.add(`${selectedPlatformForAction.model_id}-${selectedPlatformForAction.platform_id}`);
            return newSet;
          });
        } else {
          setError(data.error || 'Error al guardar credenciales');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Error al guardar credenciales');
      }
    } catch (error) {
      console.error('Error guardando credenciales:', error);
      setError('Error al guardar credenciales');
    } finally {
      setProcessingAction(false);
    }
  };

  const executeAction = async () => {
    if (!selectedPlatformForAction || !userId) return;

    try {
      setProcessingAction(true);
      setError('');

      const newStatus = modalStatus;

      const response = await fetch('/api/modelo-plataformas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: selectedPlatformForAction.model_id,
          platform_id: selectedPlatformForAction.platform_id,
          new_status: newStatus,
          changed_by: userId,
          reason: actionNotes || null
        })
      });

      if (response.ok) {
        setSuccess(`Plataforma ${getStatusText(newStatus).toLowerCase()} correctamente`);
        setShowActionModal(false);
        await loadPlatforms();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Error al procesar la acción');
      }
    } catch (error) {
      console.error('Error executing action:', error);
      setError('Error al procesar la acción');
    } finally {
      setProcessingAction(false);
    }
  };

  // Filtrar para mostrar únicamente usuarios con rol 'modelo'
  const filteredPlatforms = platforms.filter(p =>
    allowedModelIds.length === 0 ? true : allowedModelIds.includes(p.model_id)
  );

  // Agrupar plataformas por modelo
  const modelGroups = filteredPlatforms.reduce((acc, platform) => {
    const modelKey = platform.model_id;
    if (!acc[modelKey]) {
      acc[modelKey] = {
        model_id: platform.model_id,
        model_name: platform.model_name,
        model_email: platform.model_email,
        group_name: platform.group_name,
        group_id: platform.group_id,
        platforms: []
      };
    }
    acc[modelKey].platforms.push(platform);
    return acc;
  }, {} as Record<string, {
    model_id: string;
    model_name: string;
    model_email: string;
    group_name: string;
    group_id: string;
    platforms: ModeloPlatform[];
  }>);

  const modelsList = Object.values(modelGroups);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-300">Cargando portafolio...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        
        {/* Mensaje de alerta para admins sin sedes asignadas */}
        {userRole === 'admin' && groups.length === 0 && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-yellow-50/80 to-orange-50/80 dark:bg-yellow-900/20 dark:border-yellow-700/50 backdrop-blur-sm rounded-xl p-6 border border-yellow-200/30 dark:border-yellow-700/50">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300">Sin Sedes Asignadas</h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                    No tienes sedes asignadas para ver portafolios. Contacta al Super Admin para que te asigne sedes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="mb-12">
          <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                <Grid3X3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Portafolio Modelos</h1>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Gestión de plataformas por modelo y sede
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-50/80 dark:bg-red-900/20 dark:border-red-700/50 backdrop-blur-sm border border-red-200/50 dark:border-red-700/50 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg shadow-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50/80 dark:bg-green-900/20 dark:border-green-700/50 backdrop-blur-sm border border-green-200/50 dark:border-green-700/50 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg shadow-sm">
            {success}
          </div>
        )}

        {/* Filters */}
        <div className="mb-8 z-50 relative">
          <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                <Filter className="w-5 h-5 mr-2" />
                Filtros
              </h3>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              >
                {showFilters ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <AppleSelect
                  label="Grupo"
                  value={selectedGroup}
                  options={[{ label: 'Todos los grupos', value: '' }, ...groups.map(g => ({ label: g.name, value: g.id }))]}
                  onChange={(val) => handleGroupChange(val)}
                  onFocus={() => setOpenFiltersCount(c => c + 1)}
                  onBlur={() => setOpenFiltersCount(c => Math.max(0, c - 1))}
                  className="text-sm"
                />
                <AppleSelect
                  label="Modelo"
                  value={selectedModel}
                  options={[{ label: 'Todas las modelos', value: '' }, ...models.map(m => ({ label: getModelDisplayName(m.email), value: m.id }))]}
                  onChange={(val) => setSelectedModel(val)}
                  onFocus={() => setOpenFiltersCount(c => c + 1)}
                  onBlur={() => setOpenFiltersCount(c => Math.max(0, c - 1))}
                  className="text-sm"
                />
                <AppleSelect
                  label="Jornada"
                  value={selectedJornada}
                  options={[{ label: 'Todas las jornadas', value: '' }, ...jornadas.map(j => ({ label: j, value: j }))]}
                  onChange={(val) => setSelectedJornada(val)}
                  onFocus={() => setOpenFiltersCount(c => c + 1)}
                  onBlur={() => setOpenFiltersCount(c => Math.max(0, c - 1))}
                  className="text-sm"
                />
                <AppleSelect
                  label="Plataforma"
                  value={selectedPlatform}
                  options={[{ label: 'Todas las plataformas', value: '' }, ...allPlatforms.map(p => ({ label: p.name, value: p.id }))]}
                  onChange={(val) => setSelectedPlatform(val)}
                  onFocus={() => setOpenFiltersCount(c => c + 1)}
                  onBlur={() => setOpenFiltersCount(c => Math.max(0, c - 1))}
                  className="text-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className={`bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-6 transition-all dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15 ${openFiltersCount > 0 ? 'opacity-30 blur-sm pointer-events-none' : 'opacity-100'}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Modelos ({modelsList.length})
            </h3>
          </div>

          {modelsList.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Aplica un filtro de Grupo, Modelo, Room, Jornada o Plataforma para ver resultados.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {modelsList.map((model) => (
                <div
                  key={model.model_id}
                  className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl border border-white/30 dark:border-gray-600/30 shadow-lg p-6 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15"
                >
                  {/* Header del Modelo */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h4 
                          className="text-lg font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
                          onClick={() => handleModelNameClick(model.model_id, model.model_email)}
                          title="Ver calculadora de la modelo"
                        >
                          {getModelDisplayName(model.model_email)}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                          <Building2 className="w-4 h-4 mr-1" />
                          {model.group_name}
                        </p>
                      </div>
                    </div>
                    
                    {/* Botón Boost Pages */}
                    <button
                      onClick={() => {
                        setSelectedModelForBoost({
                          id: model.model_id,
                          name: getModelDisplayName(model.model_email),
                          email: model.model_email
                        });
                        setShowBoostPagesModal(true);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2 text-sm font-medium"
                      title="Abrir Boost Pages para subir fotos a las plataformas"
                    >
                      <Upload className="w-4 h-4" />
                      Boost Pages
                    </button>
                  </div>

                  {/* Grid de Plataformas como etiquetas (todas las plataformas del catálogo) */}
                  <div className="flex flex-wrap gap-2">
                    {(allPlatforms || []).map((p) => {
                      const found = model.platforms.find(mp => mp.platform_id === p.id);
                      const tag = found || {
                        id: null,
                        model_id: model.model_id,
                        model_name: model.model_name,
                        model_email: model.model_email,
                        platform_id: p.id,
                        platform_name: p.name,
                        platform_code: p.id,
                        status: 'disponible',
                        requested_at: null,
                        delivered_at: null,
                        confirmed_at: null,
                        deactivated_at: null,
                        reverted_at: null,
                        requested_by_name: null,
                        delivered_by_name: null,
                        confirmed_by_name: null,
                        deactivated_by_name: null,
                        reverted_by_name: null,
                        notes: null,
                        revert_reason: null,
                        is_initial_config: false,
                        calculator_sync: false,
                        calculator_activated_at: null,
                        group_name: model.group_name,
                        group_id: model.group_id,
                        created_at: null,
                        updated_at: null
                      } as ModeloPlatform;

                      const hasCreds = platformsWithCredentials.has(`${tag.model_id}-${tag.platform_id}`);
                      const finalStatus = (tag.is_initial_config && tag.status !== 'desactivada') ? 'entregada' : tag.status;
                      
                      return (
                        <button
                          key={`${model.model_id}-${p.id}`}
                          type="button"
                          className={`px-2.5 py-1 rounded-full text-[11px] leading-5 font-medium transition-colors inline-flex items-center relative ${getTagClasses(finalStatus)}`}
                          onClick={() => handlePlatformAction(tag, 'request')}
                        >
                          <span className="inline-flex items-center gap-1 align-middle">
                            {getStatusIcon(tag.status, tag.is_initial_config)}
                            {tag.platform_name}
                            {/* Indicador sutil de credenciales guardadas */}
                            {hasCreds && finalStatus === 'entregada' && (userRole === 'admin' || userRole === 'super_admin') && (
                              <span 
                                className="ml-1 w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400" 
                                title="Credenciales guardadas"
                                aria-label="Credenciales guardadas"
                              />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Estadísticas del Modelo */}
                  <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-600/50">
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span>Total: {allPlatforms.length} plataformas</span>
                      <div className="flex space-x-4">
                        <span className="text-green-600 dark:text-green-400">
                          {(() => {
                            // Contar como entregadas: 'entregada' o 'confirmada' o inicial activa
                            const deliveredCount = model.platforms.filter(p => {
                              const activeInitial = p.is_initial_config && p.status !== 'desactivada';
                              // Contar 'entregada' o inicial activa (confirmada visualmente)
                              return p.status === 'entregada' || activeInitial;
                            }).length;
                            return <>Entregadas: {deliveredCount}</>;
                          })()}
                        </span>
                        <span className="text-blue-600 dark:text-blue-400">
                          Solicitadas: {model.platforms.filter(p => p.status === 'solicitada').length}
                        </span>
                        <span className="text-gray-500 dark:text-gray-500">
                          Disponibles: {allPlatforms.length - model.platforms.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Modal */}
        {showActionModal && selectedPlatformForAction && (
          <>
            {console.log('🟡 Renderizando StandardModal', { showActionModal, hasPlatform: !!selectedPlatformForAction })}
            <StandardModal 
              isOpen={showActionModal} 
              onClose={() => {
                console.log('🔴 Cerrando modal');
                setShowActionModal(false);
              }} 
            title={
              actionType === 'request' && 'Estado de Plataforma' ||
              actionType === 'deliver' && 'Entregar Plataforma' ||
              actionType === 'deactivate' && 'Desactivar Plataforma' ||
              actionType === 'revert' && 'Revertir Plataforma' ||
              'Acción'
            }
            maxWidthClass={actionType === 'request' ? 'max-w-4xl' : 'max-w-md'}
          >
              {actionType === 'request' ? (
                // Diseño horizontal para "Solicitar Plataforma"
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Columna izquierda: Información */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Información</h3>
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <strong>Plataforma:</strong> {selectedPlatformForAction.platform_name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <strong>Modelo:</strong> {getModelDisplayName(selectedPlatformForAction.model_email)}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <strong>Estado actual:</strong> {getStatusText(selectedPlatformForAction.status)}
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Estado</label>
                      <AppleSelect
                        value={modalStatus}
                        onChange={(v) => setModalStatus(v as any)}
                        options={[
                          { label: 'Disponible', value: 'disponible', color: '#e2e8f0' },
                          { label: 'Solicitada', value: 'solicitada', color: '#93c5fd' },
                          { label: 'Pendiente', value: 'pendiente', color: '#fde047' },
                          { label: 'Entregada', value: 'entregada', color: '#86efac' },
                          { label: 'Desactivada', value: 'desactivada', color: '#1f2937' },
                          { label: 'Inviable', value: 'inviable', color: '#fca5a5' }
                        ]}
                        className="text-sm"
                      />
                    </div>
                  </div>

                  {/* Columna derecha: Notas */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Detalles</h3>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                          Notas (opcional)
                        </label>
                        <textarea
                          value={actionNotes}
                          onChange={(e) => setActionNotes(e.target.value)}
                          rows={8}
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="Agregar notas sobre esta acción..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Diseño vertical para otros modales
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <strong>Plataforma:</strong> {selectedPlatformForAction.platform_name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <strong>Modelo:</strong> {getModelDisplayName(selectedPlatformForAction.model_email)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <strong>Estado actual:</strong> {getStatusText(selectedPlatformForAction.status)}
                    </p>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Estado</label>
                    <AppleSelect
                      value={modalStatus}
                      onChange={(v) => setModalStatus(v as any)}
                      options={[
                        { label: 'Disponible', value: 'disponible', color: '#e2e8f0' },
                        { label: 'Solicitada', value: 'solicitada', color: '#93c5fd' },
                        { label: 'Pendiente', value: 'pendiente', color: '#fde047' },
                        { label: 'Entregada', value: 'entregada', color: '#86efac' },
                        { label: 'Desactivada', value: 'desactivada', color: '#1f2937' },
                        { label: 'Inviable', value: 'inviable', color: '#fca5a5' }
                      ]}
                      className="text-sm"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                      Notas (opcional)
                    </label>
                    <textarea
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      placeholder="Agregar notas sobre esta acción..."
                    />
                  </div>
                </>
              )}

              {/* Sección de Credenciales (solo para plataformas que se ven como entregadas y admin/super_admin) */}
              {(() => {
                // Considerar como "entregada" también las configuraciones iniciales activas,
                // igual que en las etiquetas verdes del portafolio
                const visualStatus =
                  (selectedPlatformForAction.is_initial_config && selectedPlatformForAction.status !== 'desactivada')
                    ? 'entregada'
                    : selectedPlatformForAction.status;
                const isDeliveredVisual =
                  modalStatus === 'entregada' ||
                  visualStatus === 'entregada';

                return isDeliveredVisual && (userRole === 'admin' || userRole === 'super_admin');
              })() && (
                <div className="mb-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Credenciales de Login
                    </label>
                    {hasCredentials && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        Guardadas
                      </span>
                    )}
                  </div>
                  
                  {loadingCredentials ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                      Cargando credenciales...
                    </div>
                  ) : (
                    <>
                      {/* Mostrar URL de la plataforma (solo lectura) */}
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                          URL de Login de la Plataforma
                        </label>
                        {loginUrl ? (
                          <div className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                            {loginUrl}
                          </div>
                        ) : (
                          <div className="w-full px-3 py-2 text-sm border border-yellow-300 dark:border-yellow-600 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400">
                            ⚠️ URL no configurado. Configúralo en &quot;Gestión de Plataformas&quot;
                          </div>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Este URL es común para todas las modelos de esta plataforma
                        </p>
                      </div>

                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                          Usuario/Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={loginUsername}
                          onChange={(e) => setLoginUsername(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                          placeholder="usuario@ejemplo.com"
                        />
                      </div>

                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                          Contraseña <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          >
                            {showPassword ? <Eye className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={savePlatformCredentials}
                        disabled={processingAction || !loginUsername.trim() || !loginPassword.trim()}
                        className="w-full px-3 py-2 text-xs font-medium bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {hasCredentials ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            {processingAction ? 'Guardando...' : 'Actualizar Credenciales'}
                          </>
                        ) : (
                          <>
                            <Lock className="w-4 h-4" />
                            {processingAction ? 'Guardando...' : 'Guardar Credenciales'}
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowActionModal(false)}
                  className="flex-1 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  disabled={processingAction}
                >
                  Cancelar
                </button>
                <button
                  onClick={executeAction}
                  disabled={processingAction}
                  className="flex-1 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md disabled:opacity-50"
                >
                  {processingAction ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
          </StandardModal>
          </>
        )}

        {/* Modal Boost Pages */}
        {showBoostPagesModal && selectedModelForBoost && userId && (
          <BoostPagesModal
            isOpen={showBoostPagesModal}
            onClose={() => {
              setShowBoostPagesModal(false);
              setSelectedModelForBoost(null);
            }}
            modelId={selectedModelForBoost.id}
            modelName={selectedModelForBoost.name}
            modelEmail={selectedModelForBoost.email}
            userId={userId}
          />
        )}
      </div>
    </div>
  );
}