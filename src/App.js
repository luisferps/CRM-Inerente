import { useState, useEffect, useMemo, useRef } from 'react';
import './index.css';
import { supabase } from './supabaseClient';
import CRMTab from './components/CRMTab';
import FunilTab from './components/FunilTab';
import DashboardTab from './components/DashboardTab';
import ConfigTab from './components/ConfigTab';
import LoginScreen from './components/LoginScreen';
import ClienteModal from './components/ClienteModal';

export default function App() {
  const [tab, setTab] = useState('crm');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [modal, setModal] = useState(null);
  const sessionRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      sessionRef.current = session;
      setSession(session);
      setCheckingAuth(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_OUT') {
        sessionRef.current = null;
        setSession(null);
      } else if (_event === 'SIGNED_IN' && !sessionRef.current) {
        sessionRef.current = session;
        setSession(session);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    async function load() {
      setLoading(true);
      const { data: rows, error: err } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) setError(err.message);
      else setData(rows || []);
      setLoading(false);
    }
    load();
  }, [session]);

  async function handleSave(form, id) {
    const payload = { ...form };
    delete payload.id;
    delete payload.created_at;
    if (id) {
      const { data: updated, error: err } = await supabase
        .from('clientes').update(payload).eq('id', id).select().single();
      if (err) return alert('Erro ao salvar: ' + err.message);
      setData(d => d.map(c => c.id === id ? updated : c));
    } else {
      const { data: inserted, error: err } = await supabase
        .from('clientes').insert(payload).select().single();
      if (err) return alert('Erro ao inserir: ' + err.message);
      setData(d => [inserted, ...d]);
    }
    setModal(null);
  }

  async function handleDelete(id) {
    const { error: err } = await supabase.from('clientes').delete().eq('id', id);
    if (err) return alert('Erro ao excluir: ' + err.message);
    setData(d => d.filter(c => c.id !== id));
  }

  async function handleToggleFunil(id, etapa, val) {
    const { data: updated, error: err } = await supabase
      .from('clientes').update({ [etapa]: val }).eq('id', id).select().single();
    if (err) return alert('Erro: ' + err.message);
    setData(d => d.map(c => c.id === id ? updated : c));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setData([]);
  }

  const stats = useMemo(() => ({
    total: data.length,
    ativos: data.filter(c => c.ativo === 'S').length,
    contratos: data.filter(c => c.contrato).length,
  }), [data]);

  if (checkingAuth) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#9ca3af' }}>Carregando...</div>;

  if (!session) return <LoginScreen />;

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-logo">CRM <span>Imobiliário</span></div>
        <nav className="tab-nav">
          {[['crm','Clientes'],['funil','Funil'],['dash','Dashboard'],['config','⚙️ Config']].map(([t, l]) => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{l}</button>
          ))}
        </nav>
        <button onClick={handleLogout}
          style={{ background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 14px', fontSize: 12, color: '#6b7280', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          Sair
        </button>
      </header>
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-label">Total</span>
          <span className="stat-value stat-blue">{stats.total}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Ativos</span>
          <span className="stat-value stat-green">{stats.ativos}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Contratos</span>
          <span className="stat-value stat-purple">{stats.contratos}</span>
        </div>
      </div>
      {error && <div className="error-banner">⚠️ Erro de conexão: {error}</div>}
      <main className="main">
        {loading ? (
          <div className="loading">Carregando dados...</div>
        ) : (
          <>
            {tab === 'crm' && <CRMTab data={data} onOpenModal={setModal} onDelete={handleDelete} onToggleFunil={handleToggleFunil} />}
            {tab === 'funil' && <FunilTab data={data} onToggleFunil={handleToggleFunil} onSave={handleSave} />}
            {tab === 'dash' && <DashboardTab data={data} />}
            {tab === 'config' && <ConfigTab />}
          </>
        )}
      </main>

      {modal !== null && (
        <ClienteModal
          cliente={modal === 'new' ? null : modal}
          onSave={handleSave}
          onClose={() => { localStorage.removeItem('crm_rascunho'); setModal(null); }}
        />
      )}
    </div>
  );
}
