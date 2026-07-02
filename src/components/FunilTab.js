import { useState, useRef } from 'react';
import AmpulhetaAprovacao from './AmpulhetaAprovacao';
import { ETAPAS_FUNIL, ETAPAS_LABEL } from '../constants';
import { supabase } from '../supabaseClient';
import BotaoFecharContrato from './BotaoFecharContrato';

function getEtapaAtual(c) {
  for (let i = ETAPAS_FUNIL.length - 1; i >= 0; i--) {
    if (c[ETAPAS_FUNIL[i]]) return ETAPAS_FUNIL[i];
  }
  return null;
}

const CORES_COMPRA = {
  tratativa:    { bg: '#f0fdf4', border: '#bbf7d0', dot: '#4ade80', text: '#15803d' },
  pesquisa:     { bg: '#dcfce7', border: '#86efac', dot: '#22c55e', text: '#16a34a' },
  agendamento:  { bg: '#d1fae5', border: '#6ee7b7', dot: '#10b981', text: '#059669' },
  visita:       { bg: '#a7f3d0', border: '#34d399', dot: '#059669', text: '#047857' },
  proposta:     { bg: '#6ee7b7', border: '#10b981', dot: '#047857', text: '#065f46' },
  contrato:     { bg: '#34d399', border: '#059669', dot: '#065f46', text: '#064e3b' },
  financiamento:{ bg: '#10b981', border: '#047857', dot: '#064e3b', text: '#fff' },
  recebimento:  { bg: '#059669', border: '#065f46', dot: '#064e3b', text: '#fff' },
};

const CORES_LOCACAO = {
  tratativa:    { bg: '#f5f3ff', border: '#ddd6fe', dot: '#c4b5fd', text: '#6d28d9' },
  pesquisa:     { bg: '#ede9fe', border: '#c4b5fd', dot: '#a78bfa', text: '#5b21b6' },
  agendamento:  { bg: '#e0d9fb', border: '#a78bfa', dot: '#7c3aed', text: '#4c1d95' },
  visita:       { bg: '#d4c9f8', border: '#7c3aed', dot: '#6d28d9', text: '#4c1d95' },
  proposta:     { bg: '#c4b5fd', border: '#6d28d9', dot: '#5b21b6', text: '#3b0764' },
  contrato:     { bg: '#a78bfa', border: '#5b21b6', dot: '#4c1d95', text: '#fff' },
  financiamento:{ bg: '#8b5cf6', border: '#4c1d95', dot: '#3b0764', text: '#fff' },
  recebimento:  { bg: '#7c3aed', border: '#3b0764', dot: '#2e1065', text: '#fff' },
};

const ICONS = {
  tratativa: '💬', pesquisa: '🔍', agendamento: '📅', visita: '🏠',
  proposta: '📋', contrato: '✍️', financiamento: '🏦', recebimento: '🕐',
};

// Link de WhatsApp a partir do telefone do cliente (trata DDI 55).
function whatsappLink(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith('55') ? digits : '55' + digits}`;
}

function KanbanFunil({ titulo, data, coresMap, onOpenModal, onMoverCard, podeContrato, perfil, onAplicado }) {
  const ativos = data.filter(c => c.ativo === 'S' && !c.recebido);
  const porEtapa = {};
  ETAPAS_FUNIL.forEach(e => { porEtapa[e] = []; });
  ativos.forEach(c => {
    const e = getEtapaAtual(c);
    if (e) porEtapa[e].push(c);
  });
  const semEtapa = ativos.filter(c => !getEtapaAtual(c));
  const total = ativos.filter(c => getEtapaAtual(c)).length;

  const dragCard = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  async function handleDrop(etapaDestino) {
    if (!dragCard.current) return;
    const card = dragCard.current;
    dragCard.current = null;
    setDragOver(null);
    if (getEtapaAtual(card) === etapaDestino) return;
    const updates = {};
    ETAPAS_FUNIL.forEach(e => { updates[e] = false; });
    const idx = ETAPAS_FUNIL.indexOf(etapaDestino);
    ETAPAS_FUNIL.slice(0, idx + 1).forEach(e => { updates[e] = true; });
    await supabase.from('negociacoes').update(updates).eq('id', card.id);
    if (onMoverCard) onMoverCard(card.id, updates);
  }

  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{titulo}</h3>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 14px', fontSize: 12 }}>
          <span style={{ color: '#9ca3af' }}>Em andamento </span>
          <span style={{ fontWeight: 700, color: '#2563eb', fontSize: 16 }}>{total}</span>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 14px', fontSize: 12 }}>
          <span style={{ color: '#9ca3af' }}>Contratos </span>
          <span style={{ fontWeight: 700, color: '#059669', fontSize: 16 }}>{porEtapa['contrato']?.length || 0}</span>
        </div>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 12 }}>
        <div style={{ display: 'flex', gap: 0, minWidth: 'max-content' }}>
          {ETAPAS_FUNIL.map((etapa, idx) => {
            const clientes = porEtapa[etapa] || [];
            const colors = coresMap[etapa];
            const isDragOver = dragOver === etapa;
            return (
              <div key={etapa} style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ width: 175 }}
                  onDragOver={e => { e.preventDefault(); setDragOver(etapa); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => handleDrop(etapa)}>
                  <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '10px 10px 0 0', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 14 }}>{ICONS[etapa]}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: colors.text }}>{ETAPAS_LABEL[etapa]}</span>
                    </div>
                    <span style={{ background: colors.dot, color: '#fff', borderRadius: 20, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{clientes.length}</span>
                  </div>
                  <div style={{
                    background: isDragOver ? (colors.bg) : colors.bg,
                    border: `${isDragOver ? '2px dashed' : '1px solid'} ${isDragOver ? colors.dot : colors.border}`,
                    borderTop: `2px solid ${colors.dot}`,
                    borderRadius: '0 0 10px 10px', minHeight: 250, padding: 8,
                    display: 'flex', flexDirection: 'column', gap: 6,
                    transition: 'all 0.15s',
                  }}>
                    {clientes.length === 0 && !isDragOver && <div style={{ textAlign: 'center', color: '#d1d5db', fontSize: 24, marginTop: 30 }}>—</div>}
                    {isDragOver && clientes.length === 0 && <div style={{ textAlign: 'center', color: colors.dot, fontSize: 13, marginTop: 30, fontWeight: 600 }}>Soltar aqui</div>}
                    {clientes.map(c => {
                      const wa = whatsappLink(c.telefone);
                      return (
                      <div key={c.id}
                        draggable
                        onDragStart={() => { dragCard.current = c; }}
                        onDragEnd={() => { dragCard.current = null; setDragOver(null); }}
                        onClick={() => onOpenModal && onOpenModal(c)}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.12)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'}
                        style={{ background: '#fff', border: `1px solid ${colors.border}`, borderLeft: `3px solid ${colors.dot}`, borderRadius: 7, padding: '8px 10px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'grab', userSelect: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: colors.dot, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                            {c.nome.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.3, flex: 1 }}>
                            {c.nome.split(' ').slice(0, 2).join(' ')}
                            <AmpulhetaAprovacao clienteId={c.id} perfil={perfil} onAplicado={onAplicado} />
                          </div>
                          {wa && (
                            <a href={wa} target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              title="Abrir no WhatsApp"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 5, background: '#25d366', color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                              💬
                            </a>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>{c.imovel || '—'}</div>
                        {c.valor !== '' && c.valor !== null && c.valor !== undefined && (
                          <div style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>
                            {Number(c.valor) === 0 ? 'Em aberto' : `R$ ${Number(c.valor).toLocaleString('pt-BR')}`}
                          </div>
                        )}
                        {c.proxima_acao && <div style={{ marginTop: 4, fontSize: 10, color: '#6b7280', background: '#f9fafb', borderRadius: 4, padding: '2px 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎯 {c.proxima_acao}</div>}
                        <div style={{ marginTop: 4, fontSize: 9, color: '#d1d5db', textAlign: 'right' }}>⠿ arrastar</div>
                        <BotaoFecharContrato neg={c} podeContrato={podeContrato} variant="card" />
                      </div>
                    );})}
                  </div>
                </div>
                {idx < ETAPAS_FUNIL.length - 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', paddingTop: 18, color: '#d1d5db', fontSize: 18, margin: '0 -1px' }}>›</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {semEtapa.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sem etapa</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {semEtapa.map(c => (
              <div key={c.id} onClick={() => onOpenModal && onOpenModal(c)}
                style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#6b7280', cursor: 'pointer' }}>
                {c.nome.split(' ').slice(0,2).join(' ')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FunilTab({ data, onOpenModal, onMoverCard, abaFunil, onSetAbaFunil, podeContrato, perfil, onReload }) {
  const aba = abaFunil || 'compra';
  const compras = data.filter(c => c.modalidade === 'Compra');
  const locacoes = data.filter(c => c.modalidade === 'Locação');

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[['compra','🛒 Compra', compras.filter(c => c.ativo === 'S').length],['locacao','🔑 Locação', locacoes.filter(c => c.ativo === 'S').length]].map(([key, label, count]) => (
          <button key={key} onClick={() => onSetAbaFunil && onSetAbaFunil(key)}
            style={{ padding: '8px 20px', borderRadius: 8, border: `2px solid ${aba === key ? (key === 'compra' ? '#059669' : '#7c3aed') : '#e5e7eb'}`,
              background: aba === key ? (key === 'compra' ? '#f0fdf4' : '#f5f3ff') : '#fff',
              color: aba === key ? (key === 'compra' ? '#059669' : '#7c3aed') : '#6b7280',
              fontWeight: aba === key ? 700 : 500, fontSize: 14, cursor: 'pointer' }}>
            {label} <span style={{ marginLeft: 6, fontWeight: 700 }}>{count}</span>
          </button>
        ))}
      </div>
      {aba === 'compra' && <KanbanFunil titulo="Funil de Compra" data={compras} coresMap={CORES_COMPRA} onOpenModal={onOpenModal} onMoverCard={onMoverCard} podeContrato={podeContrato} perfil={perfil} onAplicado={onReload} />}
      {aba === 'locacao' && <KanbanFunil titulo="Funil de Locação" data={locacoes} coresMap={CORES_LOCACAO} onOpenModal={onOpenModal} onMoverCard={onMoverCard} podeContrato={podeContrato} perfil={perfil} onAplicado={onReload} />}
    </div>
  );
}
