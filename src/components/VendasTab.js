import { useState, useMemo } from 'react';
import { ETAPAS_FUNIL_COMPLETO, ETAPAS_LABEL } from '../constants';

function getEtapaAtual(c) {
  for (let i = ETAPAS_FUNIL_COMPLETO.length - 1; i >= 0; i--) {
    if (c[ETAPAS_FUNIL_COMPLETO[i]]) return ETAPAS_FUNIL_COMPLETO[i];
  }
  return null;
}

const ETAPA_COLORS_VENDA = {
  tratativa:    '#93c5fd',
  pesquisa:     '#60a5fa',
  agendamento:  '#3b82f6',
  visita:       '#2563eb',
  proposta:     '#1d4ed8',
  contrato:     '#1e40af',
  financiamento:'#1e3a8a',
  recebimento:  '#172554',
  recebido:     '#16a34a',
};

export default function VendasTab({ data, onOpenModal, onToggleFunil }) {
  const [search, setSearch] = useState('');
  const [filterEtapa, setFilterEtapa] = useState('');
  const [filterCorretor, setFilterCorretor] = useState('');

  const vendas = useMemo(() => data.filter(c => c.modalidade === 'Venda'), [data]);
  const ativas = useMemo(() => vendas.filter(c => c.ativo === 'S'), [vendas]);

  const corretoresUnicos = useMemo(() => [...new Set(vendas.map(c => c.corretor).filter(Boolean))].sort(), [vendas]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return ativas.filter(c =>
      (!q || c.nome.toLowerCase().includes(q) || (c.localizacao || '').toLowerCase().includes(q)) &&
      (!filterEtapa || getEtapaAtual(c) === filterEtapa) &&
      (!filterCorretor || c.corretor === filterCorretor)
    );
  }, [ativas, search, filterEtapa, filterCorretor]);

  // Agrupar por etapa para o kanban
  const porEtapa = useMemo(() => {
    const grupos = {};
    ETAPAS_FUNIL_COMPLETO.forEach(e => { grupos[e] = []; });
    filtered.forEach(c => {
      const etapa = getEtapaAtual(c);
      if (etapa) grupos[etapa].push(c);
    });
    return grupos;
  }, [filtered]);

  const semEtapa = filtered.filter(c => !getEtapaAtual(c));

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          ['🏠 Total Vendas', vendas.length, '#2563eb'],
          ['✅ Ativas', ativas.length, '#059669'],
          ['✍️ Contratos', vendas.filter(c => c.contrato).length, '#7c3aed'],
          ['💰 Recebidos', vendas.filter(c => c.recebido).length, '#d97706'],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 18px', fontSize: 12 }}>
            <span style={{ color: '#9ca3af' }}>{label} </span>
            <span style={{ fontWeight: 700, color, fontSize: 18 }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input placeholder="🔍 Buscar por nome ou localização..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
        <select value={filterEtapa} onChange={e => setFilterEtapa(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, minWidth: 140 }}>
          <option value="">Todas as etapas</option>
          {ETAPAS_FUNIL_COMPLETO.map(e => <option key={e} value={e}>{ETAPAS_LABEL[e]}</option>)}
        </select>
        <select value={filterCorretor} onChange={e => setFilterCorretor(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, minWidth: 140 }}>
          <option value="">Todos corretores</option>
          {corretoresUnicos.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Kanban de vendas */}
      <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, minWidth: 'max-content' }}>
          {ETAPAS_FUNIL_COMPLETO.map(etapa => {
            const clientes = porEtapa[etapa] || [];
            const cor = ETAPA_COLORS_VENDA[etapa];
            return (
              <div key={etapa} style={{ width: 180, flexShrink: 0 }}>
                <div style={{ background: cor, borderRadius: '10px 10px 0 0', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{ETAPAS_LABEL[etapa]}</span>
                  <span style={{ background: 'rgba(255,255,255,0.3)', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{clientes.length}</span>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 10px 10px', minHeight: 250, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {clientes.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#d1d5db', fontSize: 24, marginTop: 30 }}>—</div>
                  )}
                  {clientes.map(c => (
                    <div key={c.id} onClick={() => onOpenModal(c)}
                      style={{ background: '#fff', border: '1px solid #e2e8f0', borderLeft: `3px solid ${cor}`, borderRadius: 7, padding: '8px 10px', cursor: 'pointer', fontSize: 12 }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                      <div style={{ fontWeight: 700, color: '#1a1a2e', marginBottom: 3 }}>{c.nome.split(' ').slice(0,2).join(' ')}</div>
                      <div style={{ color: '#6b7280', fontSize: 11 }}>{c.imovel || '—'}</div>
                      <div style={{ color: '#6b7280', fontSize: 11 }}>{c.localizacao || '—'}</div>
                      {c.valor && <div style={{ color: '#059669', fontWeight: 700, marginTop: 3 }}>R$ {Number(c.valor).toLocaleString('pt-BR')}</div>}
                      <div style={{ color: '#9ca3af', fontSize: 10, marginTop: 3 }}>{c.corretor || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {semEtapa.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sem etapa</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {semEtapa.map(c => (
              <div key={c.id} onClick={() => onOpenModal(c)}
                style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, padding: '6px 12px', fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>
                {c.nome.split(' ').slice(0,2).join(' ')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
