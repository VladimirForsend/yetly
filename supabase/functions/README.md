# Funciones Supabase de Yetly

`ollama-proxy` permite usar Ollama Cloud desde GitHub Pages sin guardar la API key del usuario. La función valida la sesión Supabase, acepta únicamente `tags`, `show` y `chat`, reenvía la petición y no persiste ni registra la clave.

Despliegue:

```bash
npx supabase functions deploy ollama-proxy --project-ref TU_PROJECT_REF
```

No necesita secretos adicionales: Supabase entrega automáticamente `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` dentro de la función.
