import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import AmpulhetaAprovacao from './AmpulhetaAprovacao';

const ORIGENS_DEFAULT = ['Carteira','Facebook','Google','Indicação','Instagram','OLX','Zap Imóveis','Corretor'];

export default function ClientesTab({ clientes, negociacoes, onVerTratativas, onNovaTratativa, onReload, perfil }) {
  const [search, setSearch] = useState('');
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [origens, setOrigens] = useState([]);

  useEffect(() => {
    supabase.from('configuracoes').select('valor').eq('chave', 'origens').single()
      .then(({ data }) => setOrigens(data?.valor || ORIGENS_DEFAULT));
  }, []);

  const clientesComNeg = useMemo(() => {
    return clientes.map(c => {
      const negs = negociacoes.filter(n => n.cliente_id === c.id);
      const ativas = negs.filter(n => n.ativo === 'S').length;
      const finalizadas = negs.filter(n => n.ativo === 'N').length;
      return { ...c, totalNeg: negs.length, ativas, finalizadas };
    });
  }, [clientes, negociacoes]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clientesComNeg.filter(c =>
      !q || c.nome.toLowerCase().includes(q) ||
      (c.telefone || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  }, [clientesComNeg, search]);

  function exportarCSV() {
    const cols = ['nome','telefone','telefone2','email','origem','is_corretor','totalNeg','ativas','finalizadas'];
    const headers = ['Nome','Telefone','Telefone 2','Email','Aquisição','É Corretor','Total Tratativas','Ativas','Finalizadas'];
    const bom = '\uFEFF';
    const rows = filtered.map(c => cols.map(k => {
      const v = c[k];
      if (v === null || v === undefined) return '';
      const s = String(v === true ? 'Sim' : v === false ? 'Não' : v).replace(/"/g, '""');
      return s.includes(';') || s.includes('\n') || s.includes('"') ? `"${s}"` : s;
    }).join(';'));
    const csv = bom + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    a.href = url; a.download = `clientes_${hoje}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function abrirEdit(c) {
    setEditForm({ nome: c.nome, telefone: c.telefone || '', email: c.email || '', origem: c.origem || '', is_corretor: c.is_corretor || false });
    setEditModal(c);
  }

  async function handleSaveEdit() {
    if (!editForm.nome.trim()) return alert('Nome é obrigatório.');
    setSaving(true);
    const { error } = await supabase.from('clientes').update({
      nome: editForm.nome,
      telefone: editForm.telefone || null,
      email: editForm.email || null,
      origem: editForm.origem || null,
      is_corretor: editForm.is_corretor,
    }).eq('id', editModal.id);
    if (error) alert('Erro: ' + error.message);
    else { setEditModal(null); if (onReload) onReload(); }
    setSaving(false);
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Clientes</h2>
          <p style={{ fontSize: 13, color: '#6b7280' }}>Base de clientes cadastrados no sistema.</p>
        </div>
        <button onClick={exportarCSV}
          style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          📥 Exportar CSV
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input placeholder="🔍 Buscar por nome, telefone ou email..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: 400, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
      </div>

      <div className="table-wrapper">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Nome','Telefone','Email','Aquisição','Tratativas','Ativas','Finalizadas','Ações'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Nenhum cliente encontrado.</td></tr>
            )}
            {filtered.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                  {c.nome}
                  {c.is_corretor && <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 10, fontSize: 10, background: '#fff7ed', color: '#c2410c', fontWeight: 600 }}>Corretor</span>}
                  <AmpulhetaAprovacao clienteId={c.id} perfil={perfil} onAplicado={onReload} />
                </td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.telefone || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.email || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.origem || '—'}</td>
                <td style={{ padding: '12px 16px' }}><span style={{ fontWeight: 700, color: '#2563eb' }}>{c.totalNeg}</span></td>
                <td style={{ padding: '12px 16px' }}><span style={{ fontWeight: 600, color: '#059669' }}>{c.ativas}</span></td>
                <td style={{ padding: '12px 16px' }}><span style={{ color: '#9ca3af' }}>{c.finalizadas}</span></td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => abrirEdit(c)}
                      style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                      ✏️ Editar
                    </button>
                    <button onClick={() => onNovaTratativa && onNovaTratativa(c.id)}
                      style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                      + Tratativa
                    </button>
                    <button onClick={() => onVerTratativas(c.id)}
                      style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                      Ver
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de edição de cliente */}
      {editModal && (
        <div className="modal-overlay">
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 460, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>✏️ Editar Cliente</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Nome *</label>
                <input value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Telefone</label>
                <input value={editForm.telefone} onChange={e => setEditForm(f => ({ ...f, telefone: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Aquisição</label>
                <select value={editForm.origem} onChange={e => setEditForm(f => ({ ...f, origem: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
                  <option value="">Selecionar</option>
                  {origens.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                <input type="checkbox" checked={editForm.is_corretor} onChange={e => setEditForm(f => ({ ...f, is_corretor: e.target.checked }))}
                  style={{ width: 16, height: 16, margin: 0 }} />
                Este cliente é corretor
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setEditModal(null)}
                style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleSaveEdit} disabled={saving}
                style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
