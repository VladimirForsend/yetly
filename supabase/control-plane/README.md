# Yetly Control Plane

Este proyecto Supabase central automatiza instalaciones en los proyectos de los dueños de Yetly. No almacena proyectos, tareas, adjuntos ni API keys de Ollama.

## Preparación única

1. Crea un proyecto Supabase dedicado al Control Plane.
2. Ejecuta `schema.sql` en su SQL Editor.
3. En la organización Supabase que controla la integración, crea una OAuth App. Usa como callback:

   `https://CONTROL_PLANE_REF.supabase.co/functions/v1/managed-cloud/oauth/callback`

4. Concede únicamente estos scopes: Organizations Read, Projects Read/Write, Database Write, Auth Write, Secrets Read y Edge Functions Read/Write.
5. Despliega `managed-cloud` con verificación JWT desactivada; el servicio usa `state`, PKCE y tickets de un solo flujo para autenticarse.
6. Configura los secretos:

   - `SUPABASE_OAUTH_CLIENT_ID`
   - `SUPABASE_OAUTH_CLIENT_SECRET`
   - `YETLY_ENCRYPTION_KEY`: 32 bytes aleatorios codificados en base64url.
   - `YETLY_STATE_SECRET`: al menos 32 bytes aleatorios.
   - `YETLY_CONTROL_PLANE_PUBLIC_URL`: URL completa terminada en `/functions/v1/managed-cloud`.
   - `YETLY_ALLOWED_ORIGINS`: URL de GitHub Pages y, opcionalmente, `http://localhost:5173`, separadas por coma.
   - `YETLY_DEFAULT_REGION`: por ejemplo `sa-east-1` para Chile/Latinoamérica.

7. En producción fija también `YETLY_SCHEMA_SHA256` y `YETLY_OLLAMA_PROXY_SHA256`. Los hashes protegen los dos archivos descargados del repositorio antes de instalarlos.
8. Publica el frontend con `VITE_YETLY_MANAGED_CLOUD_URL` apuntando a la misma URL pública.

El flujo manual continúa disponible si la OAuth App todavía no tiene acceso a `database:write` o `edge_functions:write`.

## Diseño operativo

Cada consulta del navegador lleva un ticket opaco guardado solo en `sessionStorage`. Los access/refresh tokens de Supabase se cifran con AES-GCM y nunca salen del Control Plane. Cada consulta de estado ejecuta como máximo una fase del trabajo, por lo que una instalación interrumpida puede continuar sin repetir las fases terminadas.

