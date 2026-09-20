import { ContentProvider } from './context/ContentContext';
import { Stage } from './components/stage/Stage';
import { AlbumPortal } from './components/album/AlbumPortal';

export default function App() {
  return (
    <ContentProvider>
      <Stage />
      {/* Portal a document.body: si el modal queda dentro de un ancestro con
          `filter`, ese ancestro se convierte en bloque contenedor y
          `position: fixed` deja de referirse al viewport. */}
      <AlbumPortal />
    </ContentProvider>
  );
}
