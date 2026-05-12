"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppleDropdown from '@/components/ui/AppleDropdown';
import { supabase } from '@/lib/supabase';
import PageHeader from "@/components/ui/PageHeader";

export default function CreateUserPage() {
  const router = useRouter();
  const [form, setForm] = useState({ 
    name: "", 
    email: "", 
    password: "", 
    role: "modelo", 
    groups: [] as string[],
    room_id: "",
    jornada: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [groups, setGroups] = useState<Array<{id:string; name:string}>>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [openGroups, setOpenGroups] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Array<{id: string, room_name: string}>>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentUser, setCurrentUser] = useState<{role: string, groups: string[], affiliate_studio_id?: string | null} | null>(null);

  // Formatear el nombre con mayúscula inicial en cada palabra
  const titleCaseWords = (input: string) => {
    return input
      .trimStart()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '')
      .join(' ');
  };

  // Sanear espacios y puntuación para nombres
  const sanitizeBasic = (input: string) => {
    return input
      .trim() // quitar espacios al inicio/fin
      .replace(/\s{2,}/g, ' ') // colapsar múltiples espacios
      .replace(/\s+([,.;:])/g, '$1'); // quitar espacio antes de puntuación común
  };

  // Función para determinar si un grupo requiere rooms obligatorios
  const groupRequiresRooms = (groupName: string): boolean => {
    // Solo "Sede MP" requiere rooms obligatorios
    // Otros grupos (Cabecera, Victoria, Terrazas, Diamante) omitidos por ahora
    return groupName === 'Sede MP';
  };

  // Función para determinar si un grupo requiere jornada obligatoria
  const groupRequiresJornada = (groupName: string): boolean => {
    // Solo "Sede MP" requiere jornada obligatoria
    // Otros grupos (Cabecera, Victoria, Terrazas, Diamante) omitidos por ahora
    return groupName === 'Sede MP';
  };

  // Obtener el nombre del grupo seleccionado
  const selectedGroupName = groups.find(g => g.id === form.groups[0])?.name || '';

  useEffect(() => {
    const loadUserAndGroups = async () => {
      try {
        setLoadingGroups(true);
        
        // Cargar usuario actual
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          try {
            const { data: userData, error } = await supabase
              .from('users')
              .select(`
                role,
                affiliate_studio_id,
                user_groups(
                  groups!inner(
                    id,
                    name
                  )
                )
              `)
              .eq('id', session.user.id)
              .single();
            
            if (error) {
              console.error('Error obteniendo datos del usuario:', error);
              // Fallback: usar datos básicos
              setCurrentUser({
                role: 'admin', // Asumir admin por defecto
                groups: [],
                affiliate_studio_id: null
              });
            } else if (userData) {
              const userGroups = userData.user_groups?.map((ug: any) => ug.groups.id) || [];
              setCurrentUser({
                role: userData.role,
                groups: userGroups,
                affiliate_studio_id: userData.affiliate_studio_id
              });
            }
          } catch (err) {
            console.error('Error en consulta de usuario:', err);
            // Fallback: usar datos básicos
            setCurrentUser({
              role: 'admin', // Asumir admin por defecto
              groups: [],
              affiliate_studio_id: null
            });
          }
        }

        // Cargar grupos con autenticación para que el filtro de afiliado funcione
        const { data: { session: groupsSession } } = await supabase.auth.getSession();
        const groupsRes = await fetch('/api/groups', {
          headers: groupsSession?.access_token ? {
            'Authorization': `Bearer ${groupsSession.access_token}`
          } : {}
        });
        const groupsData = await groupsRes.json();
        if (groupsData.success) setGroups(groupsData.groups);
      } finally {
        setLoadingGroups(false);
      }
    };
    loadUserAndGroups();
  }, []);

  // Función para cargar rooms por grupo
  const loadRoomsForGroup = async (groupId: string) => {
    if (!groupId) {
      setAvailableRooms([]);
      return;
    }

    setLoadingRooms(true);
    try {
      const response = await fetch(`/api/groups/rooms?groupId=${groupId}`);
      const data = await response.json();
      
      if (data.success) {
        setAvailableRooms(data.rooms);
      } else {
        console.error('Error loading rooms:', data.error);
        setAvailableRooms([]);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      setAvailableRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  // Cargar rooms cuando se selecciona un grupo
  useEffect(() => {
    if (form.groups.length > 0) {
      loadRoomsForGroup(form.groups[0]);
    } else {
      setAvailableRooms([]);
    }
  }, [form.groups]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Sanear y normalizar nombre antes de enviar
      const sanitizedName = titleCaseWords(sanitizeBasic(form.name || ''));
      // Preparar datos para la API - cambiar 'groups' por 'group_ids'
      const apiData = {
        ...form,
        name: sanitizedName,
        group_ids: form.groups, // Mapear groups a group_ids
        groups: undefined // Eliminar el campo groups
      };
      delete apiData.groups; // Limpiar el campo groups
      
      console.log('🔍 [FRONTEND] Enviando datos a la API:', apiData);
      
      // Obtener token de autenticación para que la API pueda identificar al creador
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch("/api/users", { 
        method: "POST", 
        headers: { 
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {})
        }, 
        body: JSON.stringify(apiData) 
      });
      
      const result = await res.json();
      console.log('🔍 [FRONTEND] Respuesta de la API:', result);
      
      if (res.ok && result.success) {
        setSuccess('Usuario creado exitosamente');
        // Limpiar formulario
        setForm({
          name: "",
          email: "",
          password: "",
          role: "modelo",
          groups: [],
          room_id: "",
          jornada: ""
        });
        // Redirigir después de 2 segundos
        setTimeout(() => {
          router.push("/admin/users");
        }, 2000);
      } else {
        setError(result.error || 'Error creando usuario');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Error de conexión. Por favor, intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="max-w-screen-2xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-8 pt-16 pb-16">
        {/* Header */}
        <PageHeader
          title="Crear Usuario"
          subtitle="Registra un nuevo usuario en el sistema"
          glow="admin"
          icon={
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />

        {/* Formulario Estándar Apple Style 2 */}
        <div className="max-w-lg mx-auto">
          <div className="glass-card p-4 sm:p-6 z-[99999] relative">
            
            {/* Mensajes de error y éxito */}
            {error && (
              <div className="mb-5 p-3 bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm border border-red-200/50 dark:border-red-700/50 rounded-xl shadow-sm">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <div className="w-5 h-5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {success && (
              <div className="mb-5 p-3 bg-green-50/80 dark:bg-green-900/20 backdrop-blur-sm border border-green-200/50 dark:border-green-700/50 rounded-xl shadow-sm">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <div className="w-5 h-5 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">{success}</p>
                  </div>
                </div>
              </div>
            )}
            
            <form onSubmit={onSubmit} className="flex flex-col space-y-4">
              
              <div className="flex flex-col space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Nombre</label>
                <input
                  placeholder="Nombre Completo"
                  value={form.name}
                  onChange={e=>setForm({...form, name: titleCaseWords(e.target.value)})}
                  required
                  autoComplete="name"
                  autoCapitalize="words"
                  spellCheck={true}
                  className="apple-input"
                />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Correo electrónico</label>
                <input
                  placeholder="Correo electrónico"
                  type="email"
                  value={form.email}
                  onChange={e=>setForm({...form, email:e.target.value})}
                  required
                  autoComplete="email"
                  className="apple-input"
                />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Contraseña</label>
                <div className="relative">
                  <input
                    placeholder="Contraseña"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e=>setForm({...form, password:e.target.value})}
                    required
                    autoComplete="new-password"
                    className="apple-input pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v=>!v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    className="absolute right-2 top-1.5 px-2 py-1 rounded-md text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  >
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Rol</label>
                <AppleDropdown
                  options={(() => {
                    const allRoles = [
                      { value: 'modelo', label: 'Modelo' },
                      { value: 'fotografia', label: 'Fotografía' },
                      { value: 'gestor', label: 'Gestor' },
                      { value: 'admin', label: 'Admin' },
                      { value: 'super_admin', label: 'Super Admin' }
                    ];
                    
                    if (currentUser?.role === 'admin') {
                      return allRoles.filter(role => role.value === 'modelo');
                    }
                    
                    if (currentUser?.role === 'superadmin_aff') {
                      return allRoles.filter(role => 
                        role.value === 'modelo' || role.value === 'admin'
                      );
                    }
                    
                    return allRoles;
                  })()}
                  value={form.role}
                  onChange={(value) => {
                    const newRole = value as any;
                    if (newRole === 'gestor' || newRole === 'fotografia') {
                      setForm({ ...form, role: newRole, groups: [], room_id: '', jornada: '' });
                    } else {
                      setForm({ ...form, role: newRole });
                    }
                  }}
                  placeholder="Selecciona un rol"
                />
              </div>

              {/* Ocultar grupos para gestor y fotografia */}
              {form.role !== 'gestor' && form.role !== 'fotografia' && (
                <div className="flex flex-col space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Grupos</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenGroups(v => !v)}
                      className="apple-input flex items-center justify-between"
                    >
                      <span className={form.groups.length ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}>
                        {form.groups.length
                          ? groups.filter(g => form.groups.includes(g.id)).map(g => g.name).join(', ')
                          : (form.role === 'modelo' ? 'Selecciona un grupo' : 'Selecciona uno o varios grupos')}
                      </span>
                      <svg 
                        className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${openGroups ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openGroups && (
                      <div className="apple-scroll absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {loadingGroups ? (
                            <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">Cargando grupos...</div>
                        ) : (
                          groups.map((g, index) => {
                            const isSelected = form.groups.includes(g.id);
                            const isSingleRole = form.role === 'modelo';
                            const isDisabled = isSingleRole && form.groups.length > 0 && !isSelected;
                            
                            const canAssignGroup = currentUser?.role === 'super_admin' || 
                              currentUser?.role === 'superadmin_aff' ||
                              (currentUser?.role === 'admin' && currentUser?.groups.includes(g.id));
                            
                            return (
                              <button
                                key={g.id}
                                type="button"
                                disabled={isDisabled || !canAssignGroup}
                                onClick={() => {
                                  if (isSingleRole) {
                                    setForm({ ...form, groups: isSelected ? [] : [g.id] });
                                    setOpenGroups(false);
                                  } else {
                                    setForm({
                                      ...form,
                                      groups: isSelected
                                        ? form.groups.filter(id => id !== g.id)
                                        : [...form.groups, g.id]
                                    });
                                  }
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors duration-150 ${
                                  index > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''
                                } ${
                                  isDisabled || !canAssignGroup 
                                    ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50' 
                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                                } ${
                                  isSelected ? 'bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : ''
                                }`}
                              >
                                <span>{g.name}</span>
                                {isSelected && (
                                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {form.role === 'modelo' && (
                <>
                  <div className="flex flex-col space-y-1.5">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Room {groupRequiresRooms(selectedGroupName) && <span className="text-red-500">*</span>}
                    </label>
                    <AppleDropdown
                      options={availableRooms.map(room => ({ value: room.id, label: room.room_name }))}
                      value={form.room_id}
                      onChange={(value) => setForm({ ...form, room_id: value })}
                      placeholder={loadingRooms ? 'Cargando rooms...' : 'Selecciona un room'}
                      disabled={loadingRooms || availableRooms.length === 0}
                      maxHeight="max-h-40"
                    />
                    {form.groups.length === 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Primero selecciona un grupo</p>
                    )}
                    {!groupRequiresRooms(selectedGroupName) && selectedGroupName && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Opcional para {selectedGroupName}</p>
                    )}
                  </div>

                  <div className="flex flex-col space-y-1.5">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Jornada {groupRequiresJornada(selectedGroupName) && <span className="text-red-500">*</span>}
                    </label>
                    <AppleDropdown
                      options={[
                        { value: 'MAÑANA', label: 'Mañana' },
                        { value: 'TARDE', label: 'Tarde' },
                        { value: 'NOCHE', label: 'Noche' }
                      ]}
                      value={form.jornada}
                      onChange={(value) => setForm({ ...form, jornada: value })}
                      placeholder="Selecciona una jornada"
                    />
                    {!groupRequiresJornada(selectedGroupName) && selectedGroupName && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Opcional para {selectedGroupName}</p>
                    )}
                  </div>
                </>
              )}

              <div className="flex gap-1 p-1 mt-4 rounded-full border border-black/5 dark:border-white/10 bg-transparent">
                <button 
                  type="button"
                  onClick={() => router.back()}
                  className="px-5 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button 
                  disabled={submitting} 
                  type="submit"
                  className="flex-1 btn-apple-primary"
                >
                  {submitting ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
