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

### Yetly Cloud administrado

Cuando `VITE_YETLY_MANAGED_CLOUD_URL` está configurado, el dueño solo pulsa **Activar Yetly Cloud**, autoriza Supabase y elige crear o usar un proyecto. El Control Plane instala automáticamente el esquema v19, RLS, Realtime, Storage, Auth y `ollama-proxy`.

La preparación única del servicio está en `supabase/control-plane/README.md`. Para GitHub Pages crea la variable de repositorio `YETLY_MANAGED_CLOUD_URL` con la URL de la función `managed-cloud`.

Los datos locales se respaldan antes del OAuth y se copian directamente al proyecto del dueño; no pasan por el Control Plane. La importación conserva el workspace local y puede continuar sin duplicados si se interrumpe.

### Supabase manual (configuración avanzada)

Ve a `Configuración → Conectar mi Supabase`.

Requiere:

- Project URL
- Publishable Key
- ejecutar `supabase/yetly-schema.sql` (esquema v19)
- desplegar la función `ollama-proxy` si usarás Yetly AI

No uses Secret Key ni service_role.

### Yetly AI con Ollama Cloud

Ollama Cloud no permite llamadas directas desde GitHub Pages por CORS. Yetly incluye una Edge Function autenticada que reenvía únicamente `tags`, `show` y `chat`; la API key permanece en el navegador y la función no la persiste.

```bash
npx supabase functions deploy ollama-proxy --project-ref TU_PROJECT_REF
```

Después, cada usuario configura su propia API key desde `Configuración → Ollama Cloud`.

## Acceso y recuperación

Yetly usa Supabase Auth con PKCE para email, recuperación de contraseña y Google. La URL pública exacta de GitHub Pages debe estar configurada como `Site URL` y `Redirect URL` en Supabase. Google requiere además habilitar el provider con su Client ID/Secret y registrar `https://PROJECT_REF.supabase.co/auth/v1/callback` en Google Cloud; Yetly comprueba el estado del provider antes de mostrar el botón.

## GitHub Pages

El proyecto usa `HashRouter` y `base: "./"`.

Workflow incluido:

`.github/workflows/deploy-pages.yml`
