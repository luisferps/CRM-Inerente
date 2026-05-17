import { useMemo, useState } from 'react';
import { ETAPAS_FUNIL, ETAPAS_LABEL } from '../constants';

const PERIODOS = [
  { label: 'Este mês', value: 'mes' },
  { label: 'Último trimestre', value: 'trimestre' },
  { label: 'Este ano', value: 'ano' },
  { label: 'Tudo', value: 'tudo' },
];

function filtrarPorPeriodo(data, periodo) {
  if (periodo === 'tudo') return data;
  const hoje = new Date();
  const inicio = new Date();
  if (periodo === 'mes') {
    inicio.setDate(1);
    inicio.setHours(0, 0, 0, 0);
  } else if (periodo === 'trimestre') {
    inicio.setMonth(hoje.getMonth() - 2);
    inicio.setDate(1);
    inicio.setHours(0, 0, 0, 0);
  } else if (periodo === 'ano') {
    inicio.setMonth(0);
    inicio.setDate(1);
    inicio.setHours(0, 0, 0, 0);
  }
  return data.filter(c => {
    const dt = new Date(c.created_at);
    return dt >= inicio && dt <= hoje;
  });
}

export default function DashboardTab({ data }) {
  const [periodo, setPeriodo] = useState('mes');

  const filtered = useMemo(() => filtrarPorPeriodo(data, periodo), [data, periodo]);

  const stats = useMemo(() => ({
    total: filtered.length,
    ativos: filtered.filter(c => c.ativo === 'S').length,
    vendas: filtered.filter(c => c.modalidade === 'Venda').length,
    locacoes: filtered.filter(c => c.modalidade === 'Locação').length,
    contratos: filtered.filter(c => c.contrato).length,
  }), [filtered]);

  const funilCounts = useMemo(() => {
    const counts = {};
    ETAPAS_FUNIL.forEach(e => { counts[e] = filtered.filter(c => c[e]).length; });
    return counts;
  }, [filtered]);

  const origemCounts = useMemo(() => {
    const counts = {};
    filtered.forEach(c => { if (c.origem) counts[c.origem] = (counts[c.origem] || 0) + 1; });
    return counts;
  }, [filtered]);

  const modalidadeCounts = useMemo(() => {
    const counts = {};
    filtered.forEach(c => { if (c.modalidade) counts[c.modalidade] = (counts[c.modalidade] || 0) + 1; });
    return counts;
  }, [filtered]);

  const ranking = useMemo(() => {
    const counts = {};
    filtered.forEach(c => {
      if (!c.corretor) return;
      if (!counts[c.corretor]) counts[c.corretor] = { clientes: 0, contratos: 0 };
      counts[c.corretor].clientes += 1;
      if (c.contrato) counts[c.corretor].contratos += 1;
    });
    return Object.entries(counts)
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.contratos - a.contratos || b.clientes - a.clientes);
  }, [filtered]);

  const maxFunil = funilCounts[ETAPAS_FUNIL[0]] || 1;
  const maxRanking = ranking[0]?.clientes || 1;

  const medalhas = ['🥇', '🥈', '🥉'];

  return (
    <>
      {/* Filtro de período */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {PERIODOS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriodo(p.value)}
            style={{
              padding: '7px 18px',
              borderRadius: 20,
              border: periodo === p.value ? '2px solid #2563eb' : '1.5px solid #e5e7eb',
              background: periodo === p.value ? '#2563eb' : 'transparent',
              color: periodo === p.value ? '#fff' : '#6b7280',
              fontWeight: periodo === p.value ? 700 : 400,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {p.label}
          </button>
        ))}
        <span style={{ alignSelf: 'center', fontSize: 12, color: '#9ca3af', marginLeft: 4 }}>
          {filtered.length} cliente{filtered.length !== 1 ? 's' : ''} no período
        </span>
      </div>

      {/* Cards de stats */}
      <div className="dash-grid">
        {[
          ['👥', stats.total, 'Total no Período', 'stat-blue'],
          ['✅', stats.ativos, 'Ativos', 'stat-green'],
          ['🏠', stats.vendas, 'Vendas', 'stat-blue'],
          ['🔑', stats.locacoes, 'Locações', 'stat-purple'],
          ['📝', stats.contratos, 'Contratos Fechados', 'stat-green'],
        ].map(([icon, val, label, cls]) => (
          <div key={label} className="dash-card">
            <div className="dash-card-icon">{icon}</div>
            <div className={`dash-card-value ${cls}`}>{val}</div>
            <div className="dash-card-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Ranking de corretores */}
      {ranking.length > 0 && (
        <div className="dash-section">
          <div className="dash-section-title">🏆 Ranking de Corretores</div>
          {ranking.map((c, i) => (
            <div key={c.nome} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{medalhas[i] || `${i + 1}º`}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{c.nome}</span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {c.clientes} cliente{c.clientes !== 1 ? 's' : ''} · {c.contratos} contrato{c.contratos !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ background: '#e5e7eb', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.round((c.clientes / maxRanking) * 100)}%`,
                    height: '100%',
                    background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#2563eb',
                    borderRadius: 99,
                    transition: 'width 0.4s',
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Funil de conversão */}
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

      {/* Modalidade */}
      <div className="dash-section">
        <div className="dash-section-title">Clientes por Modalidade</div>
        <div className="origem-grid">
          {Object.entries(modalidadeCounts).map(([m, count]) => (
            <div key={m} className="origem-item">
              <span className="origem-name">{m}</span>
              <span className="origem-count">{count}</span>
            </div>
          ))}
          {Object.keys(modalidadeCounts).length === 0 && (
            <span style={{ color: '#9ca3af', fontSize: 13 }}>Sem dados no período.</span>
          )}
        </div>
      </div>

      {/* Origem */}
      <div className="dash-section">
        <div className="dash-section-title">Clientes por Origem</div>
        <div className="origem-grid">
          {Object.entries(origemCounts).map(([o, count]) => (
            <div key={o} className="origem-item">
              <span className="origem-name">{o}</span>
              <span className="origem-count">{count}</span>
            </div>
          ))}
          {Object.keys(origemCounts).length === 0 && (
            <span style={{ color: '#9ca3af', fontSize: 13 }}>Sem dados no período.</span>
          )}
        </div>
      </div>
    </>
  );
}
