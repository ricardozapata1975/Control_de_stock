import FocusedPage from '../components/FocusedPage';
import StockBulkImport from '../components/StockBulkImport';

export default function ImportarCSV() {
  return (
    <FocusedPage maxWidth="max-w-5xl">
      <h2 className="page-title mb-2">Importar inventario</h2>
      <p className="mb-4 text-muted">También disponible en Editor de Stock → Carga masiva.</p>
      <StockBulkImport />
    </FocusedPage>
  );
}
