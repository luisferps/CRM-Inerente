import { useState } from 'react';
import { ETAPAS_FUNIL, ETAPAS_LABEL } from '../constants';
import ClienteModal from './ClienteModal';

function getEtapaAtual(c) {
  for (let i = ETAPAS_FUNIL.length - 1; i >= 0; i--) {
    if (c[ETAPAS_FUNIL[i]]) return ETAPAS_FUNIL[i];
  }
  return null;
}

const ETAPA_COLORS = {
  tratativa:    { bg: '#f0f7ff', border: '#c8dff7', dot: '#93c5e8', text: '#4a90b8' },
  pesquisa:     { bg: '#e6f1fc', border: '#b3d0f0', dot: '#6aaedd', text: '#2e7ab5' },
  agendamento:  { bg: '#daeaf9', border: '#9dc0e8', dot: '#4d96d1', text: '#1a6499' },
  visita:       { bg: '#cde3f7', border: '#85aedd', dot: '#2e7fbe', text: '#155085' },
  proposta:     { bg: '#bfd9f4', border: '#6098d0', dot: '#1a6aad', text: '#0d4578' },
  contrato:     { bg: '#b0cff0', border: '#4a87c4', dot: '#0f5799', text: '#073d6e' },
  financiamento:{ bg: '#a0c4ec', border: '#3575b8', dot: '#0a4880', text: '#052e55' },
  recebimento:  { bg: '#f0fdf4', border: '#6ee7b7', dot: '#059669', text: '#065f46' },
};

const ETAPA_ICONS = {
  tratativa: '💬', pesquisa: '🔍', agendamento: '📅', visita: '🏠',
  proposta: '📋', contrato: '✍️', financiamento: '🏦', recebimento: '✅',
};

export default function FunilTab({ data, onSave, onToggleFunil }) {
  const [editando, setEditando] = useState(null);
  const ativos = data.filter(c => c.ativo === 'S');

  const clientesPorEtapa = {};
  ETAPAS_FUNIL.forEach(e => { clientesPorEtapa[e] = []; });
  ativos.forEach(c => {
    const etapa = getEtapaAtual(c);
    if (etapa) clientesPorEtapa[etapa].push(c);
  });

  const semEtapa = ativos.filter(c => getEtapaAtual(c) === null);
  const totalEmAndamento = ativos.filter(c => getEtapaAtual(c) !== null).length;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 18px', fontSize: 12 }}>
          <span style={{ color: '#9ca3af' }}>Em andamento </span>
          <span style={{ fontWeight: 700, color: '#2563eb', fontSize: 18 }}>{totalEmAndamento}</span>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 18px', fontSize: 12 }}>
          <span style={{ color: '#9ca3af' }}>Sem etapa </span>
          <span style={{ fontWeight: 700, color: '#9ca3af', fontSize: 18 }}>{semEtapa.length}</span>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 18px', fontSize: 12 }}>
          <span style={{ color: '#9ca3af' }}>Contratos </span>
          <span style={{ fontWeight: 700, color: '#059669', fontSize: 18 }}>{clientesPorEtapa['contrato']?.length || 0}</span>
        </div>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
        <div style={{ display: 'flex', gap: 0, minWidth: 'max-content' }}>
          {ETAPAS_FUNIL.map((etapa, idx) => {
            const clientes = clientesPorEtapa[etapa] || [];
            const colors = ETAPA_COLORS[etapa] || ETAPA_COLORS.tratativa;
            const isLast = idx === ETAPAS_FUNIL.length - 1;
            return (
              <div key={etapa} style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                <div style={{ width: 180 }}>
                  <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '10px 10px 0 0', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 16 }}>{ETAPA_ICONS[etapa]}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: colors.text }}>{ETAPAS_LABEL[etapa]}</span>
                    </div>
                    <span style={{ background: colors.dot, color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{clientes.length}</span>
                  </div>
                  <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderTop: `2px solid ${colors.dot}`, borderRadius: '0 0 10px 10px', minHeight: 300, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {clientes.length === 0 && (
                      <div style={{ textAlign: 'center', color: '#d1d5db', fontSize: 28, marginTop: 40 }}>—</div>
                    )}
                    {clientes.map(c => (
                      <div key={c.id}
                        onClick={() => setEditando(c)}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.12)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'}
                        style={{ background: '#fff', border: `1px solid ${colors.border}`, borderLeft: `3px solid ${colors.dot}`, borderRadius: 8, padding: '8px 10px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: colors.dot, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                            {c.nome.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.3 }}>
                            {c.nome.split(' ').slice(0, 2).join(' ')}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>{c.tipo || '—'} · {c.imovel || '—'}</div>
                        {c.modalidade && <div style={{ fontSize: 10, color: colors.text, fontWeight: 600, marginBottom: 3 }}>{c.modalidade === 'Venda' ? '🏠' : '🔑'} {c.modalidade}</div>}
                        {c.valor && <div style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>R$ {Number(c.valor).toLocaleString('pt-BR')}</div>}
                        {c.proxima_acao && (
                          <div style={{ marginTop: 5, fontSize: 10, color: '#6b7280', background: '#f9fafb', borderRadius: 4, padding: '3px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            🎯 {c.proxima_acao}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {!isLast && (
                  <div style={{ display: 'flex', alignItems: 'center', paddingTop: 20, color: '#d1d5db', fontSize: 20, margin: '0 -2px' }}>›</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {semEtapa.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Sem etapa definida</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {semEtapa.map(c => (
              <div key={c.id}
                onClick={() => setEditando(c)}
                style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, padding: '6px 12px', fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#9ca3af' }}>
                  {c.nome.charAt(0).toUpperCase()}
                </div>
                {c.nome.split(' ').slice(0, 2).join(' ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {editando && (
        <ClienteModal
          cliente={editando}
          onSave={async (form) => { await onSave(form, editando.id); setEditando(null); }}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}
