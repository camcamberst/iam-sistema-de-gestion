import { cookies } from "next/headers";
import { ROLE_HIERARCHY } from "./constants";

export function getSessionToken(): string | null {
  // Placeholder: leer cookie de sesión
  const store = cookies();
  return store.get("aim_session")?.value || null;
}

export function requireAdminRole(): boolean {
  // Placeholder: validar rol desde token/DB
  return true;
}

export type SessionUser = {
  id: string;
  email: string;
  role: keyof typeof ROLE_HIERARCHY;
  groups?: string[];
};

export function getCurrentUser(): SessionUser | null {
  const token = getSessionToken();
  if (!token) return null;
  try {
    const parsed = JSON.parse(token);
    if (!parsed?.id || !parsed?.email || !parsed?.role) return null;
    return parsed as SessionUser;
  } catch {
    return null;
  }
}

export function hasRoleAtLeast(userRole: keyof typeof ROLE_HIERARCHY, minRole: keyof typeof ROLE_HIERARCHY): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}



