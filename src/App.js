import { useState, useEffect, useMemo } from 'react';
import './index.css';
import { supabase } from './supabaseClient';
import CRMTab from './components/CRMTab';
import FunilTab from './components/FunilTab';
import DashboardTab from './components/DashboardTab';
import ConfigTab from './components/ConfigTab';

export default function App() {
  const [tab, setTab] = useState('crm');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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
  }, []);

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

  const stats = useMemo(() => ({
    total: data.length,
    ativos: data.filter(c => c.ativo === 'S').length,
    contratos: data.filter(c => c.contrato).length,
  }), [data]);

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-logo">CRM <span>Imobiliário</span></div>
        <nav className="tab-nav">
          {[['crm','Clientes'],['funil','Funil'],['dash','Dashboard'],['config','⚙️ Config']].map(([t, l]) => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{l}</button>
          ))}
        </nav>
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
            {tab === 'crm' && <CRMTab data={data} onSave={handleSave} onDelete={handleDelete} onToggleFunil={handleToggleFunil} />}
            {tab === 'funil' && <FunilTab data={data} onToggleFunil={handleToggleFunil} onEdit={(c) => { setEditingCliente(c); setTab('crm'); }} />}
            {tab === 'dash' && <DashboardTab data={data} />}
            {tab === 'config' && <ConfigTab />}
          </>
        )}
      </main>
    </div>
  );
}
