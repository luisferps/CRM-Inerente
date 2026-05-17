import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function RegisterScreen({ onBack }) {
  const [form, setForm] = useState({ nome: '', email: '', senha: '', telefone: '', cpf: '', creci: '', data_entrada: '' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleRegister() {
    if (!form.nome || !form.email || !form.senha || !form.creci) {
      return alert('Preencha nome, email, senha e CRECI.');
    }
    if (form.senha.length < 6) return alert('Senha deve ter pelo menos 6 caracteres.');
    setSaving(true);

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.senha,
    });

    if (error) { alert('Erro: ' + error.message); setSaving(false); return; }

    const { error: perfErr } = await supabase.from('perfis').insert({
      id: data.user.id,
      nome: form.nome,
      email: form.email,
      telefone: form.telefone,
      cpf: form.cpf,
      creci: form.creci,
      data_entrada: form.data_entrada || null,
      role: 'corretor',
      aprovado: false,
    });

    if (perfErr) { alert('Erro ao salvar perfil: ' + perfErr.message); setSaving(false); return; }

    setSuccess(true);
    setSaving(false);
  }

  if (success) return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '40px 36px', width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Cadastro enviado!</div>
        <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>Seu cadastro foi enviado para aprovação do gerente. Você receberá acesso em breve.</div>
        <button onClick={onBack} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Voltar ao login</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', padding: 16 }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '40px 36px', width: '100%', maxWidth: 480, boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>CRM <span style={{ color: '#2563eb' }}>Imobiliário</span></div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>Cadastro de Corretor</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Nome completo *</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Seu nome completo"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Email *</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="seu@email.com"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Senha * (mínimo 6 caracteres)</label>
            <input type="password" value={form.senha} onChange={e => set('senha', e.target.value)} placeholder="••••••••"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Telefone</label>
            <input value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="(62) 9 9999-9999"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>CPF</label>
            <input value={form.cpf} onChange={e => set('cpf', e.target.value)} placeholder="000.000.000-00"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>CRECI *</label>
            <input value={form.creci} onChange={e => set('creci', e.target.value)} placeholder="Ex: 12345-GO"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Data de Entrada</label>
            <input type="date" value={form.data_entrada} onChange={e => set('data_entrada', e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>

        <button onClick={handleRegister} disabled={saving}
          style={{ width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginTop: 20 }}>
          {saving ? 'Enviando...' : 'Solicitar Acesso'}
        </button>

        <button onClick={onBack} style={{ width: '100%', padding: '8px', background: 'transparent', color: '#6b7280', border: 'none', fontSize: 13, cursor: 'pointer', marginTop: 10 }}>
          Já tenho acesso → Fazer login
        </button>
      </div>
    </div>
  );
}
