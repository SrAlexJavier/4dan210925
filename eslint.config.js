import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // La capa 3D conduce three.js de forma imperativa: escribe matrices,
    // uniforms y materiales dentro de `useFrame`, que corre fuera del ciclo de
    // render de React a proposito. `immutability` y `refs` describen un modelo
    // que no es el de esta capa, y seguirlos aqui significaria un `setState`
    // por frame, que es justo lo que el plan prohibe.
    files: [
      'src/components/3d/**/*.{ts,tsx}',
      'src/hooks/usePetalInteraction.ts',
      'src/hooks/useLeafInteraction.ts',
      'src/hooks/useStemInteraction.ts',
    ],
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
    },
  },
  {
    // Estos modulos exportan tipos y utilidades junto al componente a
    // proposito; el coste es perder fast-refresh en ellos.
    files: ['src/components/album/AlbumSpread.tsx', 'src/context/ContentContext.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
