import { cookies } from "next/headers";
import { NextResponse } from "next/server";
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
  name?: string;
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

export function hasRoleAtLeast(
  userRole: keyof typeof ROLE_HIERARCHY,
  minRole: keyof typeof ROLE_HIERARCHY
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

export function setSessionCookie(res: NextResponse, user: SessionUser): void {
  res.cookies.set("aim_session", JSON.stringify(user), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7 // 7 días
  });
}

export function deleteSessionCookie(res: NextResponse): void {
  res.cookies.set("aim_session", "", { path: "/", maxAge: 0 });
}





