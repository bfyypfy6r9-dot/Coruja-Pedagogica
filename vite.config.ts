import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Separa bibliotecas grandes em arquivos menores para economizar memória (RAM) no build
            'vendor-react': ['react', 'react-dom'],
            'vendor-utils': ['docxtemplater', 'pizzip', 'docx'],
            'vendor-ui': ['lucide-react', 'motion', '@supabase/supabase-js']
          }
        }
      }
    },
    // ... restante das configurações (resolve, server, etc.) continuam iguais
