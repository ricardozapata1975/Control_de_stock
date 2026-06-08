import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import ContenedorPanel from '../components/ContenedorPanel';
import ScanResultPanel from '../components/ScanResultPanel';
import { parsedFromCodigoParam } from '../utils/scanMatch';

export default function Contenedor() {
  const { codigo } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.contenedor(codigo));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [codigo]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-muted">Cargando...</p>;
  if (error) {
    return (
      <div className="card text-center">
        <p className="text-red-200">{error}</p>
        <button type="button" className="btn-primary mt-4" onClick={() => navigate('/escanear')}>
          Escanear otro
        </button>
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="btn-secondary mb-4 text-base" onClick={() => navigate('/escanear')}>
        ← Escanear otro
      </button>
      <ScanResultPanel
        parsed={parsedFromCodigoParam(codigo)}
        contenedor={data.contenedor}
        items={data.items}
        onScanAgain={() => navigate('/escanear')}
      />
      <ContenedorPanel data={data} onRefresh={load} />
    </div>
  );
}
