"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { modernLogin, type AuthUser } from '../../../lib/auth-modern';

export default function LoginPage() {
  const noiseLvl = "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    let audioCtx: AudioContext | null = null;
    
    // Función para forjar Ruido Blanco puro (La base del viento)
    const createWhiteNoise = (ctx: AudioContext, duration: number) => {
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      return buffer;
    };

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass();
      
      const now = audioCtx.currentTime;
      
      /* --- CAPA ÚNICA: VIENTO SUTIL Y GENTIL --- */
      // Eliminamos por completo la campana estática ("monotono de fondo")
      // Expandimos la ráfaga a algo muy orgánico y difuso para que acompañe toda la escena
      const noiseSource = audioCtx.createBufferSource();
      noiseSource.buffer = createWhiteNoise(audioCtx, 4); 
      
      // Filtro Lowpass abierto ligeramente (sutil y gentil)
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0.5; // Resonancia difusa, sonido de "aire real"

      // El viento aúlla más temprano: la cumbre ("whoosh") es a los 0.8s (anticipando el movimiento 0.9s)
      filter.frequency.setValueAtTime(100, now); 
      filter.frequency.exponentialRampToValueAtTime(900, now + 0.8); 
      filter.frequency.exponentialRampToValueAtTime(150, now + 3.0);
      
      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0, now);
      
      // Arranque Rápido ("Anticipación") - Audible casi instántaneamente
      gainNode.gain.linearRampToValueAtTime(0.15, now + 0.1); 
      // Swell al máximo justo antes del inicio visual (0.9s)
      gainNode.gain.linearRampToValueAtTime(0.4, now + 0.8); 
      // Caída del sonido natural
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 3.0); 
      
      noiseSource.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      noiseSource.start(now); 

    } catch (err) {
      console.log("OS|AIM: Autoplay interactivo no habilitado. Necesita click inicial antes de recargar la página.");
    }

    return () => {
      if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('🔐 [LOGIN] Iniciando autenticación moderna:', { email, password: '***' });
      
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

      switch (user.role) {
        case 'super_admin':
          router.push('/superadmin/dashboard');
          break;
        case 'admin':
          router.push('/admin/dashboard');
          break;
        case 'superadmin_aff':
          router.push('/admin/dashboard');
          break;
        case 'gestor':
          router.push('/gestor/dashboard');
          break;
        case 'fotografia':
          router.push('/fotografia/dashboard');
          break;
        case 'modelo':
          router.push('/admin/model/dashboard');
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
    <div className="relative min-h-screen overflow-hidden flex font-sans selection:bg-indigo-500/30">
      {/* Seamless Yin-Yang Base Background & Rotating Galaxy Canvas */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
        style={{ background: 'linear-gradient(90deg, #fbf9fa 0%, #fbf9fa 35%, #060205 65%, #060205 100%)' }}
      >
        {/* Anchor point strictly at exact screen center */}
        <div className="absolute top-1/2 left-1/2 w-0 h-0">
          
          {/* Colossal Rotating Disk containing ONLY the orbital blobs */}
          <div 
            className="absolute -top-[100vmax] -left-[100vmax] w-[200vmax] h-[200vmax] animate-spin transform-gpu origin-center opacity-90"
            style={{ animationDuration: '90s' }}
          >
            {/* LIGHT HEMISPHERE BLOBS (Day Nebula) */}
            <div className="absolute top-[30%] left-[25%] w-[45vmax] h-[45vmax] bg-fuchsia-300/60 rounded-full blur-[140px]"></div>
            <div className="absolute bottom-[30%] left-[25%] w-[40vmax] h-[40vmax] bg-sky-300/60 rounded-full blur-[140px]"></div>
            
            {/* DARK HEMISPHERE BLOBS (Night Nebula) */}
            <div className="absolute top-[30%] right-[30%] w-[50vmax] h-[50vmax] bg-violet-600/40 rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '6s' }}></div>
            <div className="absolute bottom-[30%] right-[25%] w-[45vmax] h-[45vmax] bg-cyan-700/40 rounded-full blur-[150px]"></div>
          </div>
        </div>

        {/* Global Static Noise Overlay (OLED Matte Texture) */}
        <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none" style={{ backgroundImage: noiseLvl }}></div>
      </div>

      {/* Main Layout Container */}
      <div className="relative z-10 w-full flex min-h-screen items-center justify-center p-4">

        {/* --- DYNAMIC CARD CONTAINER --- */}
        <div className="w-full max-w-md relative">

          {/* Premium Glassmorphism Card */}
          <div className="w-full max-w-md bg-white/70 dark:bg-black/40 backdrop-blur-[40px] border border-white/40 dark:border-white/10 rounded-[2.5rem] shadow-2xl shadow-black/10 p-8 sm:p-10 relative overflow-hidden group z-10">
            
            {/* Subtle Gradient Glow inside the card */}
            <div className="absolute top-0 right-0 -m-20 w-40 h-40 bg-indigo-500/10 blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

            {/* CSS ANIMATION INJECTION (For Cinematic Brand Loading Sequence) */}
            <style>{`
              @keyframes pop-logo { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
              @keyframes grow-bar { 0% { transform: scaleY(0); opacity: 0; } 100% { transform: scaleY(1); opacity: 1; } }
              @keyframes slide-from-bar { 0% { transform: translateX(-40px); opacity: 0; filter: blur(4px); } 100% { transform: translateX(0); opacity: 1; filter: blur(0); } }
              @keyframes aurora-pan { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
              @keyframes aurora-flare { 
                0% { opacity: 1; filter: blur(50px) brightness(3) saturate(4); transform: scale(1.15) translateY(-2px); } 
                20% { opacity: 1; filter: blur(30px) brightness(2) saturate(2.5); transform: scale(1.05) translateY(-1px); } 
                100% { opacity: 0.7; filter: blur(12px) brightness(1) saturate(1); transform: scale(1) translateY(0); } 
              }
              
              .anim-pop { animation: pop-logo 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
              .anim-bar { opacity: 0; transform-origin: top; animation: grow-bar 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.4s; }
              .anim-slide-text { opacity: 0; animation: slide-from-bar 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.9s; }
              .anim-aurora-glow { background-size: 200% auto; animation: aurora-pan 4s linear infinite, aurora-flare 2.5s ease-out forwards 0.9s; }
            `}</style>

            <div className="flex flex-col items-center justify-center mb-10 relative z-10 w-full">
              
              {/* BRAND LOCKUP: AIM | Aurora */}
              <div className="flex flex-row items-center justify-center gap-3 w-full">
                
                {/* Logo Block (IMPOSING & First to Apprear) */}
                <div className="group/logo relative cursor-default shrink-0 anim-pop">
                  <div className="absolute -inset-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-[1.2rem] blur opacity-0 group-hover/logo:opacity-50 transition duration-500"></div>
                  <div className="relative w-16 h-16 bg-black rounded-[1.2rem] flex items-center justify-center shadow-xl border border-white/10 overflow-hidden transform group-hover/logo:scale-105 transition duration-300 ease-out">
                    <span className="text-white font-extrabold tracking-widest text-xl drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]">AIM</span>
                  </div>
                </div>

                {/* Vertical Divider (Grows second) */}
                <div className="h-12 w-1 bg-gray-900 dark:bg-white rounded-full shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.1)] dark:shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all anim-bar"></div>

                {/* Target Name (Slides from the divider) */}
                <div className="relative" style={{ clipPath: "inset(-50% -50% -50% 0%)" }}>
                  <div className="relative anim-slide-text">
                    {/* The Aura (Now Living and Panning) */}
                    <h2 
                      className="absolute inset-0 text-5xl sm:text-[3.5rem] leading-none font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-500 to-fuchsia-400 blur-[12px] opacity-70 mix-blend-multiply dark:mix-blend-screen select-none pointer-events-none anim-aurora-glow"
                      aria-hidden="true"
                    >
                      Aurora
                    </h2>
                    
                    {/* Solid Foreground Text */}
                    <h2 className="relative text-5xl sm:text-[3.5rem] leading-none font-extrabold tracking-tight text-slate-900 dark:text-white transition-all">
                      Aurora
                    </h2>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-6 relative z-10">
              
              {/* Email Floating Input */}
              <div className="relative group/input">
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="peer w-full h-14 px-4 pt-4 pb-1 rounded-2xl border border-black/5 dark:border-white/10 bg-white/50 dark:bg-black/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all shadow-inner placeholder-transparent"
                  placeholder="Correo electrónico"
                />
                <label 
                  htmlFor="email"
                  className="absolute left-4 top-2 text-xs text-gray-500 dark:text-gray-400 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:!top-2 peer-focus:!text-xs peer-focus:text-indigo-600 dark:peer-focus:text-indigo-400 peer-autofill:!top-2 peer-autofill:!text-xs peer-[&:-webkit-autofill]:!top-2 peer-[&:-webkit-autofill]:!text-xs font-medium cursor-text"
                >
                  Correo electrónico
                </label>
              </div>

              {/* Password Floating Input */}
              <div className="relative group/input">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="peer w-full h-14 pl-4 pr-12 pt-4 pb-1 rounded-2xl border border-black/5 dark:border-white/10 bg-white/50 dark:bg-black/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all shadow-inner placeholder-transparent"
                  placeholder="Contraseña"
                />
                <label 
                  htmlFor="password"
                  className="absolute left-4 top-2 text-xs text-gray-500 dark:text-gray-400 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:!top-2 peer-focus:!text-xs peer-focus:text-indigo-600 dark:peer-focus:text-indigo-400 peer-autofill:!top-2 peer-autofill:!text-xs peer-[&:-webkit-autofill]:!top-2 peer-[&:-webkit-autofill]:!text-xs font-medium cursor-text"
                >
                  Contraseña
                </label>
                
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-indigo-500 transition-colors pt-1"
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

              {error && (
                <div className="bg-red-50/80 dark:bg-red-900/30 backdrop-blur border border-red-200 dark:border-red-500/30 rounded-xl p-3 flex items-center shadow-sm animate-in fade-in slide-in-from-bottom-2">
                  <svg className="w-5 h-5 text-red-500 shrink-0 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-600 dark:text-red-400 text-sm font-medium leading-tight">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="group/btn relative w-full h-14 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
              >
                {/* Specular highlight */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
                <div className="relative flex items-center justify-center">
                  {loading ? (
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current opacity-70" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : null}
                  <span>{loading ? 'Iniciando sesión...' : 'Continuar al Sistema'}</span>
                </div>
              </button>

              <div className="flex items-center justify-between text-[13px] font-medium text-gray-500 dark:text-gray-400 pt-2">
                <button
                  type="button"
                  onClick={() => alert('Recuperación de contraseña próximamente')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
                <span className="opacity-80">soporte@aim.com</span>
              </div>
            </form>
          </div>
          
        </div>
      </div>
    </div>
  );
}
