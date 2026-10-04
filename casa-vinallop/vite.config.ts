import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: el build funciona servido desde cualquier subruta o carpeta estática.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // el motor 3D se carga aparte, solo cuando hay un modelo que mostrar
        manualChunks(id) {
          if (id.includes('preload-helper') || id.includes('commonjsHelpers')) return 'vendor';
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/three/') || id.includes('three-stdlib') || id.includes('troika') || id.includes('@react-three')) return 'motor-3d';
          if (id.includes('/react') || id.includes('/scheduler/') || id.includes('/zustand/') || id.includes('@babel/runtime') || id.includes('use-sync-external-store')) return 'vendor';
          return undefined;
        },
      },
    },
  },
  test: { environment: 'node' },
});
