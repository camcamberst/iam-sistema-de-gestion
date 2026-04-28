export default function TestBackgrounds() {
  // SVG Noise Texture Premium (Elimina el 'color banding' web para dar look Mate/OLED)
  const noiseLvl = "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#030303] font-sans text-gray-900 dark:text-white pb-20 relative overflow-hidden">
      
      {/* Animaciones CSS de flujos orgánicos (Tipo Aurora) */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float1 {
          0% { transform: translate(0%, 0%) scale(1) rotate(0deg); }
          33% { transform: translate(15%, -15%) scale(1.1) rotate(5deg); }
          66% { transform: translate(-10%, 15%) scale(0.95) rotate(-5deg); }
          100% { transform: translate(0%, 0%) scale(1) rotate(0deg); }
        }
        @keyframes float2 {
          0% { transform: translate(0%, 0%) scale(1) rotate(0deg); }
          33% { transform: translate(-15%, 20%) scale(0.9) rotate(-3deg); }
          66% { transform: translate(15%, -10%) scale(1.05) rotate(3deg); }
          100% { transform: translate(0%, 0%) scale(1) rotate(0deg); }
        }
        @keyframes float3 {
          0% { transform: translate(0%, 0%) scale(1); }
          50% { transform: translate(10%, 20%) scale(1.1); }
          100% { transform: translate(0%, 0%) scale(1); }
        }
        .anim-float-1 { animation: float1 18s ease-in-out infinite; }
        .anim-float-2 { animation: float2 22s ease-in-out infinite; }
        .anim-float-3 { animation: float3 25s ease-in-out infinite; }
      `}} />

      <div className="max-w-7xl mx-auto px-4 py-12 relative z-10">
        <h1 className="text-4xl font-bold text-center mb-4">Fondos V4 (Dinamismo + Calidad)</h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-12">Todas las versiones tienen movimiento orgánico. La textura mate encima evita distracciones y mejora la calidad visual.</p>

        <div className="space-y-16">
          
          {/* Section 1: Admin */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 flex items-center">
              <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center mr-3 text-sm">1</span>
              Administrador (Control Center - Data Flow)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Light variant */}
              <div className="relative h-96 rounded-3xl overflow-hidden shadow-xl border border-blue-900/5 flex flex-col justify-between p-8 bg-[#f4f7fb]">
                {/* Dynamism Layers */}
                <div className="absolute -top-[20%] -left-[10%] w-[120%] h-[120%] bg-blue-200/50 rounded-full mix-blend-multiply filter blur-[100px] anim-float-1"></div>
                <div className="absolute -bottom-[20%] -right-[10%] w-[120%] h-[120%] bg-slate-300/40 rounded-full mix-blend-multiply filter blur-[100px] anim-float-2"></div>
                
                {/* Noise Level */}
                <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none" style={{ backgroundImage: noiseLvl }}></div>

                <div className="relative z-10">
                  <div className="text-gray-900 font-bold text-xl mb-1">Titanium Flow (Claro)</div>
                  <div className="text-gray-600 text-sm font-medium">Líquido de datos fluyendo calmadamente</div>
                </div>
                <div className="w-full h-32 bg-white/60 backdrop-blur-md rounded-2xl shadow-sm p-4 flex items-center justify-center relative z-10">
                  <span className="text-gray-500 font-semibold">Dashboard Card</span>
                </div>
              </div>
              
              {/* Dark variant */}
              <div className="relative h-96 rounded-3xl overflow-hidden shadow-2xl border border-white/5 flex flex-col justify-between p-8 bg-[#040609] group">
                {/* Dynamism Layers */}
                <div className="absolute top-[-30%] left-[-20%] w-[120%] h-[120%] bg-blue-600/15 rounded-full mix-blend-screen filter blur-[120px] anim-float-1"></div>
                <div className="absolute bottom-[-30%] right-[-20%] w-[120%] h-[120%] bg-cyan-600/10 rounded-full mix-blend-screen filter blur-[120px] anim-float-2"></div>
                <div className="absolute top-[10%] left-[20%] w-[100%] h-[100%] bg-emerald-600/10 rounded-full mix-blend-screen filter blur-[120px] anim-float-3"></div>

                {/* Noise Level */}
                <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none" style={{ backgroundImage: noiseLvl }}></div>

                <div className="relative z-10">
                  <div className="text-white font-bold text-xl mb-1">Deep OLED Data (Oscuro)</div>
                  <div className="text-gray-400 text-sm font-medium">Auroras de datos sutiles y constantes</div>
                </div>
                <div className="w-full h-32 bg-[rgba(20,25,35,0.4)] backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 flex items-center justify-center relative z-10">
                  <span className="text-blue-100/70 font-semibold tracking-wide">Glass Holográfico Pro</span>
                </div>
              </div>

            </div>
          </section>

          {/* Section 2: Modelos */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 flex items-center">
              <span className="w-8 h-8 rounded-full bg-fuchsia-500 text-white flex items-center justify-center mr-3 text-sm">2</span>
              Modelos (Inmersión de Usuario - Aurora Flow)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Light variant */}
              <div className="relative h-96 rounded-3xl overflow-hidden shadow-xl border border-fuchsia-900/5 flex flex-col justify-between p-8 bg-[#fdfbfd]">
                {/* Dynamism Layers */}
                <div className="absolute -top-[20%] -left-[10%] w-[120%] h-[120%] bg-fuchsia-200/50 rounded-full mix-blend-multiply filter blur-[100px] anim-float-1"></div>
                <div className="absolute -bottom-[20%] -right-[10%] w-[120%] h-[120%] bg-sky-200/50 rounded-full mix-blend-multiply filter blur-[100px] anim-float-2"></div>
                <div className="absolute top-[10%] left-[10%] w-[100%] h-[100%] bg-rose-100/60 rounded-full mix-blend-multiply filter blur-[100px] anim-float-3"></div>

                {/* Noise Level */}
                <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none" style={{ backgroundImage: noiseLvl }}></div>

                <div className="relative z-10">
                  <div className="text-gray-900 font-bold text-xl mb-1">Pastel Aurora (Claro)</div>
                  <div className="text-gray-600 text-sm font-medium">Tonos cálidos fluyendo lentamente</div>
                </div>
                <div className="w-full h-32 bg-white/40 backdrop-blur-2xl rounded-2xl shadow-lg p-4 flex items-center justify-center relative z-10">
                  <span className="text-gray-600 font-semibold">Soft Glass Card</span>
                </div>
              </div>
              
              {/* Dark variant */}
              <div className="relative h-96 rounded-3xl overflow-hidden shadow-2xl border border-white/5 flex flex-col justify-between p-8 bg-[#080307]">
                {/* Dynamism Layers */}
                <div className="absolute top-[-30%] left-[-20%] w-[120%] h-[120%] bg-fuchsia-600/15 rounded-full mix-blend-screen filter blur-[120px] anim-float-1"></div>
                <div className="absolute bottom-[-30%] right-[-20%] w-[120%] h-[120%] bg-violet-600/20 rounded-full mix-blend-screen filter blur-[120px] anim-float-2"></div>
                <div className="absolute top-[20%] right-[30%] w-[100%] h-[100%] bg-cyan-500/10 rounded-full mix-blend-screen filter blur-[120px] anim-float-3"></div>

                {/* Noise Level */}
                <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay pointer-events-none" style={{ backgroundImage: noiseLvl }}></div>

                <div className="relative z-10">
                  <div className="text-white font-bold text-xl mb-1">Neon Midnight (Oscuro)</div>
                  <div className="text-gray-400 text-sm font-medium">Movimiento fluido espacial OLED</div>
                </div>
                
                <div className="w-full h-32 bg-[rgba(25,15,30,0.4)] backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 flex items-center justify-center relative z-10">
                  <span className="text-fuchsia-100/70 font-semibold tracking-wide">Deep Glass Card</span>
                </div>
              </div>

            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
