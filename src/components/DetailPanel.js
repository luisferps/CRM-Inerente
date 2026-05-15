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

export default function DetailPanel({ cliente, onEdit, onDelete, onToggleFunil, onClose }) {
  if (!cliente) return null;

  return (
    <div className="detail-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div className="panel-name">{cliente.nome}</div>
          <span className={`badge ${cliente.ativo === 'S' ? 'badge-active' : 'badge-inactive'}`}>
            {cliente.ativo === 'S' ? 'Ativo' : 'Inativo'}
          </span>
        </div>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
      </div>

      <Field label="📞 Telefone" value={cliente.telefone} />
      <Field label="📧 Email" value={cliente.email} />
      <Field label="📅 Entrada" value={cliente.entrada} />
      <Field label="🏢 Origem" value={cliente.origem} />
      <Field label="👤 Atendente" value={cliente.atendente} />
      <Field label="🏠 Tipo" value={cliente.tipo} />
      <Field label="🏗️ Imóvel" value={cliente.imovel} />
      <Field label="💰 Valor" value={cliente.valor ? `R$ ${Number(cliente.valor).toLocaleString('pt-BR')}` : null} />
      <Field label="📍 Localização" value={cliente.localizacao} />
      <Field label="📝 Detalhes" value={cliente.detalhes} />
      <Field label="🎯 Próxima Ação" value={cliente.proxima_acao} />
      <Field label="📆 Último Contato" value={cliente.ultimo_contato} />
      <Field label="📆 Próx. Contato" value={cliente.prox_contato} />

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
