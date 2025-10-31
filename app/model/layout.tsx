"use client";

import { ReactNode, useEffect, useState } from "react";
import { supabase } from '@/lib/supabase';
import ChatWidget from '@/components/chat/ChatWidget';

export default function ModelLayout({ children }: { children: ReactNode }) {
  const [userInfo, setUserInfo] = useState<{
    id: string;
    name: string;
    email: string;
    role: 'super_admin' | 'admin' | 'modelo' | string;
  } | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) {
        setUserInfo(null);
        return;
      }
      const { data: userRow } = await supabase
        .from('users')
        .select('id,name,email,role')
        .eq('id', uid)
        .single();
      setUserInfo({
        id: userRow?.id || uid,
        name: userRow?.name || auth.user?.email?.split('@')[0] || 'Usuario',
        email: userRow?.email || auth.user?.email || '',
        role: (userRow?.role as any) || 'modelo',
      });
    };
    loadUser();
  }, []);

  return (
    <div className="min-h-screen">
      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* ChatWidget para modelos (y otros roles si el usuario tiene permisos) */}
      {isClient && userInfo && (
        <ChatWidget userId={userInfo.id} userRole={userInfo.role} />
      )}
    </div>
  );
}


