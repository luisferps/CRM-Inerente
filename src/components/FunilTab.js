import { ETAPAS_FUNIL, ETAPAS_LABEL } from '../constants';

export default function FunilTab({ data, onToggleFunil }) {
  return (
    <div className="kanban-board">
      {ETAPAS_FUNIL.map(etapa => {
        const clientes = data.filter(c => c[etapa]);
        return (
          <div key={etapa} className="kanban-col">
            <div className="kanban-col-header">
              <span className="kanban-col-title">{ETAPAS_LABEL[etapa]}</span>
              <span className="kanban-count">{clientes.length}</span>
            </div>
            <div className="kanban-cards">
              {clientes.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: '12px 0' }}>Vazio</div>
              )}
              {clientes.map(c => (
                <div key={c.id} className="kanban-card">
                  <div className="kanban-card-name">{c.nome}</div>
                  <div className="kanban-card-sub">{c.tipo || '—'} · {c.imovel || '—'}</div>
                  {c.modalidade && (
                    <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, marginTop: 2 }}>{c.modalidade}</div>
                  )}
                  {c.valor && (
                    <div style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginTop: 2 }}>
                      R$ {Number(c.valor).toLocaleString('pt-BR')}
                    </div>
                  )}
                  <div className="kanban-card-etapas">
                    {ETAPAS_FUNIL.map(e => (
                      <div key={e} className="kanban-etapa-dot" title={ETAPAS_LABEL[e]}
                        onClick={() => onToggleFunil(c.id, e, !c[e])}
                        style={{
                          background: c[e] ? '#2563eb' : '#e5e7eb',
                          cursor: 'pointer',
                          border: e === etapa ? '1px solid #1d4ed8' : '1px solid transparent',
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
