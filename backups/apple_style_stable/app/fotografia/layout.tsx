"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from '@/lib/supabase';
import { modernLogout } from '@/lib/auth-modern';
import dynamic from 'next/dynamic';
import ClientOnly from '@/components/ClientOnly';

const ChatWidget = dynamic(() => import('@/components/chat/ChatWidget'), { ssr: false });
import ThemeToggle from '@/components/ThemeToggle';
import { getMenuForRole } from '@/lib/menu-config';
import AvatarCropperModal from '@/components/ui/AvatarCropperModal';

export default function FotografiaLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    id: string;
    name: string;
    email: string;
    role: 'super_admin' | 'admin' | 'modelo' | 'gestor' | 'fotografia' | string;
    groups: string[];
    avatar_url?: string;
  } | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarFileToCrop, setAvatarFileToCrop] = useState<File | null>(null);
  const [menuTimeout, setMenuTimeout] = useState<NodeJS.Timeout | null>(null);
  const userPanelRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedMobileItems, setExpandedMobileItems] = useState<Set<string>>(new Set());

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userInfo) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen original no debe pesar más de 5MB.');
      return;
    }

    setAvatarFileToCrop(file);
    if (event.target) event.target.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!userInfo) return;
    try {
      setIsUploadingAvatar(true);
      
      // Intentar borrar la imagen anterior de supabase storage para no saturar
      if (userInfo.avatar_url) {
        try {
          const urlParts = userInfo.avatar_url.split('/');
          const oldFilename = urlParts[urlParts.length - 1];
          if (oldFilename) {
            await supabase.storage.from('avatars').remove([oldFilename]);
            console.log('Imagen anterior eliminada exitosamente');
          }
        } catch (delError) {
          console.error('No se pudo borrar imagen anterior:', delError);
        }
      }

      const fileName = `${userInfo.id}-${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, croppedBlob, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const avatarUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', userInfo.id);

      if (updateError) throw updateError;

      setUserInfo(prev => prev ? { ...prev, avatar_url: avatarUrl } : null);
      setAvatarFileToCrop(null);
      
      try {
        const stored = localStorage.getItem('user');
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.avatar_url = avatarUrl;
          localStorage.setItem('user', JSON.stringify(parsed));
        }
      } catch (e) {}

    } catch (error: any) {
      console.error('Error al procesar/subir avatar:', error);
      alert('Hubo un error al procesar tu foto.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const loadUser = async () => {
    try {
      setLoadingUser(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) {
        setUserInfo(null);
        return;
      }
      const { data: userRow } = await supabase
        .from('users')
        .select('id,name,email,role,avatar_url')
        .eq('id', uid)
        .single();
      let groups: string[] = [];
      if (userRow && userRow.role !== 'super_admin') {
        const { data: ug } = await supabase
          .from('user_groups')
          .select('groups(name)')
          .eq('user_id', uid);
        groups = (ug || []).map((r: any) => r.groups?.name).filter(Boolean);
      }
      setUserInfo({
        id: userRow?.id || uid,
        name: userRow?.name || auth.user?.email?.split('@')[0] || 'Usuario',
        email: userRow?.email || auth.user?.email || '',
        role: (userRow?.role as any) || 'fotografia',
        groups,
        avatar_url: userRow?.avatar_url || null,
      });
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Cerrar menú móvil al cambiar de página
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevenir scroll del body cuando el menú móvil está abierto
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!userInfo && !loadingUser) {
      try {
        const local = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed?.id && parsed?.role) {
            setUserInfo({
              id: parsed.id,
              name: parsed.name || parsed.email?.split('@')[0] || 'Usuario',
              email: parsed.email || '',
              role: parsed.role,
              groups: parsed.groups || [],
              avatar_url: parsed.avatar_url || null
            });
          }
        }
      } catch {}
      loadUser();
    }
  }, [isClient]);

  const handleMenuEnter = (itemId: string) => {
    if (menuTimeout) {
      clearTimeout(menuTimeout);
      setMenuTimeout(null);
    }
    setActiveMenu(itemId);
  };

  const handleMenuLeave = () => {
    const timeout = setTimeout(() => {
      setActiveMenu(null);
    }, 300);
    setMenuTimeout(timeout);
  };

  const handleDropdownEnter = () => {
    if (menuTimeout) {
      clearTimeout(menuTimeout);
      setMenuTimeout(null);
    }
  };

  const handleDropdownLeave = () => {
    const timeout = setTimeout(() => {
      setActiveMenu(null);
    }, 150);
    setMenuTimeout(timeout);
  };

  useEffect(() => {
    return () => {
      if (menuTimeout) {
        clearTimeout(menuTimeout);
      }
    };
  }, [menuTimeout]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userPanelRef.current && !userPanelRef.current.contains(event.target as Node)) {
        setShowUserPanel(false);
      }
    };

    if (showUserPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserPanel]);

  // Obtener menú desde configuración centralizada
  const menuItems = getMenuForRole('fotografia');

  const isActive = (href: string) => pathname === href;
  const isParentActive = (item: any) => item.subItems?.some((subItem: any) => pathname === subItem.href);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Apple Style 2 Header */}
      <header className="bg-white dark:bg-gray-900 backdrop-blur-md border border-white/20 dark:border-gray-700/30 sticky top-0 z-[99999] shadow-lg dark:shadow-lg dark:shadow-purple-900/15 dark:ring-0.5 dark:ring-purple-400/20">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Logo */}
            <div className="flex items-center flex-1 min-w-0 pr-1 sm:pr-0">
              <Link href="/fotografia/dashboard" className="flex items-center space-x-1 sm:space-x-1.5 md:space-x-3 group">
                <div className="w-6 h-6 sm:w-7 md:w-9 sm:h-7 md:h-9 bg-gradient-to-br from-gray-900 to-black dark:from-gray-100 dark:to-gray-300 rounded-md sm:rounded-lg md:rounded-xl flex items-center justify-center shadow-md border border-white/20 dark:border-gray-700/30 group-hover:shadow-lg transition-all duration-300 flex-shrink-0">
                  <span className="text-white dark:text-gray-900 font-bold text-[9px] sm:text-[10px] md:text-sm tracking-wider">AIM</span>
                </div>
                <div className="flex flex-col min-w-0 hidden sm:flex">
                  <span className="text-xs sm:text-sm md:text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent truncate leading-tight">Sistema de Gestión</span>
                  <span className="hidden md:block text-xs text-gray-600 dark:text-gray-300 font-medium tracking-wide">Panel Fotografía</span>
                </div>
              </Link>
            </div>

            {/* Main Navigation (Oculto en móvil) */}
            <nav className="hidden md:flex items-center space-x-6">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => handleMenuEnter(item.id)}
                  onMouseLeave={handleMenuLeave}
                >
                  {item.href === '#' ? (
                    <span
                      className={`px-4 py-2 text-sm font-medium transition-all duration-300 cursor-default whitespace-nowrap rounded-lg hover:bg-white/60 dark:hover:bg-gray-800/60 hover:backdrop-blur-sm hover:shadow-sm ${
                        isParentActive(item) 
                          ? 'text-gray-900 dark:text-white bg-white/50 dark:bg-gray-800/50 shadow-sm' 
                          : 'text-gray-600 dark:text-white hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      {item.label}
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className={`px-4 py-2 text-sm font-medium transition-all duration-300 whitespace-nowrap rounded-lg hover:bg-white/60 dark:hover:bg-gray-800/60 hover:backdrop-blur-sm hover:shadow-sm ${
                        isActive(item.href) || isParentActive(item) 
                          ? 'text-gray-900 dark:text-white bg-white/50 dark:bg-gray-800/50 shadow-sm' 
                          : 'text-gray-600 dark:text-white hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )}

                  {/* Dropdown Menu */}
                  {activeMenu === item.id && item.subItems.length > 0 && (
                    <div 
                      className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-white/95 backdrop-blur-md border border-white/30 rounded-xl shadow-xl z-[9999999] animate-in slide-in-from-top-2 duration-200"
                      onMouseEnter={handleDropdownEnter}
                      onMouseLeave={handleDropdownLeave}
                    >
                      <div className="p-2">
                        {item.subItems.map((subItem) => (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            className={`block px-4 py-3 text-sm transition-all duration-200 rounded-lg ${
                              isActive(subItem.href)
                                ? 'bg-blue-50/80 text-blue-900 font-medium shadow-sm border border-blue-200/30'
                                : 'text-gray-600 hover:bg-white/60 hover:text-gray-900 hover:shadow-sm'
                            }`}
                          >
                            {subItem.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </nav>

            {/* User Actions (Oculto en móvil cuando el menú está abierto) */}
            <div className={`flex items-center space-x-1 sm:space-x-1.5 md:space-x-3 ${mobileMenuOpen ? 'hidden' : 'flex'}`}>
              {/* Theme Toggle */}
              <div className="scale-75 sm:scale-90 md:scale-100">
                <ThemeToggle />
              </div>

              {/* User Button - Solo icono en móvil */}
              <div className="relative" ref={userPanelRef}>
                <button
                  onClick={() => {
                    setShowUserPanel((v) => !v);
                    if (!userInfo && !loadingUser) loadUser();
                  }}
                  className="flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 p-1 sm:p-1.5 md:px-3 md:py-2 rounded-lg border border-white/20 dark:border-gray-700/30 hover:bg-white/60 dark:hover:bg-gray-800/60 hover:shadow-sm transition-all duration-200 backdrop-blur-sm"
                >
                  <div className="w-5 h-5 sm:w-6 md:w-7 sm:h-6 md:h-7 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 text-white flex items-center justify-center shadow-sm overflow-hidden relative">
                    {userInfo?.avatar_url ? (
                      <img src={userInfo.avatar_url} alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
                    ) : (
                      <svg className="w-2.5 h-2.5 sm:w-3 md:w-4 sm:h-3 md:h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 10a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 1114 0H3z" />
                      </svg>
                    )}
                  </div>
                  <span className="hidden md:block text-sm font-medium ml-2">Cuenta</span>
                  <svg className="hidden md:block w-4 h-4 text-gray-400 dark:text-gray-500 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showUserPanel && (
                  <div className="absolute right-0 mt-3 w-72 sm:w-80 bg-white/80 dark:bg-[#0a0f1a]/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-3 z-[9999999] animate-in slide-in-from-top-2 duration-300">
                    {loadingUser ? (
                      <div className="text-center py-4">
                        <div className="animate-spin w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Autenticando…</div>
                      </div>
                    ) : userInfo ? (
                      <div className="space-y-3">
                        {/* Header Glassmórfico */}
                        <div className="flex items-center space-x-3 p-2 rounded-xl bg-gradient-to-br from-gray-100/50 to-white/30 dark:from-gray-800/50 dark:to-gray-900/30 border border-black/5 dark:border-white/5">
                          <div className="relative group w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 overflow-hidden bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex-shrink-0">
                            {userInfo.avatar_url ? (
                               <img src={userInfo.avatar_url} alt={userInfo.name} className="absolute inset-0 w-full h-full object-cover object-center" />
                            ) : (
                               <span className="text-base sm:text-lg font-bold drop-shadow-sm">{userInfo.name.charAt(0).toUpperCase()}</span>
                            )}
                            
                            {/* Hover Overlay for Upload */}
                            <label className="absolute inset-0 bg-black/50 flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity z-10">
                              {isUploadingAvatar ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              )}
                              <input 
                                type="file" 
                                accept="image/jpeg,image/png,image/gif,image/webp" 
                                className="hidden"
                                disabled={isUploadingAvatar}
                                onChange={handleAvatarUpload}
                              />
                            </label>
                          </div>
                          <div className="flex-1 min-w-0 pr-1">
                            <div className="text-sm sm:text-[15px] leading-tight font-semibold text-gray-900 dark:text-white truncate">{userInfo.name}</div>
                            <div className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 truncate mb-0.5">
                              {String(userInfo.role).replace('_',' ').toUpperCase()}
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate leading-none">
                              {userInfo.email}
                            </div>
                          </div>
                        </div>
                        
                        {/* Metadatos */}
                        <div className="px-1 space-y-2.5">
                          {userInfo.role !== 'super_admin' && userInfo.groups?.length > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-500 dark:text-gray-400 font-medium">Grupos</span>
                              <div className="flex flex-wrap gap-1 justify-end">
                                {userInfo.groups.map((group: string, index: number) => (
                                  <span key={index} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-md text-[10px] font-semibold tracking-wide border border-indigo-100 dark:border-indigo-500/20">
                                    {group}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 dark:text-gray-400 font-medium">ID de Sesión</span>
                            <button
                              onClick={() => navigator.clipboard.writeText(userInfo.id)}
                              className="group flex items-center space-x-1.5 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              title="Copiar ID completo"
                            >
                              <span className="text-gray-600 dark:text-gray-300 font-mono text-[10px] opacity-70 group-hover:opacity-100 transition-opacity">
                                {userInfo.id.substring(0, 13)}...
                              </span>
                              <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Botón Logout Apple Style */}
                        <div className="pt-1.5">
                          <button
                            onClick={async () => {
                              await modernLogout();
                              setUserInfo(null);
                              location.href = '/';
                            }}
                            className="w-full px-4 py-2 rounded-xl bg-red-50/50 hover:bg-red-50 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 transition-all duration-300 font-semibold text-xs flex items-center justify-center space-x-2 group"
                          >
                            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Cerrar sesión</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-5">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2.5">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </div>
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-300">Sesión Expirada</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-gray-800/60 transition-all duration-200 flex-shrink-0"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999998] md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Mobile Menu Drawer */}
          <div className="fixed top-14 md:top-16 left-0 right-0 bottom-0 bg-white dark:bg-gray-900 z-[9999999] md:hidden overflow-y-auto animate-in slide-in-from-top-2 duration-300">
            <div className="p-4 space-y-2">
              {menuItems.length > 0 ? (
                menuItems.map((item) => {
                  const isExpanded = expandedMobileItems.has(item.id);
                  
                  return (
                    <div key={item.id} className="border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
                      {item.href === '#' ? (
                        <>
                          <button
                            onClick={() => {
                              if (item.subItems && item.subItems.length > 0) {
                                const newExpanded = new Set(expandedMobileItems);
                                if (newExpanded.has(item.id)) {
                                  newExpanded.delete(item.id);
                                } else {
                                  newExpanded.add(item.id);
                                }
                                setExpandedMobileItems(newExpanded);
                              }
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 text-left rounded-lg transition-all duration-200 ${
                              isParentActive(item)
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <span className="font-medium">{item.label}</span>
                            {item.subItems && item.subItems.length > 0 && (
                              <svg
                                className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </button>
                          {isExpanded && item.subItems && item.subItems.length > 0 && (
                            <div className="mt-2 ml-4 space-y-1">
                              {item.subItems.map((subItem) => (
                                <Link
                                  key={subItem.href}
                                  href={subItem.href}
                                  className={`block px-4 py-2 text-sm rounded-lg transition-all ${
                                    isActive(subItem.href)
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                  }`}
                                  onClick={() => setMobileMenuOpen(false)}
                                >
                                  <div className="flex items-center space-x-2">
                                    {subItem.icon && <span className="flex-shrink-0">{subItem.icon}</span>}
                                    <div className="flex-1">
                                      <div>{subItem.label}</div>
                                      {subItem.description && (
                                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                                          {subItem.description}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <Link
                          href={item.href}
                          className={`block px-4 py-3 rounded-lg transition-all duration-200 ${
                            isActive(item.href)
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {item.label}
                        </Link>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-gray-500 dark:text-gray-400 text-sm px-4 py-3">Cargando menú...</div>
              )}
              
              {/* User Info en móvil */}
              {userInfo && (
                <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="px-4 py-3">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 text-white flex items-center justify-center">
                        <span className="text-sm font-semibold">{userInfo.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {userInfo.name}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{userInfo.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await modernLogout();
                        setUserInfo(null);
                        setMobileMenuOpen(false);
                        location.href = '/';
                      }}
                      className="w-full px-4 py-2 text-sm rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200 font-medium flex items-center justify-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
          {children}
        </div>
      </main>

      {/* ChatWidget para fotografia */}
      {!loadingUser && userInfo && isClient && (
        <>
          <ChatWidget userId={userInfo.id} userRole={userInfo.role} />
          {avatarFileToCrop && (
            <AvatarCropperModal
              imageFile={avatarFileToCrop}
              onClose={() => setAvatarFileToCrop(null)}
              onCropComplete={handleCropComplete}
              isProcessing={isUploadingAvatar}
            />
          )}
        </>
      )}
    </div>
  );
}
