import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const emptyForm = { nome: '', email: '', telefone: '', ativo: true };

export default function CorretoresTab() {
  const [corretores, setCorretores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [senhaModal, setSenhaModal] = useState(null);
  const [novaSenha, setNovaSenha] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('corretores').select('*').order('nome');
    setCorretores(data || []);
    setLoading(false);
  }

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSave() {
    if (!form.nome.trim()) return alert('Nome é obrigatório.');
    if (!form.email.trim()) return alert('Email é obrigatório.');
    setSaving(true);

    if (modal === 'new') {
      // Criar usuário no Supabase Auth
      const senhaTemp = Math.random().toString(36).slice(-8) + 'A1!';
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: form.email,
        password: senhaTemp,
        email_confirm: true,
      });

      if (authErr) {
        alert('Erro ao criar usuário: ' + authErr.message);
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('corretores').insert({
        nome: form.nome, email: form.email,
        telefone: form.telefone, ativo: form.ativo,
        user_id: authData.user.id,
      });

      if (error) { alert('Erro: ' + error.message); setSaving(false); return; }
      alert(`Corretor criado!\nEmail: ${form.email}\nSenha temporária: ${senhaTemp}\n\nPeça para ele trocar a senha no primeiro acesso.`);
    } else {
      const { error } = await supabase.from('corretores').update({
        nome: form.nome, telefone: form.telefone, ativo: form.ativo,
      }).eq('id', modal.id);
      if (error) { alert('Erro: ' + error.message); setSaving(false); return; }
    }

    await load();
    setModal(null);
    setSaving(false);
  }

  async function handleDelete(id) {
    await supabase.from('corretores').delete().eq('id', id);
    await load();
    setConfirmDelete(null);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 2 }}>Corretores</h2>
          <p style={{ fontSize: 13, color: '#6b7280' }}>Gerencie os corretores e seus acessos ao sistema.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setModal('new'); }}>+ Novo Corretor</button>
      </div>

      {loading ? <div className="loading">Carregando...</div> : (
        <div className="table-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Nome','Email','Telefone','Status','Ações'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corretores.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Nenhum corretor cadastrado.</td></tr>
              )}
              {corretores.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1a1a2e' }}>{c.nome}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.email}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.telefone || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: c.ativo ? '#d1fae5' : '#fee2e2', color: c.ativo ? '#065f46' : '#991b1b' }}>
                      {c.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setForm({ nome: c.nome, email: c.email, telefone: c.telefone || '', ativo: c.ativo }); setModal(c); }}
                        style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                        Editar
                      </button>
                      <button onClick={() => { setSenhaModal(c); setNovaSenha(''); }}
