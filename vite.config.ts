import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    /**
     * `@react-three/postprocessing` importa `@react-three/fiber` por su
     * cuenta. Sin deduplicar, el pre-bundling de Vite le da una instancia
     * distinta del modulo, su `useThree` no ve el store del <Canvas> y lanza
     * «R3F: Hooks can only be used within the Canvas component!», que revienta
     * todo el arbol. Una sola instancia de cada uno de estos.
     */
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber'],
  },

  optimizeDeps: {
    // Pre-bundlarlos juntos es lo que hace que compartan esa instancia.
    include: [
      'react',
      'react-dom',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      '@react-three/postprocessing',
      'postprocessing',
    ],
  },
})
