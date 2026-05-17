import { useState } from 'react';

function getEtapaLabel(c) {
  const etapas = ['tratativa','pesquisa','agendamento','visita','proposta','contrato','financiamento','recebimento','recebido'];
  const labels = { tratativa:'Tratativa', pesquisa:'Pesquisa', agendamento:'Agendamento', visita:'Visita', proposta:'Proposta', contrato:'Contrato', financiamento:'Financiamento', recebimento:'À Receber', recebido:'Recebido' };
  for (let i = etapas.length - 1; i >= 0; i--) {
    if (c[etapas[i]]) return labels[etapas[i]];
  }
  return '—';
}

export default function InativosTab({ data, onOpenModal, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState('');

  const filtered = data.filter(c => {
    const q = search.toLowerCase();
    return !q || c.nome.toLowerCase().includes(q) || (c.telefone || '').includes(q);
  });

  async function handleDelete(id) {
    await onDelete(id);
    setConfirmDelete(null);
  }

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
        <input
          placeholder="🔍  Buscar por nome ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }}
        />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Nome','Telefone','Tipo','Modalidade','Localização','Motivo Desistência','Última Etapa',''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Nenhum cliente inativo.</td></tr>
            )}
            {filtered.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: 0.8 }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1a1a2e' }}>{c.nome}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.telefone || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.tipo || '—'}</td>
                <td style={{ padding: '12px 16px' }}>
                  {c.modalidade ? (
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.modalidade === 'Venda' ? '#dbeafe' : c.modalidade === 'Locação' ? '#ede9fe' : '#dcfce7', color: c.modalidade === 'Venda' ? '#1d4ed8' : c.modalidade === 'Locação' ? '#7e22ce' : '#15803d' }}>
                      {c.modalidade}
                    </span>
                  ) : '—'}
                </td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.localizacao || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#dc2626', fontSize: 12 }}>{c.motivo_desistencia || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: 12 }}>{getEtapaLabel(c)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onOpenModal(c)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Editar</button>
                    <button onClick={() => setConfirmDelete(c.id)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fee2e2', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Confirmar exclusão</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>Esta ação não pode ser desfeita.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
