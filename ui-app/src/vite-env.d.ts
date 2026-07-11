/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_YETLY_SUPABASE_URL?: string;
  readonly VITE_YETLY_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_YETLY_MANAGED_CLOUD_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*?raw" {
  const content: string;
  export default content;
}
