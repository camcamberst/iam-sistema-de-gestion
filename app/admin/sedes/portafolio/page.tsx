'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Building2, Grid3X3, Filter, Eye, AlertCircle, CheckCircle, Clock, XCircle, Minus, AlertTriangle, Upload, Lock, Unlock, ExternalLink } from 'lucide-react';
import AppleSelect from '@/components/AppleSelect';
import AppleSearchBar from '@/components/AppleSearchBar';
import StandardModal from '@/components/ui/StandardModal';
import { getModelDisplayName } from '@/utils/model-display';
import BoostPagesModal from '@/components/BoostPagesModal';
import PageHeader from '@/components/ui/PageHeader';
import GlassCard from '@/components/ui/GlassCard';
import ModelAuroraBackground from '@/components/ui/ModelAuroraBackground';

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
  const [allModelsInfo, setAllModelsInfo] = useState<Record<string, { name: string; email: string; avatar_url: string | null }>>({});
  
  // Estados de filtros
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedJornada, setSelectedJornada] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Estados de UI
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(true);
  const [selectedPlatformForAction, setSelectedPlatformForAction] = useState<ModeloPlatform | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'request' | 'deliver' | 'deactivate' | 'revert'>('request');
  const [actionNotes, setActionNotes] = useState('');
  const [processingAction, setProcessingAction] = useState(false);
  const [modalStatus, setModalStatus] = useState<'disponible' | 'solicitada' | 'pendiente' | 'entregada' | 'desactivada' | 'inviable'>('disponible');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'estado' | 'credenciales'>('estado');
  const [isMounted, setIsMounted] = useState(false);
  
  // Estados para credenciales de plataforma
  const [loginUrl, setLoginUrl] = useState(''); // URL de la plataforma (obtenido desde calculator_platforms)
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [platformsWithCredentials, setPlatformsWithCredentials] = useState<Set<string>>(new Set());
  
  // Estados para credenciales de 3CX
  const [app3CXUsername, setApp3CXUsername] = useState('');
  const [app3CXPassword, setApp3CXPassword] = useState('');
  const [showPassword3CX, setShowPassword3CX] = useState(false);
  const [loading3CX, setLoading3CX] = useState(false);
  const [hasCredentials3CX, setHasCredentials3CX] = useState(false);
  
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
    setIsMounted(true);
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

  // Recargar plataformas cuando la ventana vuelve a tener foco o cuando se detecta cambio
  useEffect(() => {
    const handleFocus = () => {
      // Recargar catálogo de plataformas cuando la ventana vuelve a tener foco
      // Esto asegura que los cambios en "Gestión de Plataformas" se reflejen
      const reloadPlatforms = async () => {
        try {
          const platformsResponse = await fetch('/api/plataformas-catalogo');
          if (platformsResponse.ok) {
            const platformsData = await platformsResponse.json();
            setAllPlatforms(Array.isArray(platformsData) ? platformsData : []);
          }
        } catch (error) {
          console.error('Error recargando plataformas:', error);
        }
      };
      reloadPlatforms();
    };

    // Recargar cuando la ventana vuelve a tener foco
    window.addEventListener('focus', handleFocus);

    // También recargar si se detecta que se viene de "Gestión de Plataformas"
    const checkPlatformsUpdate = () => {
      const lastPlatformsUpdate = sessionStorage.getItem('platforms_updated');
      if (lastPlatformsUpdate) {
        const updateTime = parseInt(lastPlatformsUpdate, 10);
        const now = Date.now();
        // Si la actualización fue hace menos de 5 minutos, recargar
        if (now - updateTime < 5 * 60 * 1000) {
          handleFocus();
          sessionStorage.removeItem('platforms_updated');
        }
      }
    };

    // Verificar al montar el componente
    checkPlatformsUpdate();

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

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

  // Cerrar zoom de foto con la tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomedImage(null);
      }
    };

    if (zoomedImage) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [zoomedImage]);

  // Configuración de filtros para AppleSearchBar
  const searchFiltersConfig = [
    {
      id: 'group',
      label: 'Grupo',
      value: selectedGroup,
      options: groups.map(g => ({ label: g.name, value: g.id }))
    },
    {
      id: 'model',
      label: 'Modelo',
      value: selectedModel,
      options: (selectedGroup 
        ? models.filter(m => allowedModelIds.includes(m.id))
        : Object.entries(allModelsInfo).map(([id, info]) => ({ id, name: info.name, email: info.email }))
      )
      .map(m => ({ label: getModelDisplayName(m.email), value: m.id }))
      .sort((a, b) => a.label.localeCompare(b.label))
    },
    {
      id: 'jornada',
      label: 'Jornada',
      value: selectedJornada,
      options: jornadas.map(j => ({ label: j, value: j }))
    },
    {
      id: 'platform',
      label: 'Plataforma',
      value: selectedPlatform,
      options: allPlatforms.map(p => ({ label: p.name, value: p.id }))
    }
  ];

  const handleSearch = (query: string, filters: Record<string, string>) => {
    setSearchQuery(query);
    
    // Si cambia el grupo en los filtros, debemos actualizar las modelos asociadas
    const newGroup = filters.group || '';
    if (newGroup !== selectedGroup) {
      setSelectedGroup(newGroup);
      setSelectedModel(''); // Limpiar modelo al cambiar de grupo
      setModels([]);
      if (newGroup) {
        loadModelsForGroup(newGroup);
      }
    } else {
      setSelectedModel(filters.model || '');
    }

    setSelectedJornada(filters.jornada || '');
    setSelectedPlatform(filters.platform || '');
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Obtener token de autenticación
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error('❌ [PORTAFOLIO] No hay token de autenticación');
        setError('No hay sesión activa');
        setLoading(false);
        return;
      }
      
      // Cargar grupos según jerarquía del usuario
      const groupsResponse = await fetch('/api/groups', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          userRole: userRole,
          userGroups: userGroups
        })
      });
      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json();
        if (groupsData.success) {
          // Incluir todos los grupos sin filtrar
          setGroups(groupsData.groups);
        }
      }

      // Cargar catálogo de plataformas
      const platformsResponse = await fetch('/api/plataformas-catalogo');
      if (platformsResponse.ok) {
        const platformsData = await platformsResponse.json();
        setAllPlatforms(Array.isArray(platformsData) ? platformsData : []);
      }

      // Cargar IDs de usuarios con rol 'modelo' para filtrar panel
      const usersRes = await fetch('/api/users?role=modelo', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (usersRes.ok) {
        const raw = await usersRes.json();
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.users) ? raw.users : []);
        const onlyModels = list.filter((u: any) => (u.role === 'modelo' && u.is_active));
        setAllowedModelIds(onlyModels.map((u: any) => u.id));
        
        // Mapear información de modelos incluyendo avatar
        const modelsMap: Record<string, { name: string; email: string; avatar_url: string | null }> = {};
        onlyModels.forEach((u: any) => {
          modelsMap[u.id] = {
            name: u.name,
            email: u.email,
            avatar_url: u.avatar_url || null
          };
        });
        setAllModelsInfo(modelsMap);
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

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'disponible': return 'bg-slate-400 dark:bg-slate-500';
      case 'solicitada': return 'bg-blue-500';
      case 'pendiente': return 'bg-amber-500';
      case 'entregada': return 'bg-emerald-500';
      case 'desactivada': return 'bg-slate-600 dark:bg-slate-700';
      case 'inviable': return 'bg-rose-500';
      default: return 'bg-slate-400';
    }
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
    setModalActiveTab('estado');
    setShowActionModal(true);
    console.log('🟢 showActionModal establecido a true');
    
    // Si el estado visual es "entregada", cargar credenciales existentes
    if (visualStatus === 'entregada' && (userRole === 'admin' || userRole === 'super_admin')) {
      await loadPlatformCredentials(platform.model_id, platform.platform_id, platform.model_email);
      // Cargar credenciales de 3CX si es Superfoon
      const isSuperfoon = platform.platform_id?.toLowerCase() === 'superfoon' || 
                          platform.platform_name?.toLowerCase().includes('superfoon');
      if (isSuperfoon) {
        await loadCredentials3CX(platform.model_id, platform.platform_id, platform.model_email);
      } else {
        setApp3CXUsername('');
        setApp3CXPassword('');
        setHasCredentials3CX(false);
      }
    } else {
      // Limpiar campos de credenciales
      setLoginUrl('');
      setLoginUsername('');
      setLoginPassword('');
      setHasCredentials(false);
      setApp3CXUsername('');
      setApp3CXPassword('');
      setHasCredentials3CX(false);
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
  const loadPlatformCredentials = async (modelId: string, platformId: string, modelEmail?: string) => {
    if (!userId) return;
    
    try {
      setLoadingCredentials(true);
      const token = await getValidToken();
      if (!token) {
        setLoginUrl('');
        setLoginUsername(modelEmail || '');
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
          setLoginUsername(modelEmail || '');
          setLoginPassword('');
          setHasCredentials(false);
        }
      } else {
        setLoginUsername(modelEmail || '');
        setLoginPassword('');
        setHasCredentials(false);
      }
    } catch (error) {
      console.error('Error cargando credenciales:', error);
      setLoginUrl('');
      setLoginUsername(modelEmail || '');
      setLoginPassword('');
      setHasCredentials(false);
    } finally {
      setLoadingCredentials(false);
    }
  };

  // Cargar credenciales de 3CX
  const loadCredentials3CX = async (modelId: string, platformId: string, modelEmail?: string) => {
    if (!userId) return;
    
    try {
      setLoading3CX(true);
      const token = await getValidToken();
      if (!token) {
        setApp3CXUsername(modelEmail || '');
        setApp3CXPassword('');
        setHasCredentials3CX(false);
        return;
      }

      const response = await fetch(`/api/modelo-plataformas/credentials-3cx?model_id=${modelId}&platform_id=${platformId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.hasCredentials) {
          setApp3CXUsername(data.data.app_3cx_username || '');
          setApp3CXPassword(data.data.app_3cx_password || '');
          setHasCredentials3CX(true);
        } else {
          setApp3CXUsername(modelEmail || '');
          setApp3CXPassword('');
          setHasCredentials3CX(false);
        }
      } else {
        setApp3CXUsername(modelEmail || '');
        setApp3CXPassword('');
        setHasCredentials3CX(false);
      }
    } catch (error) {
      console.error('Error cargando credenciales 3CX:', error);
      setApp3CXUsername(modelEmail || '');
      setApp3CXPassword('');
      setHasCredentials3CX(false);
    } finally {
      setLoading3CX(false);
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

  // Guardar credenciales de 3CX
  const saveCredentials3CX = async () => {
    if (!selectedPlatformForAction || !userId) return;
    
    if (!app3CXUsername.trim() || !app3CXPassword.trim()) {
      setError('Por favor completa usuario y contraseña de 3CX');
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

      const response = await fetch('/api/modelo-plataformas/credentials-3cx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          model_id: selectedPlatformForAction.model_id,
          platform_id: selectedPlatformForAction.platform_id,
          app_3cx_username: app3CXUsername.trim(),
          app_3cx_password: app3CXPassword
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSuccess('Credenciales de 3CX guardadas correctamente');
          setHasCredentials3CX(true);
        } else {
          setError(data.error || 'Error al guardar credenciales de 3CX');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Error al guardar credenciales de 3CX');
      }
    } catch (error) {
      console.error('Error guardando credenciales 3CX:', error);
      setError('Error al guardar credenciales de 3CX');
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

  // Filtrar para mostrar únicamente usuarios activos con rol 'modelo' que coincidan con la búsqueda
  const filteredPlatforms = platforms.filter(p => {
    if (!allowedModelIds.includes(p.model_id)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const info = allModelsInfo[p.model_id];
      if (!info) return false;

      const nameMatch = info.name?.toLowerCase().includes(q);
      const emailMatch = info.email?.toLowerCase().includes(q);
      const userMatch = info.email?.split('@')[0]?.toLowerCase().includes(q);

      return nameMatch || emailMatch || userMatch;
    }

    return true;
  });

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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-300">Cargando portafolio...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative w-full overflow-hidden">
      <ModelAuroraBackground />
      <div className="max-w-7xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-8 pt-16 relative z-10">
        
        {/* Mensaje de alerta para admins sin sedes asignadas */}
        {userRole === 'admin' && groups.length === 0 && (
          <div className="mb-8">
            <GlassCard padding="md">
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
            </GlassCard>
          </div>
        )}
        {/* Header — Migrado a PageHeader */}
        <PageHeader
          title="Portafolio Modelos"
          subtitle="Gestión de plataformas por modelo y sede"
          glow="admin"
          icon={<Grid3X3 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />}
        />

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

        {/* Búsqueda y Filtros Unificados */}
        <div className="mb-6 z-40 relative">
          <div className="mb-2 px-1 sm:px-2 flex items-center gap-2">
            <svg 
              className="w-[18px] h-[18px] text-blue-500 dark:text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h2 className="text-[14px] sm:text-[15px] font-semibold tracking-wide text-gray-800 dark:text-gray-200">
              Búsqueda y Filtros
            </h2>
          </div>
          <GlassCard padding="md" className="relative z-[60]">
            <AppleSearchBar
              onSearch={handleSearch}
              placeholder="Buscar por nombre, usuario o correo..."
              filters={searchFiltersConfig}
              showResultsInfo={false}
              onClearSearch={() => {
                setSearchQuery('');
                setSelectedGroup('');
                setSelectedModel('');
                setSelectedJornada('');
                setSelectedPlatform('');
                setModels([]);
              }}
            />
          </GlassCard>
        </div>

        {/* Título de Resultados Fuera de la Caja */}
        <div className="flex items-center justify-between mb-4 px-1 mt-6">
          <div className="flex items-center space-x-2 min-w-0">
            <User className="w-[22px] h-[22px] text-indigo-500 dark:text-indigo-400 drop-shadow-[0_0_6px_rgba(99,102,241,0.4)] shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              Modelos ({modelsList.length})
            </h2>
          </div>
        </div>

        {/* Results */}
        <GlassCard padding="none" className="p-2 sm:p-3">
          {modelsList.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Aplica un filtro de Grupo, Modelo, Room, Jornada o Plataforma para ver resultados.</p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {modelsList.map((model) => (
                <div
                  key={model.model_id}
                  className="p-5 sm:p-6 rounded-2xl bg-white/40 dark:bg-black/20 border border-black/5 dark:border-white/5 relative overflow-hidden"
                >
                  {/* Header del Modelo */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
                    <div className="flex items-center space-x-3">
                      {(() => {
                        const avatarUrl = allModelsInfo[model.model_id]?.avatar_url || '/favicon.png';
                        return (
                          <div 
                            className="w-10 h-10 rounded-full overflow-hidden shadow-md shrink-0 relative flex-shrink-0 cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              setZoomedImage(avatarUrl);
                            }}
                            title="Ampliar foto"
                          >
                            <img 
                              src={avatarUrl} 
                              alt={model.model_name || 'Modelo'}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/favicon.png';
                              }}
                            />
                          </div>
                        );
                      })()}
                      <div className="min-w-0 flex-1">
                        <h4 
                          className="text-[15px] sm:text-base font-semibold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
                          onClick={() => handleModelNameClick(model.model_id, model.model_email)}
                          title="Ver calculadora de la modelo"
                        >
                          {getModelDisplayName(model.model_email)}
                        </h4>
                        <p className="text-[12px] sm:text-[13px] text-gray-500 dark:text-gray-400 flex items-center mt-0.5">
                          <Building2 className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                          <span className="truncate">{model.group_name}</span>
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
                      className="w-full sm:w-auto h-9 px-5 bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white rounded-full active:scale-[0.98] transition-all duration-300 shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:shadow-lg hover:shadow-fuchsia-500/40 flex items-center justify-center gap-2 text-xs font-semibold touch-manipulation"
                      title="Abrir Boost Pages para subir fotos a las plataformas"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Boost Pages
                    </button>
                  </div>

                  {/* Caja contenedora de las burbujas de plataforma */}
                  <div 
                    className="bg-black/[0.02] dark:bg-white/[0.015] border border-black/[0.04] dark:border-white/[0.05] rounded-[1.1rem] sm:rounded-[1.25rem] mb-4 relative overflow-hidden"
                    style={{ padding: '6px' }}
                  >
                    <div 
                      className="flex flex-wrap"
                      style={{ gap: '6px' }}
                    >
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
                            className={`inline-flex items-center px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-xs font-medium tracking-wide active:scale-95 hover:scale-[1.02] transition-all gap-2 border cursor-pointer ${
                              finalStatus === 'entregada'
                                ? 'bg-emerald-500/[0.03] dark:bg-emerald-950/[0.15] hover:bg-emerald-500/[0.08] dark:hover:bg-emerald-900/[0.25] border-emerald-500/10 dark:border-emerald-500/20 hover:border-emerald-500/40 dark:hover:border-emerald-500/50 text-emerald-800 dark:text-emerald-200 hover:text-emerald-900 dark:hover:text-emerald-100 shadow-[0_2px_8px_rgba(16,185,129,0.04)] hover:shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                                : finalStatus === 'solicitada'
                                ? 'bg-blue-500/[0.03] dark:bg-blue-950/[0.15] hover:bg-blue-500/[0.08] dark:hover:bg-blue-900/[0.25] border-blue-500/10 dark:border-blue-500/20 hover:border-blue-500/40 dark:hover:border-blue-500/50 text-blue-800 dark:text-blue-200 hover:text-blue-900 dark:hover:text-blue-100 shadow-[0_2px_8px_rgba(59,130,246,0.04)] hover:shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                                : finalStatus === 'pendiente'
                                ? 'bg-amber-500/[0.03] dark:bg-amber-950/[0.15] hover:bg-amber-500/[0.08] dark:hover:bg-amber-900/[0.25] border-amber-500/10 dark:border-amber-500/20 hover:border-amber-500/40 dark:hover:border-amber-500/50 text-amber-800 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100 shadow-[0_2px_8px_rgba(245,158,11,0.04)] hover:shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                                : finalStatus === 'inviable'
                                ? 'bg-rose-500/[0.03] dark:bg-rose-950/[0.15] hover:bg-rose-500/[0.08] dark:hover:bg-rose-900/[0.25] border-rose-500/10 dark:border-rose-500/20 hover:border-rose-500/40 dark:hover:border-rose-500/50 text-rose-800 dark:text-rose-200 hover:text-rose-900 dark:hover:text-rose-100 shadow-[0_2px_8px_rgba(244,63,94,0.04)] hover:shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                                : finalStatus === 'desactivada'
                                ? 'bg-slate-500/[0.03] dark:bg-slate-950/[0.15] hover:bg-slate-500/[0.08] dark:hover:bg-slate-900/[0.25] border-slate-500/10 dark:border-slate-500/20 hover:border-slate-500/40 dark:hover:border-slate-500/50 text-slate-700 dark:text-slate-300 hover:text-slate-955 dark:hover:text-slate-100 shadow-[0_2px_8px_rgba(148,163,184,0.04)] hover:shadow-[0_0_12px_rgba(148,163,184,0.2)]'
                                : 'bg-white/5 dark:bg-white/[0.02] hover:bg-black/[0.02] dark:hover:bg-white/[0.05] border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20 text-gray-700 dark:text-gray-300 hover:text-gray-955 dark:hover:text-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_0_12px_rgba(255,255,255,0.1)]'
                            }`}
                            onClick={() => handlePlatformAction(tag, 'request')}
                          >
                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                              finalStatus === 'entregada'
                                ? 'bg-emerald-400 dark:bg-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                                : finalStatus === 'solicitada'
                                ? 'bg-blue-400 dark:bg-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.8)]'
                                : finalStatus === 'pendiente'
                                ? 'bg-amber-400 dark:bg-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                                : finalStatus === 'inviable'
                                ? 'bg-rose-400 dark:bg-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                                : finalStatus === 'desactivada'
                                ? 'bg-slate-400 dark:bg-slate-300 shadow-[0_0_8px_rgba(148,163,184,0.8)]'
                                : 'bg-slate-300 dark:bg-slate-500 shadow-[0_0_8px_rgba(203,213,225,0.8)]'
                            }`} />
                            <span>{tag.platform_name}</span>
                            {/* Indicador sutil de credenciales guardadas */}
                            {hasCreds && finalStatus === 'entregada' && (userRole === 'admin' || userRole === 'super_admin') && (
                              <span 
                                className="ml-0.5 w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 shadow-[0_0_4px_rgba(59,130,246,0.8)]" 
                                title="Credenciales guardadas"
                                aria-label="Credenciales guardadas"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Estadísticas del Modelo */}
                  <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-0 text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                      <span>Total: {allPlatforms.length} plataformas</span>
                      <div className="flex flex-wrap gap-x-2 sm:gap-x-4 gap-y-1">
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
                        <span className="text-gray-500 dark:text-gray-400">
                          Disponibles: {allPlatforms.length - model.platforms.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Action Modal */}
        {showActionModal && selectedPlatformForAction && (() => {
          const visualStatus = (selectedPlatformForAction.is_initial_config && selectedPlatformForAction.status !== 'desactivada')
            ? 'entregada'
            : selectedPlatformForAction.status;
          const isDeliveredVisual = modalStatus === 'entregada' || visualStatus === 'entregada';
          const showCredsTab = isDeliveredVisual && (userRole === 'admin' || userRole === 'super_admin');
          const isSuperfoon = selectedPlatformForAction && 
            (selectedPlatformForAction.platform_id?.toLowerCase() === 'superfoon' || 
             selectedPlatformForAction.platform_name?.toLowerCase().includes('superfoon'));

          return (
            <StandardModal 
              isOpen={showActionModal} 
              onClose={() => setShowActionModal(false)} 
              title={
                actionType === 'request' && 'Estado de Plataforma' ||
                actionType === 'deliver' && 'Entregar Plataforma' ||
                actionType === 'deactivate' && 'Desactivar Plataforma' ||
                actionType === 'revert' && 'Revertir Plataforma' ||
                'Acción'
              }
              maxWidthClass={showCredsTab && isSuperfoon ? 'max-w-2xl' : 'max-w-lg'}
            >
              {/* Barra de Pestañas Apple-Style */}
              {showCredsTab && (
                <div className="flex p-0.5 bg-black/5 dark:bg-white/5 backdrop-blur-sm rounded-xl mb-4 relative border border-black/5 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setModalActiveTab('estado')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                      modalActiveTab === 'estado'
                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Estado de Plataforma
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalActiveTab('credenciales')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                      modalActiveTab === 'credenciales'
                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Credenciales
                  </button>
                </div>
              )}

              {/* Contenido según pestaña activa */}
              {(!showCredsTab || modalActiveTab === 'estado') ? (
                /* PESTAÑA 1: Estado de Plataforma */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Columna Izquierda: Info y Estado */}
                  <div className="space-y-4 pb-14">
                    <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                        Información
                      </h4>
                      <div className="grid grid-cols-2 gap-y-2 text-xs">
                        <div className="text-gray-400 dark:text-gray-500 font-medium">Plataforma</div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100 text-right md:text-left">{selectedPlatformForAction.platform_name}</div>
                        
                        <div className="text-gray-400 dark:text-gray-500 font-medium">Modelo</div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100 text-right md:text-left truncate" title={getModelDisplayName(selectedPlatformForAction.model_email)}>
                          {getModelDisplayName(selectedPlatformForAction.model_email)}
                        </div>
                        
                        <div className="text-gray-400 dark:text-gray-500 font-medium">Estado actual</div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100 text-right md:text-left">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                            {getStatusText(selectedPlatformForAction.status)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-gray-400 dark:text-gray-500">
                        Estado
                      </label>
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

                  {/* Columna Derecha: Notas */}
                  <div className="space-y-4 flex flex-col justify-stretch">
                    <div className="space-y-1.5 flex-1 flex flex-col">
                      <label className="block text-[11px] font-medium text-gray-400 dark:text-gray-500">
                        Notas (opcional)
                      </label>
                      <textarea
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        rows={4}
                        className="w-full flex-1 px-3.5 py-2.5 text-xs border border-black/10 dark:border-white/10 rounded-xl bg-white/40 dark:bg-black/20 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all duration-200 resize-none"
                        placeholder="Agregar notas sobre esta acción..."
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* PESTAÑA 2: Credenciales */
                <div className="space-y-4">
                  {loadingCredentials ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                      Cargando credenciales...
                    </div>
                  ) : (
                    <div className={`grid grid-cols-1 ${isSuperfoon ? 'md:grid-cols-2 gap-4' : 'gap-4'}`}>
                      {/* Credenciales Web */}
                      <div className="bg-blue-500/[0.015] dark:bg-blue-500/[0.03] border border-blue-500/10 dark:border-blue-500/20 rounded-2xl p-4 space-y-3.5 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                              Credenciales Web
                            </h4>
                            {hasCredentials && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold bg-emerald-500/10 dark:bg-emerald-500/20 px-2 py-0.5 rounded-full">
                                <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                                Guardado
                              </span>
                            )}
                          </div>

                          {/* URL de Acceso */}
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-medium text-gray-400 dark:text-gray-500">
                              URL de acceso
                            </label>
                            {loginUrl ? (
                              <a 
                                href={loginUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-between w-full px-3.5 py-2 text-xs border border-black/5 dark:border-white/5 rounded-xl bg-black/5 dark:bg-black/40 text-blue-500 dark:text-blue-400 hover:underline truncate gap-2"
                              >
                                <span className="truncate">{loginUrl}</span>
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                              </a>
                            ) : (
                              <div className="w-full px-3.5 py-2 text-xs border border-yellow-500/10 rounded-xl bg-yellow-500/[0.03] text-yellow-600 dark:text-yellow-400 font-medium">
                                ⚠️ URL no configurada
                              </div>
                            )}
                          </div>

                          {/* Usuario/Email */}
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-medium text-gray-400 dark:text-gray-500">
                              Usuario / Email <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={loginUsername}
                              onChange={(e) => setLoginUsername(e.target.value)}
                              className="w-full px-3.5 py-2 text-xs bg-white/40 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all duration-200"
                              placeholder="usuario@ejemplo.com"
                              autoComplete="off"
                            />
                          </div>

                          {/* Contraseña */}
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-medium text-gray-400 dark:text-gray-500">
                              Contraseña <span className="text-red-500">*</span>
                            </label>
                            <div className="relative flex items-center">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                className="w-full px-3.5 py-2 pr-8 text-xs bg-white/40 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all duration-200 font-mono"
                                placeholder="••••••••"
                                autoComplete="new-password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                              >
                                {showPassword ? <Eye className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={savePlatformCredentials}
                          disabled={processingAction || !loginUsername.trim() || !loginPassword.trim()}
                          className="w-40 mx-auto mt-4 h-9 bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white rounded-full active:scale-[0.98] transition-all duration-300 shadow-[0_2px_8px_rgba(6,182,212,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-xs font-semibold cursor-pointer"
                        >
                          <span>{processingAction ? 'Guardando...' : hasCredentials ? 'Actualizar' : 'Guardar'}</span>
                        </button>
                      </div>

                      {/* Credenciales App 3CX (si es Superfoon) */}
                      {isSuperfoon && (
                        <div className="bg-purple-500/[0.015] dark:bg-purple-500/[0.03] border border-purple-500/10 dark:border-purple-500/20 rounded-2xl p-4 space-y-3.5 flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                                Credenciales 3CX
                              </h4>
                              {hasCredentials3CX && (
                                <span className="text-[10px] text-purple-600 dark:text-purple-400 flex items-center gap-1 font-semibold bg-purple-500/10 dark:bg-purple-500/20 px-2 py-0.5 rounded-full">
                                  <span className="w-1 h-1 rounded-full bg-purple-500"></span>
                                  Guardado
                                </span>
                              )}
                            </div>

                            {/* App Vinculada */}
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-medium text-gray-400 dark:text-gray-500">
                                App vinculada
                              </label>
                              <div className="w-full px-3.5 py-2 text-xs border border-purple-500/10 rounded-xl bg-black/5 dark:bg-black/40 text-purple-500 dark:text-purple-400 font-semibold truncate">
                                3CX Softphone Client
                              </div>
                            </div>

                            {/* Usuario 3CX */}
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-medium text-gray-400 dark:text-gray-500">
                                Usuario 3CX <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={app3CXUsername}
                                onChange={(e) => setApp3CXUsername(e.target.value)}
                                className="w-full px-3.5 py-2 text-xs bg-white/40 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all duration-200"
                                placeholder="usuario@ejemplo.com"
                                autoComplete="off"
                              />
                            </div>

                            {/* Contraseña 3CX */}
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-medium text-gray-400 dark:text-gray-500">
                                Contraseña 3CX <span className="text-red-500">*</span>
                              </label>
                              <div className="relative flex items-center">
                                <input
                                  type={showPassword3CX ? 'text' : 'password'}
                                  value={app3CXPassword}
                                  onChange={(e) => setApp3CXPassword(e.target.value)}
                                  className="w-full px-3.5 py-2 pr-8 text-xs bg-white/40 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all duration-200 font-mono"
                                  placeholder="••••••••"
                                  autoComplete="new-password"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword3CX(!showPassword3CX)}
                                  className="absolute right-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                                  title={showPassword3CX ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                >
                                  {showPassword3CX ? <Eye className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={saveCredentials3CX}
                            disabled={processingAction || !app3CXUsername.trim() || !app3CXPassword.trim()}
                            className="w-40 mx-auto mt-4 h-9 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-full active:scale-[0.98] transition-all duration-300 shadow-[0_2px_8px_rgba(168,85,247,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-xs font-semibold cursor-pointer"
                          >
                            <span>{processingAction ? 'Guardando...' : hasCredentials3CX ? 'Actualizar 3CX' : 'Guardar 3CX'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Botones de pie del modal */}
              <div className="flex space-x-3 mt-5 pt-3.5 border-t border-black/5 dark:border-white/5">
                <button
                  type="button"
                  onClick={executeAction}
                  disabled={processingAction}
                  className="flex-1 disabled:opacity-50 btn-apple-primary cursor-pointer h-9 rounded-full flex items-center justify-center text-xs font-semibold"
                >
                  {processingAction ? 'Procesando...' : 'Confirmar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowActionModal(false)}
                  className="flex-1 h-9 rounded-full border border-black/10 dark:border-white/10 text-gray-700 dark:text-gray-300 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] transition-all flex items-center justify-center text-xs font-semibold cursor-pointer"
                  disabled={processingAction}
                >
                  Cancelar
                </button>
              </div>
            </StandardModal>
          );
        })()}

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

        {zoomedImage && isMounted && typeof document !== 'undefined' && createPortal(
          <div 
            className="fixed inset-0 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 cursor-pointer animate-in fade-in duration-200"
            onClick={() => setZoomedImage(null)}
            style={{ zIndex: 100000 }}
          >
            <img 
              src={zoomedImage} 
              alt="Avatar Ampliado" 
              className="w-full max-w-[360px] h-auto max-h-[360px] rounded-2xl shadow-2xl object-cover border border-white/10 cursor-default animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              className="absolute top-6 right-6 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md transition-colors cursor-pointer"
              onClick={() => setZoomedImage(null)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
