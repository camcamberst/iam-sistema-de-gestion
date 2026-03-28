"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/ui/PageHeader";
import GlassCard from "@/components/ui/GlassCard";

type Role = 'super_admin' | 'admin' | 'modelo' | 'gestor' | 'fotografia' | string;

export default function GestorDashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; name: string; email: string; role: Role; groups: string[] } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) {
          setUser(null);
          setLoading(false);
          return;
        }
        const { data: userRow } = await supabase
          .from('users')
          .select('id,name,email,role')
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
        const current = {
          id: userRow?.id || uid,
          name: userRow?.name || auth.user?.email?.split('@')[0] || 'Usuario',
          email: userRow?.email || auth.user?.email || '',
          role: (userRow?.role as Role) || 'gestor',
          groups,
        };
        setUser(current);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen aim-page-bg flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-t-blue-500 border-r-transparent border-b-purple-500 border-l-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm font-medium tracking-wide">
          Cargando entorno...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen aim-page-bg">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 sm:pt-24 lg:pt-32">
        <PageHeader 
          title="Dashboard Gestor"
          subtitle={user ? `Bienvenido, ${user.name} · Grupos: ${user.groups.join(', ') || 'Ninguno'}` : "Panel de control general"}
          icon={
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />

        {/* Contenido del dashboard */}
        <GlassCard className="p-6 md:p-10">
          <p className="text-gray-600 dark:text-gray-300">
            Panel de Gestor - Las funcionalidades específicas se agregarán próximamente.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}


