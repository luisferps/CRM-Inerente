import { useState, useEffect, useMemo, useRef } from 'react';
import './index.css';
import { supabase } from './supabaseClient';
import { normModalidade, ehCaptacao } from './constants';
import CRMTab from './components/CRMTab';
import FunilTab from './components/FunilTab';
import VendasTab from './components/VendasTab';
import SecretariaTab from './components/SecretariaTab';
import DashboardTab from './components/DashboardTab';
import ConfigTab from './components/ConfigTab';
import InativosTab from './components/InativosTab';
import LoginScreen from './components/LoginScreen';
import ClienteModal from './components/ClienteModal';
import PerfilTab from './components/PerfilTab';
import BackupTab from './components/BackupTab';
import ImportacaoTab from './components/ImportacaoTab';
import ResumoDemandasTab from './components/ResumoDemandasTab';
import TransferenciasTab from './components/TransferenciasTab';
import RecebidosTab from './components/RecebidosTab';
import ClientesTab from './components/ClientesTab';
import CaptacaoTab from './components/CaptacaoTab';

// Telefone padrão: 11 dígitos (DDD + número), sem o 55. O 55 entra só no envio ao WhatsApp.
function so11(x) {
  let d = String(x == null ? '' : x).replace(/\D/g, '');
  if (d.length >= 12 && d.length <= 13 && d.slice(0, 2) === '55') d = d.slice(2);
  return d || (x == null ? '' : String(x));
}

function splitForm(form) {
  const clienteData = {
    nome: form.nome,
    telefone: so11(form.telefone),
    telefone2: form.telefone2 ? so11(form.telefone2) : null,
    email: form.email,
    entrada: form.entrada || new Date().toISOString().slice(0, 10),
    origem: form.origem || null,
    is_corretor: form.is_corretor || false,
  };
  const negociacaoData = {
    modalidade: form.modalidade,
    origem_tratativa: form.origem_tratativa || null,
    imovel: form.imovel,
    tipo_id: form.tipo_id || null,
    em_condominio: form.em_condominio || false,
    valor: form.valor ? Number(form.valor) : null,
    localizacao: form.localizacao,
    detalhes: form.detalhes,
    detalhes_externos: form.detalhes_externos || null,
    proxima_acao: form.proxima_acao,
    imoveis_visitados: form.imoveis_visitados,
    ultimo_contato: form.ultimo_contato || null,
    prox_contato: form.prox_contato || null,
    final_contato: form.final_contato || null,
    prorrogacao: form.prorrogacao || null,
    ativo: form.ativo,
    motivo_desistencia: form.ativo === 'S' ? '' : form.motivo_desistencia,
    solicitar_parceria: form.solicitar_parceria || false,
    captado: form.captado || false,
    tratativa: form.tratativa || false,
    pesquisa: form.pesquisa || false,
    agendamento: form.agendamento || false,
    visita: form.visita || false,
    proposta: form.proposta || false,
    contrato: form.contrato || false,
    financiamento: form.financiamento || false,
    recebimento: form.recebimento || false,
    recebido: form.recebido || false,
    corretor_id: form.corretor_id,
    corretor: form.corretor,
    ficha: form.ficha || null,
    // Divisão de comissão da tratativa (antes se perdia aqui e nunca chegava ao banco)
    tratativa_divisao: Array.isArray(form.tratativa_divisao) ? form.tratativa_divisao : [],
    tratativa_dono_edicao: form.tratativa_dono_edicao || null,
    // Divisão de CAPTAÇÃO configurada na tratativa (persistida para não se perder entre edições)
    captacao_divisao: Array.isArray(form.captacao_divisao) ? form.captacao_divisao : [],
    captacao_dono_edicao: form.captacao_dono_edicao || null,
  };
  return { clienteData, negociacaoData };
}

export default function App() {
  const [tab, setTab] = useState(() => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t === 'captacao') { localStorage.setItem('cap_modo', '1'); return 'captacao'; } // entra na captação e marca o modo (sobrevive ao F5)
      if (t) { localStorage.removeItem('cap_modo'); return t; } // qualquer outra aba explícita (ex: card Clientes ?tab=tratativas) SAI do modo captação
      // Sem ?tab na URL: pode ser F5 dentro da captação (a URL foi limpa pelo SSO). O marcador reabre a captação.
      if (localStorage.getItem('cap_modo') === '1') return 'captacao';
    } catch (e) {}
    // Aba normal do CRM. Ignora crm_tab='captacao' antigo (captação só via ?tab=captacao ou marcador).
    const saved = localStorage.getItem('crm_tab');
    return (saved && saved !== 'captacao') ? saved : 'tratativas';
  });
  const [clientes, setClientes] = useState([]);
  const [negociacoes, setNegociacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [modal, setModal] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('crm_dark') === 'true');
  const [filtroClienteId, setFiltroClienteId] = useState(null);
  const [abaFunil, setAbaFunil] = useState(() => localStorage.getItem('crm_funil_aba') || 'compra');
  const sessionRef = useRef(null);

  useEffect(() => { document.body.classList.toggle('dark', darkMode); }, [darkMode]);

  function toggleDark() {
    setDarkMode(d => {
      const next = !d;
      localStorage.setItem('crm_dark', next);
      document.body.classList.toggle('dark', next);
      return next;
    });
  }

  useEffect(() => {
    // ── Mini-SSO: entra com a conta REAL do usuário (JWT do Portal) ──
    // 1) Se veio ?jwt= e ?refresh= do Portal, assume a sessão Supabase do próprio usuário
    //    (setSession) — assim o RLS por usuário funciona (cada um vê o que lhe cabe).
    // 2) Senão, cai no método antigo (?sso= → login/senha) como rede de segurança.
    async function tentarSSO() {
      const params = new URLSearchParams(window.location.search);
      const jwt = params.get('jwt');
      const refresh = params.get('refresh');
      const token = params.get('sso');
      if (!jwt && !token) return false;
      // limpa os tokens da URL na hora (não ficam no histórico)
      const urlLimpa = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', urlLimpa);

      // 1) Caminho novo: JWT direto do Supabase (conta do próprio usuário)
      if (jwt && refresh) {
        try {
          const { error } = await supabase.auth.setSession({ access_token: jwt, refresh_token: refresh });
          if (!error) return true;
        } catch (e) { /* tenta o fallback abaixo */ }
      }

      // 2) Fallback: método antigo (login/senha compartilhada guardada no backend)
      if (token) {
        try {
          const resp = await fetch('https://agentes-de-whatsapp-production.up.railway.app/painel/sso-resgatar', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, sistema: 'crm' })
          });
          const data = await resp.json();
          if (data && data.ok && data.login && data.senha) {
            const { error } = await supabase.auth.signInWithPassword({ email: data.login, password: data.senha });
            if (!error) return true;
          }
        } catch (e) { /* falha silenciosa: cai no login normal */ }
      }
      return false;
    }

    tentarSSO().then(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        sessionRef.current = session;
        setSession(session);
        if (session) loadPerfil(session.user.id);
        else setCheckingAuth(false);
      });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_OUT') { sessionRef.current = null; setSession(null); setPerfil(null); setCheckingAuth(false); }
      else if (_event === 'SIGNED_IN' && !sessionRef.current) { sessionRef.current = session; setSession(session); loadPerfil(session.user.id); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadPerfil(userId) {
    const { data } = await supabase.from('perfis').select('*').eq('id', userId).single();
    setPerfil(data);
    setCheckingAuth(false);
  }

  useEffect(() => { if (!session || !perfil) return; load(); }, [session, perfil]);

  async function load() {
    setLoading(true);
    const [{ data: clientesData, error: err1 }, { data: negData, error: err2 }] = await Promise.all([
      supabase.from('clientes').select('*').order('created_at', { ascending: false }),
      supabase.from('negociacoes').select('*').order('created_at', { ascending: false }),
    ]);
    if (err1 || err2) setError((err1 || err2).message);
    else { setClientes(clientesData || []); setNegociacoes(negData || []); }
    setLoading(false);
  }

  const data = useMemo(() => {
    return negociacoes.map(neg => {
      const cliente = clientes.find(c => c.id === neg.cliente_id) || {};
      return {
        ...neg,
        negociacao_id: neg.id,
        id: neg.id,
        cliente_real_id: cliente.id,
        nome: cliente.nome || '',
        telefone: cliente.telefone || '',
        email: cliente.email || '',
        entrada: cliente.entrada || '',
        origem: cliente.origem || '',
        is_corretor: cliente.is_corretor || false,
      };
    });
  }, [clientes, negociacoes]);

  // Permissões baseadas nas funções
  const isDiretor = perfil?.is_diretor;
  const isGerente = perfil?.is_gerente;
  const isCorretor = perfil?.is_corretor;

  // Identifica o módulo na aba do navegador. Calculado aqui (antes de qualquer return
  // condicional) para não violar a ordem dos hooks do React.
  useEffect(() => {
    const ehCaptacao = tab === 'captacao' && !!(perfil && perfil.is_diretor);
    document.title = ehCaptacao ? 'Captação OLX — Inerente' : 'CRM Imobiliário — Inerente';
  }, [tab, perfil]);
  const isEscritorio = perfil?.is_escritorio;
  const podeEditar = isDiretor || isGerente || isCorretor; // escritório só visualiza
  const podeContrato = isDiretor || isGerente; // quem pode fechar venda / gerar contrato

  async function handleSave(form) {
    if (!podeEditar) return alert('Sem permissão para editar.');
    const { clienteData, negociacaoData } = splitForm(form);
    const editNegId = form.negociacao_id || null;
    const editClienteId = form.cliente_real_id || null;

    if (editNegId && editClienteId) {
      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from('clientes').update(clienteData).eq('id', editClienteId),
        supabase.from('negociacoes').update(negociacaoData).eq('id', editNegId),
      ]);
      if (e1 || e2) return alert('Erro ao salvar: ' + (e1 || e2).message);
    } else {
      if (!isGerente) {
        negociacaoData.corretor_id = perfil.id;
        negociacaoData.corretor = perfil.nome;
        negociacaoData.corretor_original_id = perfil.id;
        negociacaoData.corretor_original = perfil.nome;
      } else {
        negociacaoData.corretor_original_id = negociacaoData.corretor_id;
        negociacaoData.corretor_original = negociacaoData.corretor;
      }
      // Verifica se cliente já existe
      if (editClienteId) {
        // Cliente já existe, só cria negociação
        const { error: e2 } = await supabase.from('negociacoes').insert({ ...negociacaoData, cliente_id: editClienteId });
        if (e2) return alert('Erro ao inserir tratativa: ' + e2.message);
      } else {
        // O cliente novo herda o dono (corretor_id) da negociação, para o RLS saber de quem ele é.
        const clientePayload = { ...clienteData, corretor_id: negociacaoData.corretor_id || perfil.id };
        const { data: novoCliente, error: e1 } = await supabase.from('clientes').insert(clientePayload).select().single();
        if (e1) return alert('Erro ao inserir cliente: ' + e1.message);
        const { error: e2 } = await supabase.from('negociacoes').insert({ ...negociacaoData, cliente_id: novoCliente.id });
        if (e2) return alert('Erro ao inserir tratativa: ' + e2.message);
      }
    }
    localStorage.removeItem('crm_rascunho');
    setModal(null);
    await load();
  }

  async function handleNovaNegociacao(clienteRealId) {
    const cliente = clientes.find(c => c.id === clienteRealId);
    if (!cliente) return;
    setModal({ cliente, negociacao: null, novaNegociacao: true });
  }

  async function handleDelete(negId) {
    if (!podeEditar) return;
    const neg = negociacoes.find(n => n.id === negId);
    const div = Array.isArray(neg?.tratativa_divisao) ? neg.tratativa_divisao : [];
    const souParticipante = !!(perfil?.id && div.some(d => d.id === perfil.id));
    // Regra da divisão: com 2+ participantes, "excluir" = SAIR do atendimento — ele volta
    // 100% pro(s) outro(s). A exclusão de verdade só acontece quando resta 1 participante
    // (ou quando quem exclui não participa da divisão — ex.: diretor).
    if (souParticipante && div.length > 1) {
      const resto = div.filter(d => d.id !== perfil.id).map(d => ({ ...d }));
      const eq = Math.floor(100 / resto.length);
      resto.forEach((d, i) => { d.pct = (i === 0) ? (100 - eq * (resto.length - 1)) : eq; });
      const novaEstrela = (neg.tratativa_dono_edicao && resto.some(d => d.id === neg.tratativa_dono_edicao))
        ? neg.tratativa_dono_edicao : resto[0].id;
      const updates = { tratativa_divisao: resto, tratativa_dono_edicao: novaEstrela };
      // Se quem saiu era o corretor responsável, o atendimento passa pro primeiro que ficou.
      if (neg.corretor_id === perfil.id) {
        updates.corretor_id = resto[0].id;
        updates.corretor = resto[0].nome;
      }
      const { error } = await supabase.from('negociacoes').update(updates).eq('id', negId);
      if (error) return alert('Erro ao sair do atendimento: ' + error.message);
      alert('Você saiu deste atendimento. Ele agora é 100% de: ' + resto.map(d => d.nome).join(' e ') + '.');
      await load();
      return;
    }
    const { error: err } = await supabase.from('negociacoes').delete().eq('id', negId);
    if (err) return alert('Erro ao excluir: ' + err.message);
    await load();
  }

  async function handleToggleFunil(negId, etapaOuUpdates, val) {
    if (!podeEditar) return;
    const updates = typeof etapaOuUpdates === 'object' ? etapaOuUpdates : { [etapaOuUpdates]: val };
    const { error: err } = await supabase.from('negociacoes').update(updates).eq('id', negId);
    if (err) return alert('Erro: ' + err.message);
    setNegociacoes(n => n.map(neg => neg.id === negId ? { ...neg, ...updates } : neg));
  }

  async function handleDevolver(negId) {
    const { error } = await supabase.from('negociacoes').update({ recebido: false, recebimento: false }).eq('id', negId);
    if (error) return alert('Erro: ' + error.message);
    await load();
  }

  // Devolve um lead da lista direto pra Captação (marca como "fora do perfil") e remove a tratativa.
  async function handleDevolverCaptacao(c) {
    if (!podeEditar || !c || !c.id) return;
    if (!window.confirm('Devolver este lead para a Captação como "fora do perfil" e remover esta tratativa?')) return;
    const tail = String(c.telefone || '').replace(/\D/g, '').slice(-8);
    if (tail.length >= 8) {
      const { data: leads } = await supabase.from('leads_captacao').select('id').ilike('telefone', '%' + tail + '%');
      const ids = (leads || []).map(r => r.id);
      if (ids.length) await supabase.from('leads_captacao').update({ campanha_status: 'descartado', virou_cliente: false }).in('id', ids);
    }
    await handleDelete(c.id);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setClientes([]); setNegociacoes([]); setPerfil(null);
  }

  function handleSetAbaFunil(aba) {
    setAbaFunil(aba);
    localStorage.setItem('crm_funil_aba', aba);
  }

  function handleVerTratativas(clienteId) {
    setFiltroClienteId(clienteId);
    setTab('tratativas');
  }

  const stats = useMemo(() => ({
    total: data.filter(c => c.ativo === 'S').length,
    // Procuras: quem busca imóvel (Comprador + Locatário, cobrindo nomes legados via normModalidade)
    procuras: data.filter(c => c.ativo === 'S' && ['Comprador', 'Locatário'].includes(normModalidade(c.modalidade))).length,
    // Captações: quem tem imóvel (Vendedor + Locador + legados)
    captacoes: data.filter(c => c.ativo === 'S' && ehCaptacao(c.modalidade)).length,
    contratos: data.filter(c => c.contrato).length,
  }), [data]);

  if (checkingAuth) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#9ca3af' }}>Carregando...</div>
  );

  if (!session || !perfil) return <LoginScreen />;

  // Abas por função
  const todasAbas = [
    ['tratativas', 'Tratativas'],
    ['funil', 'Funil'],
    ['vendas', '🏠 Captações'],
    ['secretaria', '📊 Secretaria', 'gerente'],
    ['dash', 'Dashboard'],
    ['recebidos', '💰 Recebidos'],
    ['inativos', 'Finalizadas'],
    ['resumo', '📋 Demandas'],
    ['transferencias', '🔄 Transferências'],
    ['clientes', '👤 Clientes'],
    ['importacao', '📥 Importar', 'diretor'],
    ['config', '⚙️ Config'],
    ['backup', '💾 Backup', 'diretor'],
    ['perfil', '👤 Perfil'],
  ];

  const tabs = todasAbas.filter(([, , acesso]) => {
    if (!acesso) return true;
    if (acesso === 'diretor') return isDiretor;
    if (acesso === 'gerente') return isDiretor || isGerente;
    if (acesso === 'gerente_corretor') return isDiretor || isGerente || isCorretor;
    return true;
  });

  const funcaoLabel = isDiretor ? 'Diretor' : isGerente ? 'Gerente' : isCorretor ? 'Corretor' : isEscritorio ? 'Escritório' : '';
  const funcaoCor = isDiretor ? '#dc2626' : isGerente ? '#2563eb' : isCorretor ? '#059669' : '#7c3aed';

  // Modo captação: tela cheia, sem a moldura do CRM (header/abas/stats).
  // Vira módulo próprio quando aberto pelo card 'Captação OLX' (?tab=captacao).
  const modoCaptacao = tab === 'captacao' && isDiretor;

  return (
    <div className="app-shell">
      {!modoCaptacao && (<>
      <header className="header">
        <div className="header-logo">CRM <span>Imobiliário</span></div>
        <nav className="tab-nav">
          {tabs.map(([t, l]) => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); localStorage.setItem('crm_tab', t); localStorage.removeItem('cap_modo'); setFiltroClienteId(null); }}>{l}</button>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {perfil.nome} · <span style={{ color: funcaoCor, fontWeight: 600 }}>{funcaoLabel}</span>
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
        <div className="stat-item"><span className="stat-label">Tratativas</span><span className="stat-value stat-blue">{stats.total}</span></div>
        <div className="stat-item"><span className="stat-label">Procuras</span><span className="stat-value stat-green">{stats.procuras}</span></div>
        <div className="stat-item"><span className="stat-label">Captações</span><span className="stat-value stat-orange">{stats.captacoes}</span></div>
        <div className="stat-item"><span className="stat-label">Contratos</span><span className="stat-value stat-green">{stats.contratos}</span></div>
      </div>
      </>)}

      {error && <div className="error-banner">⚠️ Erro de conexão: {error}</div>}

      <main className="main">
        {loading ? <div className="loading">Carregando dados...</div> : (
          <>
            {tab === 'clientes' && <ClientesTab clientes={clientes} negociacoes={negociacoes} onVerTratativas={handleVerTratativas} onNovaTratativa={podeEditar ? handleNovaNegociacao : null} onReload={load} perfil={perfil} />}
            {tab === 'captacao' && isDiretor && <CaptacaoTab perfil={perfil} onAtualizar={load} />}
            {tab === 'tratativas' && <CRMTab
              data={filtroClienteId ? data.filter(c => c.cliente_real_id === filtroClienteId && c.ativo === 'S' && !c.recebido && !c.captado) : data.filter(c => c.ativo === 'S' && !c.recebido && !c.captado)}
              todosData={data}
              onOpenModal={podeEditar ? setModal : null}
              onDelete={podeEditar ? handleDelete : null}
              onToggleFunil={handleToggleFunil}
              onNovaNegociacao={podeEditar ? handleNovaNegociacao : null}
              isGerente={isGerente}
              podeContrato={podeContrato}
              filtroClienteNome={filtroClienteId ? clientes.find(c => c.id === filtroClienteId)?.nome : null}
              onLimparFiltro={() => setFiltroClienteId(null)}
            />}
            {tab === 'funil' && <FunilTab data={data.filter(c => c.ativo === 'S' && !c.recebido && !c.captado)} onOpenModal={podeEditar ? setModal : null} onMoverCard={(id, updates) => setNegociacoes(n => n.map(neg => neg.id === id ? { ...neg, ...updates } : neg))} abaFunil={abaFunil} onSetAbaFunil={handleSetAbaFunil} podeContrato={podeContrato} perfil={perfil} onReload={load} />}
            {tab === 'vendas' && <VendasTab data={data} onOpenModal={podeEditar ? setModal : null} onToggleFunil={handleToggleFunil} onDelete={podeEditar ? handleDelete : null} onDevolverCaptacao={podeEditar ? handleDevolverCaptacao : null} />}
            {tab === 'secretaria' && <SecretariaTab />}
            {tab === 'dash' && <DashboardTab data={data} />}
            {tab === 'recebidos' && <RecebidosTab data={data} onOpenModal={podeEditar ? setModal : null} onDevolver={podeEditar ? handleDevolver : null} />}
            {tab === 'inativos' && <InativosTab data={data.filter(c => c.ativo === 'N' && !c.captado)} onOpenModal={podeEditar ? setModal : null} onDelete={podeEditar ? handleDelete : null} />}
            {tab === 'resumo' && <ResumoDemandasTab data={data} darkMode={darkMode} perfil={perfil} onToggleParceria={(id, val) => setNegociacoes(n => n.map(neg => neg.id === id ? { ...neg, solicitar_parceria: val } : neg))} />}
            {tab === 'importacao' && (isGerente || isCorretor) && <ImportacaoTab perfil={perfil} darkMode={darkMode} onImportSuccess={load} />}
            {tab === 'config' && <ConfigTab perfil={perfil} />}
            {tab === 'backup' && isGerente && <BackupTab />}
            {tab === 'perfil' && <PerfilTab perfil={perfil} onUpdate={setPerfil} />}
            {tab === 'transferencias' && <TransferenciasTab perfil={perfil} />}
          </>
        )}
      </main>

      {modal !== null && podeEditar && (
        <ClienteModal
          modal={modal}
          onSave={handleSave}
          onClose={() => { localStorage.removeItem('crm_rascunho'); setModal(null); }}
          perfil={perfil}
          onDelete={podeEditar ? handleDelete : null}
        />
      )}

      {/* Botão flutuante global — Nova Tratativa */}
      {!modoCaptacao && podeEditar && modal === null && (
        <button
          onClick={() => setModal('new')}
          title="Nova Tratativa"
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 999,
            width: 56, height: 56, borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff', border: 'none', fontSize: 26, fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 4px 20px rgba(37,99,235,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(37,99,235,0.65)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(37,99,235,0.5)'; }}
        >
          +
        </button>
      )}
    </div>
  );
}
