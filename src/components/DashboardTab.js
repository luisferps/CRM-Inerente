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
  if (periodo === 'mes') { inicio.setDate(1); inicio.setHours(0,0,0,0); }
  else if (periodo === 'trimestre') { inicio.setMonth(hoje.getMonth()-2); inicio.setDate(1); inicio.setHours(0,0,0,0); }
  else if (periodo === 'ano') { inicio.setMonth(0); inicio.setDate(1); inicio.setHours(0,0,0,0); }
  return data.filter(c => new Date(c.created_at) >= inicio && new Date(c.created_at) <= hoje);
}

function PizzaChart({ dados, titulo }) {
  const total = dados.reduce((s, d) => s + d.valor, 0);
  if (total === 0) return <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 13 }}>Sem dados</div>;
  const cores = ['#2563eb','#059669','#7c3aed','#d97706','#dc2626','#0891b2','#65a30d','#db2777','#ea580c','#0284c7'];
  let angulo = 0;
  const fatias = dados.map((d, i) => {
    const pct = d.valor / total;
    const rad = pct * 2 * Math.PI;
    const x1 = 50 + 40 * Math.cos(angulo);
    const y1 = 50 + 40 * Math.sin(angulo);
    angulo += rad;
    const x2 = 50 + 40 * Math.cos(angulo);
    const y2 = 50 + 40 * Math.sin(angulo);
    const large = pct > 0.5 ? 1 : 0;
    return { ...d, x1, y1, x2, y2, large, cor: cores[i % cores.length], pct };
  });
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#374151' }}>{titulo}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <svg viewBox="0 0 100 100" style={{ width: 120, height: 120, flexShrink: 0 }}>
          {fatias.map((f, i) => (
            <path key={i} d={`M 50 50 L ${f.x1} ${f.y1} A 40 40 0 ${f.large} 1 ${f.x2} ${f.y2} Z`} fill={f.cor} stroke="#fff" strokeWidth="1" />
          ))}
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {fatias.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: f.cor, flexShrink: 0 }} />
              <span style={{ color: '#374151' }}>{f.label}</span>
              <span style={{ fontWeight: 700, color: '#1a1a2e' }}>{f.valor}</span>
              <span style={{ color: '#9ca3af' }}>({Math.round(f.pct * 100)}%)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GraficoEvolucao({ data }) {
  // Agrupa todas as tratativas por mês, independente do filtro de período
  const dadosMeses = useMemo(() => {
    const porMes = {};
    data.forEach(c => {
      if (!c.created_at) return;
      const d = new Date(c.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      if (!porMes[key]) porMes[key] = { mes: label, total: 0, compras: 0, locacoes: 0 };
      porMes[key].total += 1;
      if (c.modalidade === 'Compra') porMes[key].compras += 1;
      if (c.modalidade === 'Locação') porMes[key].locacoes += 1;
    });
    return Object.entries(porMes).sort(([a],[b]) => a.localeCompare(b)).slice(-12).map(([,v]) => v);
  }, [data]);

  if (dadosMeses.length < 2) return null;

  const maxVal = Math.max(...dadosMeses.map(d => d.total), 1);
  const W = 520, H = 160, padL = 28, padB = 28, padT = 10, padR = 10;
  const w = W - padL - padR;
  const h = H - padB - padT;
  const x = i => padL + (i / (dadosMeses.length - 1)) * w;
  const y = v => padT + h - (v / maxVal) * h;
  const pontos = dadosMeses.map((d, i) => `${x(i)},${y(d.total)}`).join(' ');
  const area = `${padL},${padT+h} ${pontos} ${x(dadosMeses.length-1)},${padT+h}`;

  return (
    <div className="dash-section" style={{ marginBottom: 16 }}>
      <div className="dash-section-title">📈 Tratativas Novas por Mês</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
        {[0,0.25,0.5,0.75,1].map(p => (
          <line key={p} x1={padL} y1={padT+h*(1-p)} x2={W-padR} y2={padT+h*(1-p)} stroke="#f3f4f6" strokeWidth="1" />
        ))}
        <polygon points={area} fill="#2563eb" opacity="0.08" />
        <polyline points={pontos} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />
        {dadosMeses.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.total)} r="4" fill="#2563eb" stroke="#fff" strokeWidth="2" />
            {d.total > 0 && <text x={x(i)} y={y(d.total)-8} textAnchor="middle" fontSize="10" fill="#2563eb" fontWeight="700">{d.total}</text>}
            <text x={x(i)} y={H-8} textAnchor="middle" fontSize="9" fill="#9ca3af">{d.mes}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function DashboardTab({ data }) {
  const [periodo, setPeriodo] = useState('mes');
  const filtered = useMemo(() => filtrarPorPeriodo(data, periodo), [data, periodo]);

  const stats = useMemo(() => ({
    total: filtered.length,
    ativos: filtered.filter(c => c.ativo === 'S').length,
    compras: filtered.filter(c => c.modalidade === 'Compra').length,
    locacoes: filtered.filter(c => c.modalidade === 'Locação').length,
    vendas: filtered.filter(c => c.modalidade === 'Venda').length,
    contratos: filtered.filter(c => c.contrato).length,
  }), [filtered]);

  const funilCounts = useMemo(() => {
    const counts = {};
    ETAPAS_FUNIL.forEach(e => { counts[e] = filtered.filter(c => c[e] && c.modalidade !== 'Venda').length; });
    return counts;
  }, [filtered]);

  const dadosModalidade = useMemo(() => [
    { label: 'Compra', valor: stats.compras },
    { label: 'Locação', valor: stats.locacoes },
    { label: 'Venda', valor: stats.vendas },
  ].filter(d => d.valor > 0), [stats]);

  const dadosOrigem = useMemo(() => {
    const counts = {};
    filtered.forEach(c => { if (c.origem) counts[c.origem] = (counts[c.origem] || 0) + 1; });
    return Object.entries(counts).map(([label, valor]) => ({ label, valor })).sort((a,b) => b.valor - a.valor).slice(0, 8);
  }, [filtered]);

  const ranking = useMemo(() => {
    const counts = {};
    filtered.forEach(c => {
      if (!c.corretor) return;
      if (!counts[c.corretor]) counts[c.corretor] = { tratativas: 0, contratos: 0 };
      counts[c.corretor].tratativas += 1;
      if (c.contrato) counts[c.corretor].contratos += 1;
    });
    return Object.entries(counts).map(([nome, v]) => ({ nome, ...v })).sort((a,b) => b.contratos - a.contratos || b.tratativas - a.tratativas);
  }, [filtered]);

  const maxFunil = Math.max(...Object.values(funilCounts), 1);
  const maxRanking = ranking[0]?.tratativas || 1;
  const medalhas = ['🥇','🥈','🥉'];

  return (
    <>
      {/* Filtro de período */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {PERIODOS.map(p => (
          <button key={p.value} onClick={() => setPeriodo(p.value)}
            style={{ padding: '7px 18px', borderRadius: 20, border: periodo === p.value ? '2px solid #2563eb' : '1.5px solid #e5e7eb',
              background: periodo === p.value ? '#2563eb' : 'transparent',
              color: periodo === p.value ? '#fff' : '#6b7280',
              fontWeight: periodo === p.value ? 700 : 400, fontSize: 13, cursor: 'pointer' }}>
            {p.label}
          </button>
        ))}
        <span style={{ alignSelf: 'center', fontSize: 12, color: '#9ca3af', marginLeft: 4 }}>
          {filtered.length} tratativa{filtered.length !== 1 ? 's' : ''} no período
        </span>
      </div>

      {/* Cards */}
      <div className="dash-grid">
        {[
          ['🤝', stats.total, 'Total de Tratativas', 'stat-blue'],
          ['✅', stats.ativos, 'Ativas', 'stat-green'],
          ['🛒', stats.compras, 'Compras', 'stat-blue'],
          ['🔑', stats.locacoes, 'Locações', 'stat-purple'],
          ['🏠', stats.vendas, 'Vendas', 'stat-orange'],
          ['📝', stats.contratos, 'Contratos', 'stat-green'],
        ].map(([icon, val, label, cls]) => (
          <div key={label} className="dash-card">
            <div className="dash-card-icon">{icon}</div>
            <div className={`dash-card-value ${cls}`}>{val}</div>
            <div className="dash-card-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Gráfico de evolução mensal */}
      <GraficoEvolucao data={data} />

      {/* Gráficos de pizza */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="dash-section">
          <PizzaChart dados={dadosModalidade} titulo="Tratativas por Modalidade" />
        </div>
        <div className="dash-section">
          <PizzaChart dados={dadosOrigem} titulo="Tratativas por Aquisição" />
        </div>
      </div>

      {/* Ranking */}
      {ranking.length > 0 && (
        <div className="dash-section">
          <div className="dash-section-title">🏆 Ranking de Corretores</div>
          {ranking.map((c, i) => (
            <div key={c.nome} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{medalhas[i] || `${i+1}º`}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{c.nome}</span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{c.tratativas} tratativa{c.tratativas !== 1 ? 's' : ''} · {c.contratos} contrato{c.contratos !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ background: '#e5e7eb', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((c.tratativas / maxRanking) * 100)}%`, height: '100%', background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#2563eb', borderRadius: 99, transition: 'width 0.4s' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Funil (Compra + Locação) */}
      <div className="dash-section">
        <div className="dash-section-title">Funil de Conversão (Compra + Locação)</div>
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
    </>
  );
}
