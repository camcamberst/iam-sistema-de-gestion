"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { modernLogin, type AuthUser } from '../../../lib/auth-modern';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('🔐 [LOGIN] Iniciando autenticación moderna:', { email, password: '***' });
      
      // 🚀 LOGIN MODERNO CON SUPABASE AUTH
      const response = await modernLogin({ email, password });

      if (!response.success) {
        setError(response.error || 'Error al iniciar sesión');
        return;
      }

      if (!response.user) {
        setError('Usuario no encontrado');
        return;
      }

      const user: AuthUser = response.user;
      console.log('✅ [LOGIN] Usuario autenticado exitosamente:', {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        groups: user.groups.length
      });

      // Guardar en localStorage con datos completos
      localStorage.setItem('user', JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization_id: user.organization_id,
        groups: user.groups,
        is_active: user.is_active,
        last_login: user.last_login
      }));

      console.log('🚀 [LOGIN] Redirigiendo según rol:', user.role);

      // Redirigir según el rol con lógica moderna
      switch (user.role) {
        case 'super_admin':
        case 'admin':
          router.push('/admin/dashboard');
          break;
        case 'modelo':
          router.push('/modelo/dashboard');
          break;
        case 'chatter':
          router.push('/chatter/dashboard');
          break;
        default:
          router.push('/admin/dashboard');
      }
    } catch (err) {
      console.error('❌ [LOGIN] Error general:', err);
      setError('Error interno del servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: 'radial-gradient(1200px 800px at 10% -10%, rgba(255,255,255,0.08), transparent), linear-gradient(180deg, rgb(16 18 27), rgb(16 18 27))'
    }}>
      <div className="bg-aim-card border border-aim-border rounded-xl shadow-lg p-8 w-full max-w-md backdrop-blur-glass">
        <h1 className="text-3xl font-bold text-center mb-6 text-white">Iniciar Sesión</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-3 pr-12 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          {error && <p className="text-red-400 text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Iniciando sesión...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

