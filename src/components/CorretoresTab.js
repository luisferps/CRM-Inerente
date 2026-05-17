import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function CorretoresTab() {
  const [corretores, setCorretores] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('perfis').select('*').eq('role', 'corretor').order('nome');
    const aprovados = (data || []).filter(c => c.aprovado);
    const pend = (data || []).filter(c => !c.aprovado);
    setCorretores(aprovados);
    setPendentes(pend);
    setLoading(false);
  }

  async function aprovar(id) {
    await supabase.from('perfis').update({ aprovado: true }).eq('id', id);
    await load();
  }

  async function rejeitar(id) {
    if (!window.confirm('Rejeitar e remover este cadastro?')) return;
    await supabase.from('perfis').delete().eq('id', id);
    await load();
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from('perfis').update({
      nome: form.nome, telefone: form.telefone,
      cpf: form.cpf, creci: form.creci,
      data_entrada: form.data_entrada || null,
    }).eq('id', modal.id);
    await load();
    setModal(null);
    setSaving(false);
  }

  async function handleDelete(id) {
    await supabase.from('perfis').delete().eq('id', id);
    await load();
    setConfirmDelete(null);
  }

  return (
    <div>
      {pendentes.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 12 }}>
            ⏳ Solicitações pendentes ({pendentes.length})
          </div>
          {pendentes.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1px solid #fde68a', borderRadius: 7, padding: '10px 14px', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nome}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{c.email} · CRECI: {c.creci}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => aprovar(c.id)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✓ Aprovar</button>
                <button onClick={() => rejeitar(c.id)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✕ Rejeitar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Corretores Ativos</h2>
      </div>

      {loading ? <div className="loading">Carregando...</div> : (
        <div className="table-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Nome','Email','Telefone','CPF','CRECI','Entrada','Ações'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corretores.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Nenhum corretor aprovado.</td></tr>
              )}
              {corretores.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{c.nome}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.email}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.telefone || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.cpf || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.creci || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.data_entrada || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setForm({ ...c }); setModal(c); }}
                        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                        Editar
                      </button>
                      <button onClick={() => setConfirmDelete(c.id)}
                        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fee2e2', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-overlay">
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 480, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Editar Corretor</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[['nome','Nome'],['telefone','Telefone'],['cpf','CPF'],['creci','CRECI'],['data_entrada','Data Entrada']].map(([k,l]) => (
                <div key={k} style={{ gridColumn: k === 'nome' ? '1/-1' : 'auto' }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>{l}</label>
                  <input type={k === 'data_entrada' ? 'date' : 'text'} value={form[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay">
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Confirmar exclusão</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>O corretor será removido do sistema.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
