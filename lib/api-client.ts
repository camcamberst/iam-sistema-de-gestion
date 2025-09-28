// =====================================================
// 🌐 CLIENTE API CON AUTENTICACIÓN
// =====================================================
// Cliente para hacer requests autenticados a las APIs
// =====================================================

import { supabase } from './supabase';

/**
 * 🔐 Obtener token de autenticación
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error('❌ [API CLIENT] Error obteniendo token:', error);
    return null;
  }
}

/**
 * 🌐 Hacer request autenticado
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();
  
  if (!token) {
    throw new Error('No hay sesión activa');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * 📋 Obtener usuarios
 */
export async function getUsers() {
  const response = await authenticatedFetch('/api/users');
  return response.json();
}

/**
 * 🏢 Obtener grupos
 */
export async function getGroups() {
  const response = await authenticatedFetch('/api/groups');
  return response.json();
}

/**
 * ➕ Crear usuario
 */
export async function createUser(userData: {
  email: string;
  password: string;
  name: string;
  role: string;
  group_ids?: string[];
}) {
  const response = await authenticatedFetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
  return response.json();
}

/**
 * ✏️ Editar usuario
 */
export async function updateUser(userData: {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  group_ids?: string[];
}) {
  const response = await authenticatedFetch('/api/users', {
    method: 'PUT',
    body: JSON.stringify(userData),
  });
  return response.json();
}

/**
 * 🗑️ Eliminar usuario
 */
export async function deleteUser(userId: string) {
  const response = await authenticatedFetch(`/api/users?id=${userId}`, {
    method: 'DELETE',
  });
  return response.json();
}
