import { useEffect, useState } from 'react';
import { useContent } from '../../context/ContentContext';
import { BLOOM_IN } from '../../constants/flowerModel';

/**
 * Tres fuentes de texto: el oraculo al arrancar un petalo, los susurros del
 * disco, y la pista. Manuscrita, porque es una voz y no una etiqueta.
 */
export function FlowerWhisper() {
  const { lastWhisper, hasInteracted, content } = useContent();
  const [hintVisible, setHintVisible] = useState(false);

  // A los 4.5 s, si no ha habido ninguna interaccion. Una vez y no vuelve.
  useEffect(() => {
    if (hasInteracted) return;
    const show = window.setTimeout(() => setHintVisible(true), BLOOM_IN.hint.at);
    const hide = window.setTimeout(
      () => setHintVisible(false),
      BLOOM_IN.hint.at + BLOOM_IN.hint.dur,
    );
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [hasInteracted]);

  if (lastWhisper) {
    return (
      <p key={lastWhisper.id} className="flower-whisper" aria-hidden="true">
        {lastWhisper.text}
      </p>
    );
  }

  if (hintVisible && !hasInteracted) {
    return (
      <p className="flower-whisper flower-whisper--hint" aria-hidden="true">
        {content.flower.hint}
      </p>
    );
  }

  return null;
}
