"use client";
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { modernLogin, type AuthUser } from '../../../lib/auth-modern';

export default function LoginPage() {
  // ----------------------------------------------------------------------------------
  // 🛠️ CONFIGURACIÓN MANUAL DEL LUCERO (LA ESTRELLA)
  // Ajuste con subpíxeles (decimales) activo para evitar el pixel-snapping al 100%
  // - "top-[...]" baja la estrella. Valores negativos la suben.
  // - "right-[...]" empuja la estrella hacia la izquierda (adentro de la caja).
  // ----------------------------------------------------------------------------------
  const LUCERO_POS = "top-[3.5px] sm:top-[5.5px] -right-[7.5px] sm:-right-[9.5px]";

  const noiseLvl = "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [entered, setEntered] = useState(false);

  // Precargar el sonido de los acordes de piano
  useEffect(() => {
    audioRef.current = new Audio('/aurora-sound.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  const handleEnter = () => {
    if (!entered) {
      setEntered(true);
      if (audioRef.current) {
        // Retrasamos el audio 1150ms para que golpee exactamente cuando la palabra "Aurora" termina de revelarse y se asienta.
        setTimeout(() => {
          audioRef.current?.play().catch(e => console.warn('Audio play failed:', e));
        }, 1150);
      }
    }
  };

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
    <div className="relative min-h-[100dvh] overflow-hidden flex font-sans selection:bg-indigo-500/30">
      {/* Seamless Yin-Yang Base Background & Rotating Galaxy Canvas */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[#f8fafc]">
        
        {/* Parallax Conic Spiral Background (Slow Reverse Spin) */}
        <div className="absolute top-1/2 left-1/2 w-0 h-0">
          <div 
            className="absolute -top-[150vmax] -left-[150vmax] w-[300vmax] h-[300vmax] animate-spin transform-gpu origin-center"
            style={{ 
              animationDuration: '40s', 
              animationDirection: 'reverse',
              background: 'conic-gradient(from 0deg at 50% 50%, #f8fafc 0%, #dbeafe 30%, #e0e7ff 50%, #e2e8f0 70%, #f8fafc 100%)' 
            }}
          ></div>
        </div>

        {/* Anchor point strictly at exact screen center */}
        <div className="absolute top-1/2 left-1/2 w-0 h-0">
          {/* Colossal Rotating Disk containing ONLY the orbital blobs */}
          <div 
            className="absolute -top-[100vmax] -left-[100vmax] w-[200vmax] h-[200vmax] animate-spin transform-gpu origin-center opacity-90"
            style={{ animationDuration: '30s' }}
          >
            {/* LIGHT HEMISPHERE BLOBS (Aurora Colors infused: Indigo & Cyan) */}
            <div className="absolute top-[30%] left-[25%] w-[45vmax] h-[45vmax] bg-indigo-400/40 rounded-full blur-[160px]"></div>
            <div className="absolute bottom-[30%] left-[25%] w-[40vmax] h-[40vmax] bg-cyan-400/30 rounded-full blur-[160px]"></div>
            
            {/* DARK HEMISPHERE BLOBS (Aurora Colors infused: Fuchsia & Deep Indigo) */}
            <div className="absolute top-[30%] right-[30%] w-[50vmax] h-[50vmax] bg-fuchsia-300/30 rounded-full blur-[160px] animate-pulse" style={{ animationDuration: '8s' }}></div>
            <div className="absolute bottom-[30%] right-[25%] w-[45vmax] h-[45vmax] bg-indigo-400/30 rounded-full blur-[160px]"></div>
          </div>
        </div>

        {/* Global Static Noise Overlay (OLED Matte Texture) */}
        <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none" style={{ backgroundImage: noiseLvl }}></div>
      </div>

      {/* Main Layout Container */}
      <div className="relative z-10 w-full flex min-h-[100dvh] items-center justify-center p-4">

        {/* --- DYNAMIC CARD CONTAINER --- */}
        <div className="w-full max-w-[350px] sm:max-w-[400px] relative">

          {/* BOREAL DARK-MODE CARD (Apple Style Dashboard) */}
          <div className="w-full max-w-[350px] sm:max-w-[400px] bg-[#000000f7] backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-[0_12px_40px_rgba(0,0,0,0.6)] p-6 sm:p-8 relative overflow-hidden group z-10">
            
            {/* Efecto Aurora de Fondo Dinámico (Reactor Boreal) */}
            <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none z-0">
              <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[70%] bg-cyan-500/15 blur-[50px] rounded-full mix-blend-screen animate-aurora-1"></div>
              <div className="absolute top-[10%] -right-[15%] w-[60%] h-[70%] bg-fuchsia-500/15 blur-[60px] rounded-full mix-blend-screen animate-aurora-2"></div>
              <div className="absolute -bottom-[20%] left-[20%] w-[50%] h-[60%] bg-indigo-500/15 blur-[45px] rounded-full mix-blend-screen animate-aurora-3"></div>
            </div>

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
              
              @keyframes lucero-spiral-in {
                0% { transform: scale(0) rotate(-1440deg); opacity: 0; filter: blur(10px) brightness(4); }
                40% { transform: scale(3.5) rotate(-360deg); opacity: 1; filter: blur(2px) brightness(2.5); }
                70% { transform: scale(0.6) rotate(45deg); filter: blur(0px) brightness(1); }
                85% { transform: scale(1.15) rotate(-15deg); }
                100% { transform: scale(1) rotate(0deg); opacity: 1; filter: blur(0px) brightness(1); }
              }

              /* Animations now trigger via the .entered state wrapper */
              .show-login .anim-pop { animation: pop-logo 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
              .show-login .anim-bar { opacity: 0; transform-origin: top; animation: grow-bar 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.4s; }
              .show-login .anim-slide-text { opacity: 0; animation: slide-from-bar 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.9s; }
              .show-login .anim-aurora-glow { background-size: 200% auto; animation: aurora-pan 4s linear infinite, aurora-flare 2.5s ease-out forwards 0.9s; }
              .show-login .anim-spiral-wrap { opacity: 0; animation: lucero-spiral-in 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards 0.9s; }

              /* Gateway Out Animation */
              .gateway-exit {
                opacity: 0;
                transform: scale(1.1) translateY(-5vh);
                filter: blur(15px);
                pointer-events: none;
              }

              
              /* Aurora Boreal internal keyframes */
              @keyframes aurora-1 {
                0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.8; }
                33% { transform: translate(30%, 15%) scale(1.1); opacity: 1; }
                66% { transform: translate(15%, 35%) scale(0.9); opacity: 0.7; }
              }
              @keyframes aurora-2 {
                0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.7; }
                33% { transform: translate(-30%, 20%) scale(0.9); opacity: 0.9; }
                66% { transform: translate(-15%, -15%) scale(1.1); opacity: 0.6; }
              }
              @keyframes aurora-3 {
                0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.9; }
                50% { transform: translate(35%, -30%) scale(1.2); opacity: 0.6; }
              }
              .animate-aurora-1 { animation: aurora-1 12s ease-in-out infinite alternate; }
              .animate-aurora-2 { animation: aurora-2 15s ease-in-out infinite alternate; }
              .animate-aurora-3 { animation: aurora-3 18s ease-in-out infinite alternate; }

              @keyframes aurora-flow {
                0% { background-position: 0% 50%; }
                100% { background-position: 100% 50%; }
              }

              /* Autofill Safari/Chrome reset for dark inputs preserving transparency */
              input:-webkit-autofill,
              input:-webkit-autofill:hover, 
              input:-webkit-autofill:focus, 
              input:-webkit-autofill:active{
                  -webkit-text-fill-color: #d1d5db !important;
                  caret-color: white !important;
                  transition: background-color 5000000s ease-in-out 0s, color 5000000s ease-in-out 0s;
              }
            `}</style>

            <div className={`flex flex-col items-center justify-center mb-10 relative z-10 w-full ${entered ? 'show-login' : ''}`}>
              
              {/* BRAND LOCKUP: AIM | Aurora */}
              <div className="flex items-center justify-center w-full mb-6 relative">
                <div className="flex items-center group cursor-default">
                  
                  {/* Logo Block (IMPOSING & First to Apprear) */}
                  <div className="flex-none w-[4.5rem] h-[4.5rem] bg-gradient-to-b from-[#ffffff] to-[#e2e8f0] rounded-[1.2rem] border border-[#ffffff] flex items-center justify-center z-10 box-border opacity-0 transform scale-75 anim-pop transition-transform duration-300 shadow-[0_0_8px_rgba(255,255,255,0.15),0_10px_20px_-5px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-4px_8px_rgba(148,163,184,0.2)] ring-1 ring-slate-900/5">
                    <span className="text-[#0a0f1a] font-extrabold tracking-wider text-[1.25rem] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">AIM</span>
                  </div>

                  {/* Wrapper conteniendo el separador y la animación de slide del texto */}
                  <div className="flex items-center transition-all duration-700 overflow-visible opacity-100 translate-x-0" style={{ clipPath: "inset(-100% -100% -100% 0%)" }}>
                    
                    {/* Vertical Divider (Grows second) */}
                    <div className="w-[6px] h-[48px] bg-gradient-to-b from-[#ffffff] via-[#f8fafc] to-[#cbd5e1] rounded-full shadow-[0_0_6px_rgba(255,255,255,0.2),0_8px_16px_-4px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(148,163,184,0.5)] ring-1 ring-slate-900/10 ml-4 mr-4 anim-bar"></div>
                    
                    {/* Target Name (Slides from the divider) */}
                    <div className="relative inline-flex items-center pb-1 pr-6 opacity-0 anim-slide-text">
                      {/* Background Glow Text */}
                      <span className="absolute flex items-center text-5xl leading-none font-black tracking-tight select-none pointer-events-none anim-aurora-glow" aria-hidden="true">
                        <span className="relative inline-block">
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-500 to-fuchsia-400 blur-[10px]">Aurora</span>
                          <span className={`absolute ${LUCERO_POS} w-[12px] h-[12px] sm:w-[14px] sm:h-[14px] anim-spiral-wrap blur-[8px] opacity-60`}>
                            <svg className="w-full h-full text-fuchsia-400 animate-lucero" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0Z" />
                            </svg>
                          </span>
                        </span>
                      </span>

                      {/* Foreground Tangible Text */}
                      <span className="relative flex items-center text-5xl leading-none font-black tracking-tight whitespace-nowrap">
                        <span className="relative inline-block" style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.15)) drop-shadow(0 10px 15px rgba(0,0,0,0.8)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>
                          <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#ffffff] via-[#f1f5f9] to-[#cbd5e1]">Aurora</span>
                          <span className={`absolute ${LUCERO_POS} w-[12px] h-[12px] sm:w-[14px] sm:h-[14px] anim-spiral-wrap`}>
                            <svg className="w-full h-full animate-lucero" viewBox="0 0 24 24" fill="url(#login-aurora-gradient-star)">
                              <defs>
                                <linearGradient id="login-aurora-gradient-star" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor="#38bdf8" />    {/* sky-400 */}
                                  <stop offset="50%" stopColor="#6366f1" />   {/* indigo-500 */}
                                  <stop offset="100%" stopColor="#d946ef" />  {/* fuchsia-500 */}
                                </linearGradient>
                              </defs>
                              <path d="M12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0Z" />
                            </svg>
                          </span>
                        </span>
                      </span>
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-6 relative z-10">
              
              {/* Email Input (Mi Calculadora Apple Style) */}
              <div className="relative group/input">
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-[0.4rem] border border-white/10 text-[14px] font-bold text-gray-300 focus:outline-none focus:border-white/30 transition-all shadow-none placeholder-gray-600"
                  placeholder="Correo electrónico"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
                />
              </div>

              {/* Password Input (Mi Calculadora Apple Style) */}
              <div className="relative group/input">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-10 pl-3 pr-10 rounded-[0.4rem] border border-white/10 text-[14px] font-bold text-gray-300 focus:outline-none focus:border-white/30 transition-all shadow-none placeholder-gray-600"
                  placeholder="Contraseña"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
                />
                
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

              {/* Submit Button (Mi Calculadora Aesthetic) */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full relative overflow-hidden min-h-[44px] px-6 py-3 text-[14px] font-extrabold rounded-full transition-all duration-300 transform active:scale-95 whitespace-nowrap touch-manipulation flex items-center justify-center group/submit-btn ${
                  !loading
                    ? 'bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 hover:from-cyan-500/30 hover:to-fuchsia-500/30 text-white border border-cyan-400/30 backdrop-blur-md shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_20px_rgba(232,121,249,0.5)] hover:border-fuchsia-400/50 mt-4'
                    : 'bg-black/20 text-gray-600 cursor-not-allowed border border-white/5 mt-4'
                }`}
              >
                {!loading && (
                  <div className="absolute inset-0 z-0 mix-blend-screen opacity-0 group-hover/submit-btn:opacity-100 transition-opacity duration-300" style={{
                    background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.4), rgba(232,121,249,0.5), transparent)',
                    backgroundSize: '200% 100%',
                    animation: 'aurora-flow 1.5s ease-in-out infinite alternate'
                  }}></div>
                )}
                <span className="relative z-10 flex items-center tracking-widest uppercase drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      INICIANDO...
                    </>
                  ) : 'INICIA SESIÓN'}
                </span>
              </button>


            </form>
          </div>
          
      {/* ===== GATEWAY SCREEN (Pantalla de bienvenida) ===== */}
      <div 
        className={`fixed inset-0 z-[100] flex flex-col items-center justify-center cursor-pointer select-none transition-all duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${entered ? 'gateway-exit' : ''}`}
        style={{ backgroundColor: '#000000' }}
        onClick={handleEnter}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[5%] left-[15%] w-[70vmax] h-[70vmax] transform-gpu mix-blend-screen bg-[radial-gradient(circle_closest-side,rgba(79,70,229,0.08)_0%,rgba(79,70,229,0)_100%)]"></div>
          <div className="absolute bottom-[5%] right-[15%] w-[70vmax] h-[70vmax] transform-gpu mix-blend-screen bg-[radial-gradient(circle_closest-side,rgba(37,99,235,0.07)_0%,rgba(37,99,235,0)_100%)]"></div>
        </div>

        <div className="flex flex-col items-center justify-center z-10 animate-heartbeat-slow group">
          {/* Logo AIM Gateway */}
          <div className="relative flex-none w-[5rem] h-[5rem] bg-gradient-to-b from-[#ffffff] to-[#e2e8f0] rounded-[1.25rem] flex items-center justify-center z-10 shadow-[0_0_25px_rgba(255,255,255,0.3),0_20px_40px_-10px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-4px_8px_rgba(148,163,184,0.2)] border border-[#ffffff] ring-1 ring-slate-900/5 transition-transform duration-300 group-hover:scale-[1.03]">
            <span className="text-slate-900 font-black tracking-widest text-[1.4rem] z-10 select-none drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]" style={{ letterSpacing: '0.15em', marginRight: '-0.15em' }}>
              AIM
            </span>
          </div>

          <p className="mt-8 text-white/50 text-[11px] font-medium tracking-[0.3em] uppercase select-none animate-fade-breathe">
            Toca para continuar
          </p>
        </div>
        </div>
      </div>
    </div>
    </div>
  );
}
