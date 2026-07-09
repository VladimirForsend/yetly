import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf("@supabase") >= 0 || id.indexOf("realtime-js") >= 0 || id.indexOf("postgrest-js") >= 0 || id.indexOf("gotrue-js") >= 0) {
            return "supabase";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
