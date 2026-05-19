import { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';

export default function RecebidosTab({ data, onOpenModal, onDevolver }) {
  const [search, setSearch] = useState('');
  const [filterModalidade, setFilterModalidade] = useState('');
  const [filterCorretor, setFilterCorretor] = useState('');

  const recebidos = useMemo(() => data.filter(c => c.recebido && c.ativo === 'S'), [data]);
  const aReceber = useMemo(() => data.filter(c => c.recebimento && !c.recebido && c.ativo === 'S'), [data]);
  const corretoresUnicos = useMemo(() => [...new Set([...recebidos, ...aReceber].map(c => c.corretor).filter(Boolean))].sort(), [recebidos, aReceber]);

  const filtrar = (list) => {
    const q = search.toLowerCase();
    return list.filter(c =>
      (!q || c.nome.toLowerCase().includes(q) || (c.corretor || '').toLowerCase().includes(q)) &&
      (!filterModalidade || c.modalidade === filterModalidade) &&
      (!filterCorretor || c.corretor === filterCorretor)
    );
  };

  const totalRecebido = useMemo(() => recebidos.reduce((s, c) => s + (Number(c.valor) || 0), 0), [recebidos]);
  const totalAReceber = useMemo(() => aReceber.reduce((s, c) => s + (Number(c.valor) || 0), 0), [aReceber]);

  const modColors = { Compra: { bg: '#dcfce7', color: '#065f46' }, Venda: { bg: '#dbeafe', color: '#1d4ed8' }, Locação: { bg: '#ede9fe', color: '#7e22ce' } };

  function Tabela({ list, titulo, corHeader }) {
    const rows = filtrar(list);
    return (
      <div className="dash-section" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="dash-section-title" style={{ margin: 0, color: corHeader }}>{titulo}</div>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{rows.length} item{rows.length !== 1 ? 's' : ''}</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Nome','Modalidade','Imóvel','Valor','Corretor','Localização',''].map(h => (
                <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Nenhum item.</td></tr>}
            {rows.map(c => {
              const mc = modColors[c.modalidade] || { bg: '#f3f4f6', color: '#4b5563' };
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{c.nome}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {c.modalidade ? <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: mc.bg, color: mc.color }}>{c.modalidade}</span> : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#6b7280' }}>{c.imovel || '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#059669', fontWeight: 600 }}>{c.valor ? `R$ ${Number(c.valor).toLocaleString('pt-BR')}` : '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#6b7280' }}>{c.corretor || '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#6b7280' }}>{c.localizacao || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {onOpenModal && <button onClick={() => onOpenModal(c)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Editar</button>}
                      {titulo.includes('Recebidos') && onDevolver && (
                        <button onClick={() => {
                          if (window.confirm(`Devolver "${c.nome}" para Tratativas?`)) onDevolver(c.id);
                        }} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          ↩ Devolver
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>💰 Recebidos</h2>
        <p style={{ fontSize: 13, color: '#6b7280' }}>Controle de recebimentos de comissões.</p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['💰 À Receber', aReceber.length, totalAReceber, '#b45309'],['✅ Recebidos', recebidos.length, totalRecebido, '#059669']].map(([l, count, total, cor]) => (
          <div key={l} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 20px', minWidth: 180 }}>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: cor }}>{count}</div>
            {total > 0 && <div style={{ fontSize: 12, color: cor, fontWeight: 600, marginTop: 2 }}>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)}
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

      <Tabela list={aReceber} titulo="💳 À Receber" corHeader="#b45309" />
      <Tabela list={recebidos} titulo="✅ Já Recebidos" corHeader="#059669" />
    </div>
  );
}
