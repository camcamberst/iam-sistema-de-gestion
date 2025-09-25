import Link from "next/link";
import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="aim-sidebar">
        <div className="brand">IAM Sistema de Gestión</div>
        <div className="aim-section-title">Gestión</div>
        <nav className="aim-nav">
          <Link className="aim-link" href="/admin/users">Consultar Usuario</Link>
          <Link className="aim-link" href="/admin/users/create">Crear Usuario</Link>
        </nav>
      </aside>
      <main className="aim-content flex-1">{children}</main>
    </div>
  );
}