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

export default function DetailPanel({ cliente, onEdit, onDelete, onToggleFunil, onClose }) {
  if (!cliente) return null;
  const waLink = whatsappLink(cliente.telefone);
  const template = `Olá ${cliente.nome}, aqui é ${cliente.corretor || 'nosso corretor'}. Tudo bem? Caso tenha interesse em mais informações ou até mesmo agendar uma visita, me coloco à disposição.`;

  return (
    <div className="detail-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div className="panel-name">{cliente.nome}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span className={`badge ${cliente.ativo === 'S' ? 'badge-active' : 'badge-inactive'}`}>
              {cliente.ativo === 'S' ? 'Ativo' : 'Inativo'}
            </span>
            {cliente.modalidade && (
              <span className="badge badge-blue">{cliente.modalidade}</span>
            )}
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
              <a href={`${waLink}?text=${encodeURIComponent(template)}`}
                target="_blank" rel="noreferrer"
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
      {cliente.ativo === 'N' && (
        <Field label="❌ Motivo Desistência" value={cliente.motivo_desistencia} />
      )}

      <div className="panel-section">
        <div className="panel-section-title">Funil de Venda</div>
        {ETAPAS_FUNIL.map(e => (
          <div key={e}
            className={`funil-step ${cliente[e] ? 'done' : ''}`}
            onClick={() => onToggleFunil(cliente.id, e, !cliente[e])}>
            <div className="funil-check">
              {cliente[e] && <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>✓</span>}
            </div>
            <span>{ETAPAS_LABEL[e]}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onEdit(cliente)}>Editar</button>
        <button className="btn btn-danger btn-icon" onClick={() => onDelete(cliente.id)}>🗑</button>
      </div>
    </div>
  );
}
