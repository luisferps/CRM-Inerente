import { useMemo } from 'react';
import { ETAPAS_FUNIL, ETAPAS_LABEL, DEFAULT_ORIGENS, STORAGE_ORIGENS, getList } from '../constants';

export default function DashboardTab({ data }) {
  const origens = getList(STORAGE_ORIGENS, DEFAULT_ORIGENS);

  const stats = useMemo(() => ({
    total: data.length,
    ativos: data.filter(c => c.ativo === 'S').length,
    compradores: data.filter(c => c.tipo === 'Comprador').length,
    locatarios: data.filter(c => c.tipo === 'Locatário').length,
    contratos: data.filter(c => c.contrato).length,
  }), [data]);

  const funilCounts = useMemo(() => {
    const counts = {};
    ETAPAS_FUNIL.forEach(e => { counts[e] = data.filter(c => c[e]).length; });
    return counts;
  }, [data]);

  const origemCounts = useMemo(() => {
    const counts = {};
    data.forEach(c => { if (c.origem) counts[c.origem] = (counts[c.origem] || 0) + 1; });
    return counts;
  }, [data]);

  const maxFunil = funilCounts[ETAPAS_FUNIL[0]] || 1;

  return (
    <>
      <div className="dash-grid">
        {[
          ['👥', stats.total, 'Total de Clientes', 'stat-blue'],
          ['✅', stats.ativos, 'Ativos', 'stat-green'],
          ['🏠', stats.compradores, 'Compradores', 'stat-blue'],
          ['🔑', stats.locatarios, 'Locatários', 'stat-purple'],
          ['📝', stats.contratos, 'Contratos Fechados', 'stat-green'],
        ].map(([icon, val, label, cls]) => (
          <div key={label} className="dash-card">
            <div className="dash-card-icon">{icon}</div>
            <div className={`dash-card-value ${cls}`}>{val}</div>
            <div className="dash-card-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="dash-section">
        <div className="dash-section-title">Funil de Conversão</div>
        {ETAPAS_FUNIL.map(e => {
          const count = funilCounts[e];
          const pct = Math.round((count / maxFunil) * 100);
          return (
            <div key={e} className="funnel-row">
              <div className="funnel-label">{ETAPAS_LABEL[e]}</div>
              <div className="funnel-bar-wrap">
                <div className="funnel-bar-fill" style={{ width: `${Math.max(count > 0 ? 4 : 0, pct)}%` }}>
                  {count > 0 && <span className="funnel-bar-count">{count}</span>}
                </div>
              </div>
              <div className="funnel-pct">{pct}%</div>
            </div>
          );
        })}
      </div>

      <div className="dash-section">
        <div className="dash-section-title">Clientes por Origem</div>
        <div className="origem-grid">
          {origens.filter(o => origemCounts[o]).map(o => (
            <div key={o} className="origem-item">
              <span className="origem-name">{o}</span>
              <span className="origem-count">{origemCounts[o]}</span>
            </div>
          ))}
          {Object.keys(origemCounts).length === 0 && (
            <span style={{ color: '#9ca3af', fontSize: 13 }}>Sem dados ainda.</span>
          )}
        </div>
      </div>
    </>
  );
}
