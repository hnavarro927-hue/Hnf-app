import { useCallback, useState } from 'react';
import { ControlCenterAlien } from './control-center/ControlCenterAlien.jsx';

/**
 * App Matrix Core — Centro de control (Modo Alien).
 * Datos: conectar aquí GET /ots + agregados gerenciales reales.
 * Sin modales: el detalle es el panel lateral del layout.
 */
export default function App() {
  const [ots, setOts] = useState([]);

  const onRefresh = useCallback(() => {
    // Integración backend: fetch(resolveApiUrl('/ots'), { headers: { Authorization: ... } })
    //   .then(r => r.json()).then(body => setOts(body.data ?? []));
    setOts((prev) => [...prev]);
  }, []);

  return (
    <ControlCenterAlien
      ots={ots}
      kpis={{
        ingresosMonto: null,
        margenRatio: null,
      }}
      onRefresh={onRefresh}
    />
  );
}
