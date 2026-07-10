# Yetly v1.2

React + TypeScript + Vite + Tailwind + Radix + TanStack Query + Supabase opcional.

## Desarrollo

```bash
npm install --include=optional
npm run dev
```

## Producción

```bash
npm run typecheck
npm run test
npm run build
npm run preview
```

## Modos

### Local

Default. Sin login. Si no existe workspace, Yetly crea uno vacío automáticamente.

### Supabase

Ve a `Configuración → Conectar mi Supabase`.

Requiere:

- Project URL
- Publishable Key
- ejecutar `supabase/yetly-schema.sql`
- desplegar la función `ollama-proxy` si usarás Yetly AI

No uses Secret Key ni service_role.

### Yetly AI con Ollama Cloud

Ollama Cloud no permite llamadas directas desde GitHub Pages por CORS. Yetly incluye una Edge Function autenticada que reenvía únicamente `tags`, `show` y `chat`; la API key permanece en el navegador y la función no la persiste.

```bash
npx supabase functions deploy ollama-proxy --project-ref TU_PROJECT_REF
```

Después, cada usuario configura su propia API key desde `Configuración → Ollama Cloud`.

## GitHub Pages

El proyecto usa `HashRouter` y `base: "./"`.

Workflow incluido:

`.github/workflows/deploy-pages.yml`
