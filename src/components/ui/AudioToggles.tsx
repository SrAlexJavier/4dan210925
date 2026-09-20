import { useContent } from '../../context/ContentContext';

/**
 * Dos interruptores independientes. Mezclarlos en uno solo obliga a elegir
 * entre no tener sonido de paginas o tener musica sin pedirla.
 */
export function AudioToggles() {
  const { effectsOn, setEffectsOn, musicOn, setMusicOn, audioAvailable } = useContent();
  if (!audioAvailable) return null;

  return (
    <div className="audio-toggles" data-ui-surface>
      <button
        type="button"
        aria-pressed={effectsOn}
        aria-label={effectsOn ? 'Desactivar los sonidos' : 'Activar los sonidos'}
        title="Sonidos"
        onClick={() => setEffectsOn(!effectsOn)}
      >
        {effectsOn ? '\u266a' : '\u266a\u0338'}
      </button>
      <button
        type="button"
        aria-pressed={musicOn}
        aria-label={musicOn ? 'Quitar la musica' : 'Poner musica'}
        title="Musica"
        onClick={() => setMusicOn(!musicOn)}
      >
        {musicOn ? '\u266b' : '\u25cb'}
      </button>
    </div>
  );
}
