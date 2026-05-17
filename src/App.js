import { useState, useEffect, useMemo, useRef } from 'react';
import './index.css';
import { supabase } from './supabaseClient';
import CRMTab from './components/CRMTab';
import FunilTab from './components/FunilTab';
import DashboardTab from './components/DashboardTab';
import ConfigTab from './components/ConfigTab';
import InativosTab from './components/InativosTab';
import CorretoresTab from './components/CorretoresTab';
import LoginScreen from './components/LoginScreen';
import ClienteModal from './components/ClienteModal';
import PerfilTab from './components/PerfilTab';
import BackupTab from './components/BackupTab';

export default function App() {
  const [tab, setTab] = useState('crm');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [modal, setModal] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('crm_dark') === 'true');
  const sessionRef = useRef(null);

  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
  }, [darkMode]);

  function toggleDark() {
    setDarkMode(d => {
      const next = !d;
      localStorage.setItem('crm_dark', next);
      document.body.classList.toggle('dark', next);
      return next;
    });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      sessionRef.current = session;
      setSession(session);
      if (session) loadPerfil(session.user.id);
      else setCheckingAuth(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_OUT') {
        sessionRef.current = null;
        setSession(null);
        setPerfil(null);
        setCheckingAuth(false);
      } else if (_event === 'SIGNED_IN' && !sessionRef.current) {
        sessionRef.current = session;
        setSession(session);
        loadPerfil(session.user.id);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadPerfil(userId) {
    const { data } = await supabase.from('perfis').select('*').eq('id', userId).single();
    setPerfil(data);
    setCheckingAuth(false);
  }

  useEffect(() => {
    if (!session || !perfil) return;
    load();
  }, [session, perfil]);

  async function load() {
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from('clientes').select('*').order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setData(rows || []);
    setLoading(false);
  }

  async function handleSave(form) {
    const payload = { ...form };
    const editId = payload.id || null;
    delete payload.id;
    delete payload.created_at;
    if (perfil?.role === 'corretor') payload.corretor_id = perfil.id;

    if (editId) {
      const { data: updated, error: err } = await supabase
        .from('clientes').update(payload).eq('id', editId).select().single();
      if (err) return alert('Erro ao salvar: ' + err.message);
      setData(d => d.map(c => c.id === editId ? updated : c));
    } else {
      const { data: inserted, error: err } = await supabase
        .from('clientes').insert(payload).select().single();
      if (err) return alert('Erro ao inserir: ' + err.message);
      setData(d => [inserted, ...d]);
    }
    localStorage.removeItem('crm_rascunho');
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
    setPerfil(null);
  }

  const isGerente = perfil?.role === 'gerente';

  const stats = useMemo(() => ({
    total: data.filter(c => c.ativo === 'S').length,
    vendas: data.filter(c => c.ativo === 'S' && c.modalidade === 'Venda').length,
    locacoes: data.filter(c => c.ativo === 'S' && c.modalidade === 'Locação').length,
    contratos: data.filter(c => c.contrato).length,
  }), [data]);

  if (checkingAuth) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#9ca3af' }}>
      Carregando...
    </div>
  );

  if (!session || !perfil) return <LoginScreen />;

  const tabs = isGerente
    ? [['crm','Clientes'],['funil','Funil'],['dash','Dashboard'],['inativos','Inativos'],['corretores','Corretores'],['config','⚙️ Config'],['backup','💾 Backup'],['perfil','👤 Perfil']]
    : [['crm','Meus Clientes'],['funil','Funil'],['dash','Dashboard'],['inativos','Inativos'],['perfil','👤 Perfil']];

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-logo">CRM <span>Imobiliário</span></div>
        <nav className="tab-nav">
          {tabs.map(([t, l]) => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{l}</button>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {perfil.nome} · <span style={{ color: isGerente ? '#2563eb' : '#059669', fontWeight: 600 }}>{isGerente ? 'Gerente' : 'Corretor'}</span>
          </span>
          <button onClick={toggleDark} style={{ background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', fontSize: 14, color: '#6b7280', cursor: 'pointer' }}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 14px', fontSize: 12, color: '#6b7280', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Sair
          </button>
        </div>
      </header>

      <div className="stats-bar">
        <div className="stat-item"><span className="stat-label">Ativos</span><span className="stat-value stat-blue">{stats.total}</span></div>
        <div className="stat-item"><span className="stat-label">Vendas</span><span className="stat-value stat-green">{stats.vendas}</span></div>
        <div className="stat-item"><span className="stat-label">Locações</span><span className="stat-value stat-purple">{stats.locacoes}</span></div>
        <div className="stat-item"><span className="stat-label">Contratos</span><span className="stat-value stat-orange">{stats.contratos}</span></div>
      </div>

      {error && <div className="error-banner">⚠️ Erro de conexão: {error}</div>}

      <main className="main">
        {loading ? <div className="loading">Carregando dados...</div> : (
          <>
            {tab === 'crm' && <CRMTab data={data.filter(c => c.ativo === 'S')} onOpenModal={setModal} onDelete={handleDelete} onToggleFunil={handleToggleFunil} isGerente={isGerente} />}
            {tab === 'funil' && <FunilTab data={data} onToggleFunil={handleToggleFunil} onOpenModal={setModal} />}
            {tab === 'dash' && <DashboardTab data={data} />}
            {tab === 'inativos' && <InativosTab data={data.filter(c => c.ativo === 'N')} onOpenModal={setModal} onDelete={handleDelete} />}
            {tab === 'corretores' && isGerente && <CorretoresTab />}
            {tab === 'config' && isGerente && <ConfigTab />}
            {tab === 'backup' && isGerente && <BackupTab />}
            {tab === 'perfil' && <PerfilTab perfil={perfil} onUpdate={setPerfil} />}
          </>
        )}
      </main>

      {modal !== null && (
        <ClienteModal
          cliente={modal === 'new' ? null : modal}
          onSave={handleSave}
          onClose={() => { localStorage.removeItem('crm_rascunho'); setModal(null); }}
          perfil={perfil}
        />
      )}
    </div>
  );
}
