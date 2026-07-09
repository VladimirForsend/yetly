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

No uses Secret Key ni service_role.

## GitHub Pages

El proyecto usa `HashRouter` y `base: "./"`.

Workflow incluido:

`.github/workflows/deploy-pages.yml`
