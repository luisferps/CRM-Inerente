import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function PerfilTab({ perfil, onUpdate }) {
  const [form, setForm] = useState({
    nome: perfil.nome || '',
    telefone: perfil.telefone || '',
    cpf: perfil.cpf || '',
    creci: perfil.creci || '',
  });
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingSenha, setSavingSenha] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgSenha, setMsgSenha] = useState('');

  async function handleSavePerfil() {
    if (!form.nome.trim()) return setMsg('Nome é obrigatório.');
    setSaving(true);
    setMsg('');
    const { error } = await supabase.from('perfis').update({
      nome: form.nome,
      telefone: form.telefone || null,
      cpf: form.cpf || null,
      creci: form.creci || null,
    }).eq('id', perfil.id);
    if (error) setMsg('Erro ao salvar: ' + error.message);
    else {
      setMsg('✅ Perfil atualizado!');
      if (onUpdate) onUpdate({ ...perfil, ...form });
    }
    setSaving(false);
  }

  async function handleSaveSenha() {
    if (senha.length < 6) return setMsgSenha('Senha deve ter pelo menos 6 caracteres.');
    if (senha !== confirmSenha) return setMsgSenha('As senhas não coincidem.');
    setSavingSenha(true);
    setMsgSenha('');
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) setMsgSenha('Erro: ' + error.message);
    else {
      setMsgSenha('✅ Senha atualizada!');
      setSenha('');
      setConfirmSenha('');
    }
    setSavingSenha(false);
  }

  const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 };

  return (
    <div style={{ maxWidth: 520 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>Meu Perfil</h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
        {perfil.email} · <span style={{ color: perfil.role === 'gerente' ? '#2563eb' : '#059669', fontWeight: 600 }}>{perfil.role === 'gerente' ? 'Gerente' : 'Corretor'}</span>
      </p>

      {/* Dados pessoais */}
      <div className="dash-section">
        <div className="dash-section-title">Dados Pessoais</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Nome *</label>
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Telefone</label>
            <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(62) 9 9999-9999" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>CPF</label>
            <input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>CRECI</label>
            <input value={form.creci} onChange={e => setForm(f => ({ ...f, creci: e.target.value }))} placeholder="Ex: 12345-GO" style={inputStyle} />
          </div>
        </div>
        {msg && (
          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, fontSize: 12, background: msg.includes('✅') ? '#d1fae5' : '#fee2e2', color: msg.includes('✅') ? '#065f46' : '#dc2626' }}>
            {msg}
          </div>
        )}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleSavePerfil} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Perfil'}
          </button>
        </div>
      </div>

      {/* Alterar senha */}
      <div className="dash-section" style={{ marginTop: 20 }}>
        <div className="dash-section-title">Alterar Senha</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Nova Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Confirmar Nova Senha</label>
            <input type="password" value={confirmSenha} onChange={e => setConfirmSenha(e.target.value)} placeholder="Repita a senha" style={inputStyle} />
          </div>
        </div>
        {msgSenha && (
          <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, fontSize: 12, background: msgSenha.includes('✅') ? '#d1fae5' : '#fee2e2', color: msgSenha.includes('✅') ? '#065f46' : '#dc2626' }}>
            {msgSenha}
          </div>
        )}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleSaveSenha} disabled={savingSenha}>
            {savingSenha ? 'Salvando...' : 'Alterar Senha'}
          </button>
        </div>
      </div>
    </div>
  );
}
