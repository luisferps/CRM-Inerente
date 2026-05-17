import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ETAPAS_FUNIL, ETAPAS_LABEL } from '../constants';

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div className="panel-field">
      <div className="panel-field-label">{label}</div>
      <div className="panel-field-value">{value}</div>
    </div>
  );
}

function whatsappLink(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const number = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${number}`;
}

export default function DetailPanel({ cliente, onEdit, onDelete, onToggleFunil, onClose, onNovaNegociacao }) {
  const [historico, setHistorico] = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);

  useEffect(() => {
    if (!cliente?.cliente_real_id) return;
    async function loadHistorico() {
      setLoadingHist(true);
      const { data } = await supabase
        .from('negociacoes')
        .select('*')
        .eq('cliente_id', cliente.cliente_real_id)
        .neq('id', cliente.negociacao_id)
        .order('created_at', { ascending: false });
      setHistorico(data || []);
      setLoadingHist(false);
    }
    loadHistorico();
  }, [cliente?.cliente_real_id, cliente?.negociacao_id]);

  if (!cliente) return null;

  const waLink = whatsappLink(cliente.telefone);
  const template = `Olá ${cliente.nome}, aqui é ${cliente.corretor || 'nosso corretor'}. Tudo bem? Caso tenha interesse em mais informações ou até mesmo agendar uma visita, me coloco à disposição.`;

  function getEtapaAtual(neg) {
    for (let i = ETAPAS_FUNIL.length - 1; i >= 0; i--) {
      if (neg[ETAPAS_FUNIL[i]]) return ETAPAS_LABEL[ETAPAS_FUNIL[i]];
    }
    return '—';
  }

  return (
    <div className="detail-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div className="panel-name">{cliente.nome}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span className={`badge ${cliente.ativo === 'S' ? 'badge-active' : 'badge-inactive'}`}>
              {cliente.ativo === 'S' ? 'Ativo' : 'Inativo'}
            </span>
            {cliente.modalidade && <span className="badge badge-blue">{cliente.modalidade}</span>}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
      </div>

      {cliente.telefone && (
        <div className="panel-field">
          <div className="panel-field-label">📞 Telefone</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            <span className="panel-field-value">{cliente.telefone}</span>
            {waLink && (
              <a href={waLink} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#25d366', color: '#fff', borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                💬 WA
              </a>
            )}
            {waLink && (
              <a href={`${waLink}?text=${encodeURIComponent(template)}`} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#128c7e', color: '#fff', borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                📝 Template
              </a>
            )}
          </div>
        </div>
      )}

      <Field label="📧 Email" value={cliente.email} />
      <Field label="📅 Entrada" value={cliente.entrada} />
      <Field label="🏢 Origem" value={cliente.origem} />
      <Field label="👤 Corretor" value={cliente.corretor} />
      <Field label="🏠 Tipo de Lead" value={cliente.tipo} />
      <Field label="🏗️ Imóvel" value={cliente.imovel} />
      <Field label="💰 Valor" value={cliente.valor ? `R$ ${Number(cliente.valor).toLocaleString('pt-BR')}` : null} />
      <Field label="📍 Localização" value={cliente.localizacao} />
      <Field label="📝 Detalhes" value={cliente.detalhes} />
      <Field label="🎯 Próxima Ação" value={cliente.proxima_acao} />
      <Field label="📆 Último Contato" value={cliente.ultimo_contato} />
      <Field label="📆 Próx. Contato" value={cliente.prox_contato} />
      {cliente.ativo === 'N' && <Field label="❌ Motivo Desistência" value={cliente.motivo_desistencia} />}

      <div className="panel-section">
        <div className="panel-section-title">Funil de Venda</div>
        {ETAPAS_FUNIL.map(e => (
          <div key={e} className={`funil-step ${cliente[e] ? 'done' : ''}`}
            onClick={() => onToggleFunil(cliente.id, e, !cliente[e])}>
            <div className="funil-check">
              {cliente[e] && <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>✓</span>}
            </div>
            <span>{ETAPAS_LABEL[e]}</span>
          </div>
        ))}
      </div>

      {/* Histórico de negociações */}
      {(historico.length > 0 || loadingHist) && (
        <div className="panel-section">
          <div className="panel-section-title">Negociações Anteriores</div>
          {loadingHist ? (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Carregando...</div>
          ) : (
            historico.map(neg => (
              <div key={neg.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, padding: '8px 10px', marginBottom: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{neg.modalidade || '—'} · {neg.imovel || '—'}</span>
                  <span className={`badge ${neg.ativo === 'S' ? 'badge-green' : 'badge-gray'}`} style={{ fontSize: 10 }}>
                    {neg.ativo === 'S' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div style={{ color: '#6b7280' }}>{neg.localizacao || '—'}</div>
                <div style={{ color: '#9ca3af', marginTop: 2 }}>Etapa: {getEtapaAtual(neg)}</div>
                {neg.valor && <div style={{ color: '#059669', fontWeight: 600, marginTop: 2 }}>R$ {Number(neg.valor).toLocaleString('pt-BR')}</div>}
              </div>
            ))
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onEdit(cliente)}>Editar</button>
        <button
          onClick={() => onNovaNegociacao(cliente.cliente_real_id)}
          style={{ flex: 1, padding: '8px', borderRadius: 7, border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Negociação
        </button>
        <button className="btn btn-danger btn-icon" onClick={() => onDelete(cliente.id)}>🗑</button>
      </div>
    </div>
  );
}
