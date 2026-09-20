import { useContent } from '../../context/ContentContext';
import { REBLOOM } from '../../constants/flowerModel';

/**
 * Los botones ejecutan EXACTAMENTE las mismas funciones que los gestos, sin
 * caminos paralelos que se desincronicen. Estan colocados sobre la parte de
 * la flor que les corresponde, asi que al tabular el anillo de foco aparece
 * donde toca y el recorrido con teclado se ve en pantalla.
 */
export function A11yMirror() {
  const { flowerRef, missingPetals, announcement, rebloom } = useContent();

  return (
    <>
      <div className="a11y-mirror" role="group" aria-label="Girasol interactivo">
        <button
          type="button"
          style={{ left: '27%', top: '30%' }}
          onClick={() => flowerRef.current?.pluckNext()}
        >
          Arrancar un petalo
        </button>
        <button
          type="button"
          style={{ left: '16%', top: '72%' }}
          onClick={() => flowerRef.current?.brushLeaf(0)}
        >
          Acariciar la hoja grande
        </button>
        <button
          type="button"
          style={{ left: '38%', top: '64%' }}
          onClick={() => flowerRef.current?.brushLeaf(1)}
        >
          Acariciar la hoja del lado derecho
        </button>
        <button
          type="button"
          style={{ left: '27%', top: '40%' }}
          onClick={() => flowerRef.current?.touchDisc()}
        >
          Tocar el centro de la flor
        </button>
        {missingPetals >= REBLOOM.missingForButton && (
          <button type="button" style={{ left: '27%', top: '84%' }} onClick={rebloom}>
            Volver a florecer
          </button>
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
