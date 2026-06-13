import { useState, useMemo } from 'react';
import { ETAPAS_FUNIL_COMPLETO, ETAPAS_LABEL } from '../constants';

function getEtapaAtual(c) {
  for (let i = ETAPAS_FUNIL_COMPLETO.length - 1; i >= 0; i--) {
    if (c[ETAPAS_FUNIL_COMPLETO[i]]) return ETAPAS_FUNIL_COMPLETO[i];
  }
  return null;
}

const CORES = ['#1e40af','#1d4ed8','#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe','#dbeafe','#16a34a'];

export default function VendasTab({ data, onOpenModal }) {
  const [search, setSearch] = useState('');
  const [filterEtapa, setFilterEtapa] = useState('');
  const [filterCorretor, setFilterCorretor] = useState('');

  // Vendas em andamento: ativas e ainda não captadas (a captação encerra a tratativa com sucesso).
  const vendas = useMemo(() => data.filter(c => c.modalidade === 'Venda' && c.ativo === 'S' && !c.captado), [data]);
  // Captados: vendas concluídas por captação (entram no contador, fora da lista principal).
  const captados = useMemo(() => data.filter(c => c.modalidade === 'Venda' && c.captado), [data]);
  const corretoresUnicos = useMemo(() => [...new Set(vendas.map(c => c.corretor).filter(Boolean))].sort(), [vendas]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return vendas.filter(c =>
      (!q || c.nome.toLowerCase().includes(q) || (c.localizacao || '').toLowerCase().includes(q)) &&
      (!filterEtapa || getEtapaAtual(c) === filterEtapa) &&
      (!filterCorretor || c.corretor === filterCorretor)
    );
  }, [vendas, search, filterEtapa, filterCorretor]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['🏠 Total', vendas.length, '#2563eb'],['✍️ Contratos', vendas.filter(c => c.contrato).length, '#7c3aed'],['💰 Recebidos', vendas.filter(c => c.recebido).length, '#059669'],['✅ Captados', captados.length, '#0891b2']].map(([l, v, cor]) => (
          <div key={l} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 18px', fontSize: 12 }}>
            <span style={{ color: '#9ca3af' }}>{l} </span>
            <span style={{ fontWeight: 700, color: cor, fontSize: 18 }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
        <select value={filterEtapa} onChange={e => setFilterEtapa(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }}>
          <option value="">Todas etapas</option>
          {ETAPAS_FUNIL_COMPLETO.map(e => <option key={e} value={e}>{ETAPAS_LABEL[e]}</option>)}
        </select>
        <select value={filterCorretor} onChange={e => setFilterCorretor(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }}>
          <option value="">Todos corretores</option>
          {corretoresUnicos.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="table-wrapper">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Nome','Imóvel','Valor','Localização','Etapa','Corretor','Próxima Ação',''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Nenhuma venda encontrada.</td></tr>}
            {filtered.map((c) => {
              const etapa = getEtapaAtual(c);
              const etapaIdx = etapa ? ETAPAS_FUNIL_COMPLETO.indexOf(etapa) : -1;
              const cor = etapaIdx >= 0 ? CORES[etapaIdx] : '#e5e7eb';
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }} onClick={() => onOpenModal && onOpenModal(c)}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{c.nome}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.imovel || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#059669', fontWeight: 600 }}>{c.valor ? `R$ ${Number(c.valor).toLocaleString('pt-BR')}` : '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.localizacao || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {etapa ? <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: cor + '22', color: cor, border: `1px solid ${cor}44` }}>{ETAPAS_LABEL[etapa]}</span> : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.corretor || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: 12 }}>{c.proxima_acao || '—'}</td>
                  <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                    {onOpenModal && <button onClick={() => onOpenModal(c)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Ver</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {captados.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0891b2', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            ✅ Captados <span style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af' }}>({captados.length})</span>
          </h3>
          <div className="table-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#ecfeff', borderBottom: '1px solid #cffafe' }}>
                  {['Nome','Imóvel','Valor','Localização','Corretor',''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {captados.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }} onClick={() => onOpenModal && onOpenModal(c)}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{c.nome}</td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.imovel || '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#059669', fontWeight: 600 }}>{c.valor ? `R$ ${Number(c.valor).toLocaleString('pt-BR')}` : '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.localizacao || '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.corretor || '—'}</td>
                    <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                      {onOpenModal && <button onClick={() => onOpenModal(c)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Ver</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
