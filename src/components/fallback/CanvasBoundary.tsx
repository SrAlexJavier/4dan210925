import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Una pagina de regalo no se puede quedar en blanco. Si la escena 3D falla
 * —una instancia duplicada de fiber, un shader que no compila, un contexto
 * WebGL que se pierde—, cae al poster estatico igual que si no hubiera WebGL:
 * se pierde fidelidad, no la experiencia.
 */
export class CanvasBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('La escena 3D fallo; se usa el poster estatico.', error, info);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
