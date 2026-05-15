import { useState, useMemo } from 'react';
import { ORIGENS, TIPOS, ETAPAS_FUNIL, ETAPAS_LABEL } from '../constants';
import DetailPanel from './DetailPanel';
import ClienteModal from './ClienteModal';

function getEtapaAtual(c) {
  for (let i = ETAPAS_FUNIL.length - 1; i >= 0; i--) {
    if (c[ETAPAS_FUNIL[i]]) return ETAPAS_FUNIL[i];
  }
  return null;
}

function getProgress(c) {
  const idx = ETAPAS_FUNIL.map((e, i) => c[e] ? i : -1).filter(i => i >= 0);
  if (!idx.length) return 0;
  return ((Math.max(...idx) + 1) / ETAPAS_FUNIL.length) * 100;
}

function tipoBadge(tipo) {
  const map = { Comprador: 'badge-blue', Locatário: 'badge-purple', Corretor: 'badge-orange', Investidor: 'badge-green' };
  return map[tipo] || 'badge-gray';
}

export default function CRMTab({ data, onSave, onDelete, onToggleFunil }) {
  const [search, setSearch] = useState('');
  const [filterOrigem, setFilterOrigem] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null); // null | 'new' | cliente object
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(c =>
      (!q || c.nome.toLowerCase().includes(q) || (c.telefone || '').includes(q) || (c.email || '').toLowerCase().includes(q)) &&
      (!filterOrigem || c.origem === filterOrigem) &&
      (!filterTipo || c.tipo === filterTipo)
    );
  }, [data, search, filterOrigem, filterTipo]);

  const selected = data.find(c => c.id === selectedId) || null;

  async function handleSave(form) {
    await onSave(form, modal !== 'new' ? modal?.id : null);
    setModal(null);
  }

  async function handleDelete(id) {
    await onDelete(id);
    setConfirmDelete(null);
    setSelectedId(null);
  }

  return (
    <>
      <div className="toolbar">
        <input className="input-search" placeholder="🔍  Buscar por nome, telefone ou email..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input-sm" value={filterOrigem} onChange={e => setFilterOrigem(e.target.value)}>
          <option value="">Todas origens</option>
          {ORIGENS.map(o => <option key={o}>{o}</option>)}
        </select>
        <select className="input-sm" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
          <option value="">Todos tipos</option>
          {TIPOS.map(t => <option key={t}>{t}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => setModal('new')}>+ Novo Cliente</button>
      </div>

      <div className="layout-with-panel">
        <div className="panel-main">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Tipo</th>
                  <th>Imóvel</th>
                  <th>Valor</th>
                  <th>Origem</th>
                  <th>Funil</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8}><div className="empty-state">Nenhum cliente encontrado.</div></td></tr>
                )}
                {filtered.map(c => {
                  const etapa = getEtapaAtual(c);
                  const prog = getProgress(c);
                  return (
                    <tr key={c.id}
                      className={selectedId === c.id ? 'selected' : ''}
                      onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}>
                      <td>
                        <div className="td-name">{c.nome}</div>
                        <div className="td-sub">{c.ativo === 'S' ? '● Ativo' : '○ Inativo'}</div>
                      </td>
                      <td className="td-muted">{c.telefone || '—'}</td>
                      <td>{c.tipo ? <span className={`badge ${tipoBadge(c.tipo)}`}>{c.tipo}</span> : '—'}</td>
                      <td className="td-muted">{c.imovel || '—'}</td>
                      <td style={{ fontWeight: 600, color: '#059669' }}>
                        {c.valor ? `R$ ${Number(c.valor).toLocaleString('pt-BR')}` : '—'}
                      </td>
                      <td>{c.origem ? <span className="badge badge-orange">{c.origem}</span> : '—'}</td>
                      <td>
                        {etapa ? (
                          <div className="progress-wrap">
                            <div className="progress-label">{ETAPAS_LABEL[etapa]}</div>
                            <div className="progress-bar"><div className="progress-fill" style={{ width: `${prog}%` }} /></div>
                          </div>
                        ) : <span className="td-muted">—</span>}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal(c)}>Editar</button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => setConfirmDelete(c.id)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <DetailPanel
            cliente={selected}
            onEdit={c => setModal(c)}
            onDelete={id => setConfirmDelete(id)}
            onToggleFunil={(id, etapa, val) => onToggleFunil(id, etapa, val)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {modal && (
        <ClienteModal
          cliente={modal === 'new' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {confirmDelete && (
        <div className="modal-overlay">
          <div className="confirm-dialog">
            <div className="confirm-icon">⚠️</div>
            <div className="confirm-title">Confirmar exclusão</div>
            <div className="confirm-text">Esta ação não pode ser desfeita. O cliente será removido permanentemente.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
