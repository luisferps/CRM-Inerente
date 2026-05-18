import { useState, useMemo } from 'react';

export default function RecebidosTab({ data, onOpenModal }) {
  const [search, setSearch] = useState('');
  const [filterModalidade, setFilterModalidade] = useState('');
  const [filterCorretor, setFilterCorretor] = useState('');

  const recebidos = useMemo(() => data.filter(c => c.recebido), [data]);

  const corretoresUnicos = useMemo(() => [...new Set(recebidos.map(c => c.corretor).filter(Boolean))].sort(), [recebidos]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return recebidos.filter(c =>
      (!q || c.nome.toLowerCase().includes(q) || (c.localizacao || '').toLowerCase().includes(q)) &&
      (!filterModalidade || c.modalidade === filterModalidade) &&
      (!filterCorretor || c.corretor === filterCorretor)
    );
  }, [recebidos, search, filterModalidade, filterCorretor]);

  const totalValor = useMemo(() => filtered.reduce((sum, c) => sum + (Number(c.valor) || 0), 0), [filtered]);

  const modColors = { Compra: { bg: '#dcfce7', color: '#065f46' }, Venda: { bg: '#dbeafe', color: '#1d4ed8' }, Locação: { bg: '#ede9fe', color: '#7e22ce' } };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 18px', fontSize: 12 }}>
          <span style={{ color: '#9ca3af' }}>Total recebidos </span>
          <span style={{ fontWeight: 700, color: '#059669', fontSize: 18 }}>{filtered.length}</span>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 18px', fontSize: 12 }}>
          <span style={{ color: '#9ca3af' }}>Valor total </span>
          <span style={{ fontWeight: 700, color: '#059669', fontSize: 18 }}>
            {totalValor > 0 ? `R$ ${totalValor.toLocaleString('pt-BR')}` : '—'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input placeholder="🔍 Buscar por nome ou localização..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
        <select value={filterModalidade} onChange={e => setFilterModalidade(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }}>
          <option value="">Todas modalidades</option>
          <option>Compra</option><option>Venda</option><option>Locação</option>
        </select>
        <select value={filterCorretor} onChange={e => setFilterCorretor(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }}>
          <option value="">Todos corretores</option>
          {corretoresUnicos.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Cliente','Modalidade','Imóvel','Localização','Valor','Corretor','Corretor Original',''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Nenhum recebido encontrado.</td></tr>
            )}
            {filtered.map(c => {
              const mc = modColors[c.modalidade] || { bg: '#f3f4f6', color: '#4b5563' };
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{c.nome}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: mc.bg, color: mc.color }}>{c.modalidade || '—'}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.imovel || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.localizacao || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#059669', fontWeight: 600 }}>{c.valor ? `R$ ${Number(c.valor).toLocaleString('pt-BR')}` : '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.corretor || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 12 }}>{c.corretor_original && c.corretor_original !== c.corretor ? c.corretor_original : '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => onOpenModal(c)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Ver</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
