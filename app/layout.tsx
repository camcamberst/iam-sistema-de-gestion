import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeTransition from "@/components/ThemeTransition";
import TokenAutoLogin from "@/components/TokenAutoLogin";
import KeyboardManager from "@/components/KeyboardManager";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "AIM |  Aurora",
  description: "Sistema de gestión de usuarios con roles y grupos - Diseño Apple.com",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '512x512' },
      { url: '/favicon.png', type: 'image/png', sizes: '192x192' },
      { url: '/favicon.png', type: 'image/png', sizes: '64x64' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' }
    ],
    apple: [
      { url: '/favicon.png', type: 'image/png', sizes: '180x180' }
    ]
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                let isDark = false;
                try {
                  if (window.parent && window.parent !== window) {
                    isDark = window.parent.document.documentElement.classList.contains('dark');
                  } else {
                    isDark = localStorage.getItem('theme') === 'dark';
                  }
                } catch (e) {
                  isDark = localStorage.getItem('theme') === 'dark';
                }
                if (isDark) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              })();
            `
          }}
        />
      </head>
      <body className={`${inter.className} min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased group/body overflow-x-hidden`}>
        <TokenAutoLogin />
        <ThemeTransition>
          {children}
        </ThemeTransition>
        <KeyboardManager />
      </body>
    </html>
  );
}

