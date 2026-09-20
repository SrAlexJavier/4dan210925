# Árbol de componentes

Mapa para localizar dónde vive cada cosa. El orden del árbol es el orden real
de montaje, y la columna de la derecha es el archivo.

## Montaje

```
main.tsx
└── App                                        src/App.tsx
    └── ContentProvider                        src/context/ContentContext.tsx
        ├── Stage                              src/components/stage/Stage.tsx
        │   ├── StageBackground                src/components/stage/StageBackground.tsx
        │   ├── HeaderOverlay                  src/components/ui/HeaderOverlay.tsx
        │   ├── AlbumPanel      (cerrado)      src/components/album/AlbumPanel.tsx
        │   ├── .album-scrim                   (en Stage.tsx)
        │   ├── CanvasBoundary                 src/components/fallback/CanvasBoundary.tsx
        │   │   └── FlowerCanvas               src/components/3d/FlowerCanvas.tsx
        │   │       └── ContentBridge          src/context/ContentContext.tsx
        │   │           ├── SunflowerModel     src/components/3d/SunflowerModel.tsx
        │   │           └── EffectComposer/Bloom
        │   ├── StaticPoster    (sin WebGL)    src/components/fallback/StaticPoster.tsx
        │   ├── FlowerWhisper                  src/components/ui/FlowerWhisper.tsx
        │   ├── A11yMirror                     src/components/ui/A11yMirror.tsx
        │   └── AudioToggles                   src/components/ui/AudioToggles.tsx
        └── AlbumPortal         (abierto)      src/components/album/AlbumPortal.tsx
            └── AlbumBook                      src/components/album/AlbumBook.tsx
                ├── SpreadPages                src/components/album/AlbumSpread.tsx
                └── SpreadFace  (hoja que gira)
```

`AlbumPortal` va por `createPortal(document.body)`: si el modal queda dentro de
un ancestro con `filter`, ese ancestro pasa a ser bloque contenedor y
`position: fixed` deja de referirse al viewport.

`ContentBridge` existe porque `<Canvas>` monta su propio reconciliador y el
contexto de React no cruza esa frontera por sí solo.

## La escena 3D

```
SunflowerModel                      src/components/3d/SunflowerModel.tsx
├── directionalLight  key + target      hijos del grupo de la planta
├── directionalLight  rim + target      sigue al puntero
├── hemisphereLight   fill
├── mesh              sombra de contacto (sprite)
└── group  stemGroupRef ............... base + 12 % del heliotropismo
    ├── Stem                            src/components/3d/Stem.tsx
    ├── Leaf × 3 (2 en móvil)           src/components/3d/Leaf.tsx
    │   └── anchor → petiole → blade    jerarquía del doblado
    ├── FallenPetals  (pool de 8)       src/components/3d/FallenPetals.tsx
    └── group  neckRef ................ 32 % del heliotropismo
        └── group  headRef ............ heliotropismo completo + viento + tirón
            ├── Receptacle              src/components/3d/Receptacle.tsx
            ├── group  discGroupRef
            │   ├── SeedDisc            src/components/3d/SeedDisc.tsx
            │   └── mesh  proxy del disco
            ├── LiguleRingInstanced ×2  src/components/3d/LiguleRingInstanced.tsx
            │                           anillo medio 13 + corona 21
            ├── Ligule × 21             src/components/3d/Ligule.tsx
            │   └── mesh + proxy de colisión
            └── FloatingPollen          src/components/3d/FloatingPollen.tsx
```

La proporción **1 / 0.32 / 0.12** entre cabeza, cuello y tallo es lo que hace
que la planta se vuelva hacia el puntero como un ser vivo: girar solo la
cabeza deja el tallo como un palo clavado.

## Pila de capas (z-index)

| z  | Elemento                    | pointer-events |
|----|-----------------------------|----------------|
| 80 | `.album-anchor` (abierto)   | auto           |
| 70 | Susurro de la flor          | none           |
| 60 | AudioToggles, A11yMirror    | auto           |
| 50 | FlowerCanvas (full-bleed)   | **none**       |
| 30 | AlbumPanel (cerrado)        | auto           |
| 25 | `.album-scrim`              | none           |
| 20 | HeaderOverlay               | none           |
| 10 | Capas de fondo (3)          | none           |

El canvas se pinta **encima** del álbum pero **escucha desde debajo**
(`eventSource` apunta a `.stage`): por eso una hoja puede cruzar por delante
del libro sin dejarlo sin pulsar. El guardia que impide que abrir el álbum
arranque un pétalo está en `usePointerGuard`.

## Hooks

| Hook                   | Qué resuelve                                         |
|------------------------|------------------------------------------------------|
| `useStageFraming`      | Tamaño y posición de la planta según el viewport      |
| `usePetalInteraction`  | Estados de las 21 lígulas, tirón, oráculo             |
| `useLeafInteraction`   | Pecíolo, `uBend`, balanceo en reposo, peso de pétalos |
| `usePointerGuard`      | `isOverAlbum` / `isOverChrome`                        |
| `useIdleTimer`         | Refloración silenciosa a los 22 s                     |
| `usePreloadImages`     | Pliego visible → vecinos → resto                      |
| `useWebGLSupport`      | Decide entre canvas y póster estático                 |
| `useReducedMotion`     | `prefers-reduced-motion`                              |
| `useIsCoarsePointer`   | Puntero táctil                                        |
| `useMediaQuery`        | Base de los tres anteriores                           |

## Datos y constantes

| Archivo                          | Contiene                                            |
|----------------------------------|-----------------------------------------------------|
| `src/data/content.json`          | Única fuente editable: textos y las 9 fotos         |
| `src/types/landing.ts`           | Tipos de ese JSON                                   |
| `src/constants/flowerModel.ts`   | Proporciones, normalizadas a cabeza = 1.0           |
| `src/constants/theme.ts`         | Paleta, luces, cámara, breakpoints                  |
| `src/context/ContentContext.tsx` | Estado compartido: álbum, oráculo, audio            |

## Materiales y geometría

| Archivo                                     | Contiene                                  |
|---------------------------------------------|-------------------------------------------|
| `src/components/3d/geometry.ts`             | Lígula, hoja, tallo, disco, pecíolo       |
| `src/components/3d/petalRig.ts`             | Tipos del pétalo, muelles, easings        |
| `.../materials/backlitPhysical.ts`          | Retroiluminación sin `transmission`       |
| `.../materials/bendChunk.ts`                | Doblado del limbo + barrido de nervadura  |
| `.../materials/veinTexture.ts`              | Tres texturas de canvas, cero red         |
| `src/components/audio/sceneAudio.ts`        | Seis voces sintetizadas + música ambiental|

## Álbum

| Archivo            | Contiene                                        |
|--------------------|-------------------------------------------------|
| `AlbumPanel.tsx`   | El libro cerrado en su columna                  |
| `AlbumPortal.tsx`  | Apertura en tres fases, foco, teclado, swipe    |
| `AlbumBook.tsx`    | El giro de página (Web Animations API)          |
| `AlbumSpread.tsx`  | Reparto por maquetas y caras de la hoja         |
| `Polaroid.tsx`     | Marco, `dominantColor`, adornos                 |
| `spreads/*.tsx`    | Las cinco maquetas                              |

## Scripts

| Archivo                          | Cuándo se ejecuta                  |
|----------------------------------|------------------------------------|
| `scripts/extract-dominant.mjs`   | Solo al cambiar las fotos, a mano  |
