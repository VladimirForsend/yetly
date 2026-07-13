# Funciones Supabase de Yetly

`ollama-proxy` permite usar Ollama Cloud desde GitHub Pages sin guardar la API key del usuario. La función valida la sesión Supabase, acepta únicamente `tags`, `show` y `chat`, reenvía la petición y no persiste ni registra la clave.

Despliegue:

```bash
npx supabase functions deploy ollama-proxy --project-ref TU_PROJECT_REF
```

No necesita secretos adicionales: Supabase entrega automáticamente `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` dentro de la función.

También se puede desplegar sin terminal desde Supabase Dashboard:

1. Abrir el proyecto y entrar en **Edge Functions**.
2. Pulsar **Deploy a new function → Via Editor**.
3. Usar exactamente el nombre `ollama-proxy`.
4. Copiar todo el contenido de `supabase/functions/ollama-proxy/index.ts` y reemplazar el ejemplo del editor.
5. Pulsar **Deploy function** y esperar el mensaje de éxito.

Los colaboradores no repiten este paso: la función se instala una sola vez en el proyecto Supabase del dueño.

## Instalación automática

`managed-cloud` es la función del proyecto central que implementa OAuth con Supabase, crea o selecciona el proyecto del dueño y provisiona esquema v19, Auth, RLS, Storage, Realtime y `ollama-proxy`. Su preparación y secretos están documentados en `supabase/control-plane/README.md`.
