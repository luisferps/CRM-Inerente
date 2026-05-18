import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ETAPAS_FUNIL_COMPLETO, ETAPAS_LABEL } from '../constants';

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
  return `https://wa.me/${digits.startsWith('55') ? digits : '55' + digits}`;
}

function getEtapaLabel(neg) {
  for (let i = ETAPAS_FUNIL_COMPLETO.length - 1; i >= 0; i--) {
    if (neg[ETAPAS_FUNIL_COMPLETO[i]]) return ETAPAS_LABEL[ETAPAS_FUNIL_COMPLETO[i]];
  }
  return '—';
}

export default function DetailPanel({ cliente, onEdit, onDelete, onToggleFunil, onClose, onNovaNegociacao, podeEditar }) {
  const [historico, setHistorico] = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [corretores, setCorretores] = useState([]);
  const [novoCorretor, setNovoCorretor] = useState('');
  const [transferindo, setTransferindo] = useState(false);

  useEffect(() => {
    if (!cliente?.cliente_real_id) return;
    setLoadingHist(true);
    supabase.from('negociacoes').select('*').eq('cliente_id', cliente.cliente_real_id).neq('id', cliente.negociacao_id).order('created_at', { ascending: false })
      .then(({ data }) => { setHistorico(data || []); setLoadingHist(false); });
  }, [cliente?.cliente_real_id, cliente?.negociacao_id]);

  useEffect(() => {
    if (!transferModal) return;
    supabase.from('perfis').select('id, nome, role, is_gerente, is_corretor').eq('aprovado', true).order('nome')
      .then(({ data }) => setCorretores((data || []).filter(p => p.is_gerente || p.is_corretor)));
  }, [transferModal]);

  async function handleTransferir() {
    if (!novoCorretor) return;
    const c = corretores.find(x => x.id === novoCorretor);
    if (!c) return;
    setTransferindo(true);
    const { error } = await supabase.from('negociacoes').update({ corretor_id: c.id, corretor: c.nome }).eq('id', cliente.negociacao_id);
    if (error) alert('Erro: ' + error.message);
    else { setTransferModal(false); setNovoCorretor(''); window.location.reload(); }
    setTransferindo(false);
  }

  if (!cliente) return null;

  const waLink = whatsappLink(cliente.telefone);
  const template = `Olá ${cliente.nome}, aqui é ${cliente.corretor || 'nosso corretor'}. Tudo bem? Caso tenha interesse em mais informações ou até mesmo agendar uma visita, me coloco à disposição.`;

  return (
    <div className="detail-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div className="panel-name">{cliente.nome}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span className={`badge ${cliente.ativo === 'S' ? 'badge-active' : 'badge-inactive'}`}>{cliente.ativo === 'S' ? 'Ativo' : 'Inativo'}</span>
            {cliente.modalidade && <span className="badge badge-blue">{cliente.modalidade}</span>}
            {cliente.is_corretor && <span className="badge badge-orange">Corretor</span>}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
      </div>

      {cliente.telefone && (
        <div className="panel-field">
          <div className="panel-field-label">📞 Telefone</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            <span className="panel-field-value">{cliente.telefone}</span>
            {waLink && <a href={waLink} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#25d366', color: '#fff', borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>💬 WA</a>}
            {waLink && <a href={`${waLink}?text=${encodeURIComponent(template)}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#128c7e', color: '#fff', borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>📝 Template</a>}
          </div>
        </div>
      )}

      <Field label="📧 Email" value={cliente.email} />
      <Field label="📅 Entrada" value={cliente.entrada} />
      <Field label="🏢 Aquisição" value={cliente.origem} />
      <Field label="👤 Corretor" value={cliente.corretor} />
      {cliente.corretor_original && cliente.corretor_original !== cliente.corretor && (
        <Field label="👤 Corretor Original" value={cliente.corretor_original} />
      )}
      <Field label="🏗️ Imóvel" value={cliente.imovel} />
      <Field label="💰 Valor" value={cliente.valor ? `R$ ${Number(cliente.valor).toLocaleString('pt-BR')}` : null} />
      <Field label="📍 Localização" value={cliente.localizacao} />
      <Field label="🔒 Observações Internas" value={cliente.detalhes} />
      {cliente.detalhes_externos && (
        <div className="panel-field">
          <div className="panel-field-label">🌐 Observações Externas</div>
          <div style={{ marginTop: 4, padding: '8px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
            {cliente.detalhes_externos}
          </div>
        </div>
      )}
      <Field label="🎯 Próxima Ação" value={cliente.proxima_acao} />
      <Field label="📆 Último Contato" value={cliente.ultimo_contato} />
      <Field label="📆 Próx. Contato" value={cliente.prox_contato} />
      {cliente.ativo === 'N' && <Field label="❌ Motivo Desistência" value={cliente.motivo_desistencia} />}

      {cliente.modalidade !== 'Venda' && (
        <div className="panel-section">
          <div className="panel-section-title">Funil</div>
          {ETAPAS_FUNIL_COMPLETO.map(e => (
            <div key={e} className={`funil-step ${cliente[e] ? 'done' : ''}`}
              onClick={() => podeEditar && onToggleFunil(cliente.id, e, !cliente[e])}
              style={{ cursor: podeEditar ? 'pointer' : 'default' }}>
              <div className="funil-check">{cliente[e] && <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>✓</span>}</div>
              <span>{ETAPAS_LABEL[e]}</span>
            </div>
          ))}
        </div>
      )}

      <div className="panel-section">
        <div className="panel-section-title">Histórico de Tratativas {historico.length > 0 && `(${historico.length})`}</div>
        {loadingHist ? <div style={{ fontSize: 12, color: '#9ca3af' }}>Carregando...</div>
          : historico.length === 0 ? <div style={{ fontSize: 12, color: '#9ca3af' }}>Nenhuma tratativa anterior.</div>
          : historico.map(neg => (
            <div key={neg.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, padding: '10px 12px', marginBottom: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>{neg.modalidade || '—'} · {neg.imovel || '—'}</span>
                <span className={`badge ${neg.ativo === 'S' ? 'badge-green' : 'badge-gray'}`} style={{ fontSize: 10 }}>{neg.ativo === 'S' ? 'Ativo' : 'Finalizado'}</span>
              </div>
              <div style={{ color: '#6b7280', marginBottom: 2 }}>{neg.localizacao || '—'}</div>
              <div style={{ color: '#9ca3af' }}>Etapa: {getEtapaLabel(neg)}</div>
              <div style={{ color: '#6b7280', marginTop: 2 }}>Corretor: {neg.corretor || '—'}</div>
              {neg.corretor_original && neg.corretor_original !== neg.corretor && <div style={{ color: '#9ca3af', fontSize: 11 }}>Original: {neg.corretor_original}</div>}
              {neg.valor && <div style={{ color: '#059669', fontWeight: 600, marginTop: 2 }}>R$ {Number(neg.valor).toLocaleString('pt-BR')}</div>}
              {neg.motivo_desistencia && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 2 }}>Motivo: {neg.motivo_desistencia}</div>}
            </div>
          ))
        }
      </div>

      {podeEditar && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onEdit(cliente)}>Editar</button>
          {onNovaNegociacao && (
            <button onClick={() => onNovaNegociacao(cliente.cliente_real_id)}
              style={{ flex: 1, padding: '8px', borderRadius: 7, border: '1px solid #2563eb', background: '#eff6ff', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Tratativa
            </button>
          )}
          <button onClick={() => setTransferModal(true)}
            style={{ flex: 1, padding: '8px', borderRadius: 7, border: '1px solid #f59e0b', background: '#fffbeb', color: '#b45309', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            🔁 Transferir
          </button>
          <button className="btn btn-danger btn-icon" onClick={() => onDelete(cliente.id)}>🗑</button>
        </div>
      )}

      {transferModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🔁 Transferir Tratativa</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              Cliente: <strong>{cliente.nome}</strong><br />
              Corretor atual: <strong>{cliente.corretor || '—'}</strong>
              {cliente.corretor_original && cliente.corretor_original !== cliente.corretor && <><br />Original: <strong>{cliente.corretor_original}</strong></>}
            </div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>Novo Corretor</label>
            <select value={novoCorretor} onChange={e => setNovoCorretor(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, marginBottom: 16 }}>
              <option value="">Selecionar...</option>
              {corretores.map(c => <option key={c.id} value={c.id}>{c.nome} {c.is_gerente ? '(Gerente)' : ''}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setTransferModal(false); setNovoCorretor(''); }}
                style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleTransferir} disabled={!novoCorretor || transferindo}
                style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: !novoCorretor ? 0.6 : 1 }}>
                {transferindo ? 'Transferindo...' : 'Transferir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
