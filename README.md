# IAM Sistema de Gestión

Plataforma interna de gestión con chat integrado, AIM Botty (asistente IA con Google Gemini), flujos de anticipos, y paneles por rol (modelo, admin, super_admin).

## Documentación principal

- `docs/AIM_BOTTY_IMPLEMENTATION.md` – Implementación y uso de AIM Botty, difusiones y UX del chat.
- `CHANGELOG.md` – Cambios por versión.
- `ARQUITECTURA_SISTEMA_GESTION.md` – Arquitectura general del sistema.

## Requisitos

- Node.js 18+
- Variables de entorno mínimas:
  - `GOOGLE_GEMINI_API_KEY`
  - `NEXT_PUBLIC_APP_URL`
  - Credenciales Supabase

## Scripts comunes

```bash
npm install
npm run dev
npm run build && npm start
```

## Componentes clave

- Chat y AIM Assistant: `components/chat/*`
- APIs de chat: `app/api/chat/*`
- Bot IA (Gemini): `lib/chat/aim-botty.ts`, `lib/chat/process-bot-response.ts`
- Difusiones: `app/api/chat/broadcast/route.ts`, `scripts/create_chat_broadcasts.sql`

## Notas

- Botty se identifica por `AIM_BOTTY_ID` y está excluido de resúmenes de facturación.
- Sonidos de chat deshabilitados; parpadeo de pestaña y apertura automática no intrusiva activados.