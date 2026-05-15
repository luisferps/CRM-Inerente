import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function handleLogin() {
    if (!email || !senha) return setErro('Preencha email e senha.');
    setLoading(true);
    setErro('');
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) setErro('Email ou senha incorretos.');
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '40px 36px', width: '100%', maxWidth: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>CRM <span style={{ color: '#2563eb' }}>Imobiliário</span></div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>Faça login para continuar</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="seu@email.com"
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Senha</label>
          <input
            type="password"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••"
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }}
          />
        </div>

        {erro && (
          <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 6, padding: '8px 12px', fontSize: 12, marginBottom: 14 }}>
            {erro}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{ width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </div>
    </div>
  );
}
