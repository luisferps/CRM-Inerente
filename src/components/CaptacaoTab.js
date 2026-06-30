import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

// ───────────────────────────────────────────────────────────────────────────
// Aba "Captação OLX" — leads do OLX + campanha de abordagem (SDR outbound).
// Redesign Apple (jun/2026): 2 sub-telas (Leads do OLX · Campanha), tabela
// enxuta + painel de detalhe ao clicar, busca na fila, filtro de preço por
// faixa, furar fila (prioridade) e idade do lead. Toda a lógica de dados foi
// preservada (funil, config da campanha, virar cliente, mudanças de status).
// REGRA DE OURO: nada vira cliente automaticamente (só no botão "→ Virar cliente").
// ───────────────────────────────────────────────────────────────────────────

const BACKEND = 'https://agentes-de-whatsapp-production.up.railway.app';

// Telefone padrão: 11 dígitos (DDD + número), sem o 55. O 55 entra só no envio ao WhatsApp.
function so11(x) {
  let d = String(x == null ? '' : x).replace(/\D/g, '');
  if (d.length >= 12 && d.length <= 13 && d.slice(0, 2) === '55') d = d.slice(2);
  return d;
}

const _norm = (x) => String(x == null ? '' : x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function tipoIdDoLead(lead, tipos) {
  const t = _norm((lead && (lead.subtipo || lead.tipo)) || '');
  let alvo = null;
  if (/(terreno|lote)/.test(t)) alvo = 'lote';
  else if (/(apart|apto|flat|kitnet|kitinete|studio|cobertura)/.test(t)) alvo = 'apartamento';
  else if (/(casa|sobrado|geminad)/.test(t)) alvo = 'casa';
  else if (/(galp|comerc|loja|sala|ponto|industr|barrac|predio|pr[ée]dio)/.test(t)) alvo = 'galpao';
  else if (/(area|rural|chacara|sitio|fazenda|gleba)/.test(t)) alvo = 'area';
  if (!alvo) return null;
  const lista = tipos || [];
  const found = lista.find(x => _norm(x.nome) === alvo) || lista.find(x => _norm(x.nome).indexOf(alvo) >= 0);
  return found ? found.id : null;
}

function parseNum(v) {
  if (v == null) return null;
  const s = String(v).replace(/\D/g, '');
  if (s === '') return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

// dias desde a captura (pra "idade do lead")
function diasDesde(l) {
  if (!l || !l.data_captura) return null;
  const d = Math.floor((Date.now() - new Date(l.data_captura).getTime()) / 86400000);
  return isNaN(d) ? null : d;
}

// paleta Apple / Inerente
const C = {
  red: '#C0392B', redD: '#922B21', tint: '#FADBD8',
  ink: '#1d1d1f', ink2: '#6e6e73', ink3: '#86868b',
  line: '#e8e8ed', line2: '#f0f0f3', bg: '#f5f5f7', card: '#fff',
  green: '#1fa463', amber: '#e0a31a', blue: '#2563eb',
};
const SHADOW = '0 1px 2px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.05)';

const CAMP_COR = { '': '#9ca3af', fila: '#2563eb', enviado: '#138a52', respondido: '#0a7ea4', expirado: '#94a3b8', corretor: '#9333ea', descartado: '#6b7280', optout: '#b91c1c', qualificando: '#0ea5e9' };
const CAMP_LABEL = { '': '— pendente', fila: '⏳ na fila', enviado: '📨 abordado', respondido: '💬 andamento', expirado: '⌛ não respondeu', corretor: '👔 corretor', descartado: '🚫 fora do perfil', optout: '⛔ opt-out', qualificando: '❓ qualificando' };
const CAMP_BG = { '': '#f0f0f3', fila: '#e8efff', enviado: '#e3f6ec', respondido: '#e4f4f8', expirado: '#eef0f3', corretor: '#f3e8ff', descartado: '#f0f0f3', optout: '#fde8e8', qualificando: '#e2f4fb' };

export default function CaptacaoTab({ perfil, onAtualizar }) {
  const [leads, setLeads] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [promovendo, setPromovendo] = useState(null);
  const [enviandoId, setEnviandoId] = useState(null);
  const [priId, setPriId] = useState(null);

  const [subtela, setSubtela] = useState('olx');     // 'olx' | 'camp'
  const [view, setView] = useState('pendentes');
  const [busca, setBusca] = useState('');
  const [precoMin, setPrecoMin] = useState('');
  const [precoMax, setPrecoMax] = useState('');
  const [selec, setSelec] = useState(new Set());
  const [tiposCRM, setTiposCRM] = useState([]);
  const [detalheId, setDetalheId] = useState(null);  // drawer aberto

  // ordenação
  const [sortCol, setSortCol] = useState('data_captura');
  const [sortDir, setSortDir] = useState('desc');

  // campanha (backend)
  const [cfg, setCfg] = useState(null);
  const [stat, setStat] = useState(null);
  const [form, setForm] = useState(null);
  const [msgForm, setMsgForm] = useState({ msg1: '', msg2intro: '' });
  const [testeNum, setTesteNum] = useState('');
  const [funil, setFunil] = useState(null);
  const [funilDias, setFunilDias] = useState(30);

  // disparo manual avulso
  const [dispNum, setDispNum] = useState('');
  const [dispUrl, setDispUrl] = useState('');
  const [disparando, setDisparando] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro('');
    const { data, error } = await supabase
      .from('leads_captacao').select('*').order('data_captura', { ascending: false });
    if (error) setErro(error.message);
    else setLeads(data || []);
    setCarregando(false);
  }

  async function carregarCampanha() {
    try {
      const [c, s] = await Promise.all([
        fetch(BACKEND + '/captacao/config').then(r => r.json()),
        fetch(BACKEND + '/captacao/status').then(r => r.json()),
      ]);
      setCfg(c); setStat(s);
      setForm({
        maxDia: c.maxDia,
        pausaMin: Math.round(c.pausaMin / 60), pausaMax: Math.round(c.pausaMax / 60),
        longaMin: Math.round(c.longaMin / 60), longaMax: Math.round(c.longaMax / 60),
        longaCada: c.longaCada, horaIni: c.horaIni, horaFim: c.horaFim, instancia: c.instancia || '', expiraHoras: c.expiraHoras || 48,
        diasSemana: Array.isArray(c.diasSemana) ? c.diasSemana : [1, 2, 3, 4, 5, 6],
      });
      setMsgForm({ msg1: c.msg1 || '', msg2intro: c.msg2intro || '' });
    } catch (e) { /* backend offline */ }
  }

  async function carregarTipos() {
    const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'imoveis').single();
    const v = data && data.valor;
    const lista = Array.isArray(v && v.tipos) ? v.tipos
      : (Array.isArray(v) ? v.map(n => ({ id: String(n), nome: String(n) })) : []);
    setTiposCRM(lista);
  }

  useEffect(() => { carregar(); carregarCampanha(); carregarTipos(); }, []);
  useEffect(() => {
    let vivo = true;
    fetch(BACKEND + '/captacao/painel-dados?dias=' + funilDias)
      .then(r => r.json()).then(d => { if (vivo && d && d.ok) setFunil(d); }).catch(() => {});
    return () => { vivo = false; };
  }, [funilDias]);

  const cont = useMemo(() => {
    const c = { '': 0, fila: 0, enviado: 0, qualificando: 0, respondido: 0, descartado: 0, optout: 0, corretor: 0, expirado: 0 };
    leads.forEach(l => { const st = l.campanha_status || ''; if (c[st] !== undefined) c[st]++; });
    return c;
  }, [leads]);

  function passaView(l) {
    const s = l.campanha_status || '';
    if (view === 'pendentes') return s === '';
    if (view === 'fila') return s === 'fila';
    if (view === 'g_abordados') return ['enviado', 'qualificando', 'respondido'].includes(s);
    if (view === 'andamento') return s === 'respondido';
    if (view === 'g_descartados') return ['descartado', 'optout', 'corretor', 'expirado'].includes(s);
    return true; // 'todos'
  }

  const filtrados = useMemo(() => {
    const bq = busca.trim().toLowerCase();
    const bdig = bq.replace(/\D/g, '');
    const min = parseNum(precoMin), max = parseNum(precoMax);
    return leads.filter(l => {
      if (!passaView(l)) return false;
      if (min != null || max != null) {
        const p = parseNum(l.preco);
        if (p == null) return false;
        if (min != null && p < min) return false;
        if (max != null && p > max) return false;
      }
      if (bq) {
        // busca na fila: telefone, nome, tipo, subtipo, cidade, setor, transação
        const tel = String(l.telefone || '').replace(/\D/g, '');
        const campos = _norm([l.nome, l.tipo, l.subtipo, l.cidade, l.setor, l.transacao, l.regiao, l.subregiao].filter(Boolean).join(' '));
        const achouTexto = campos.includes(_norm(bq));
        const achouTel = bdig && tel.includes(bdig);
        if (!achouTexto && !achouTel) return false;
      }
      return true;
    });
  }, [leads, view, busca, precoMin, precoMax]);

  const numericas = ['preco', 'quartos', 'vagas', 'area', 'data_captura'];
  const ordenados = useMemo(() => {
    const arr = [...filtrados];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      // furados sempre no topo (espelha a fila do backend: prioridade desc)
      const pa = a.prioridade || 0, pb = b.prioridade || 0;
      if (pa !== pb) return pb - pa;
      if (sortCol === 'data_captura') {
        return (new Date(a.data_captura || 0) - new Date(b.data_captura || 0)) * dir;
      }
      if (numericas.includes(sortCol)) {
        const na = parseNum(a[sortCol]), nb = parseNum(b[sortCol]);
        return ((na == null ? -Infinity : na) - (nb == null ? -Infinity : nb)) * dir;
      }
      return String(a[sortCol] || '').localeCompare(String(b[sortCol] || ''), 'pt-BR', { numeric: true }) * dir;
    });
    return arr;
  }, [filtrados, sortCol, sortDir]);

  function clicarCab(key) {
    if (sortCol === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(key); setSortDir(key === 'data_captura' ? 'desc' : 'asc'); }
  }
  function seta(key) { return sortCol !== key ? '' : (sortDir === 'asc' ? ' ↑' : ' ↓'); }

  // ─── seleção ───
  function toggleSel(id) { setSelec(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleTodos() {
    setSelec(s => {
      const visiveis = ordenados.map(l => l.id);
      const todosM = visiveis.length > 0 && visiveis.every(id => s.has(id));
      return todosM ? new Set() : new Set(visiveis);
    });
  }
  const idsSelec = [...selec];

  // ─── mudanças de status de campanha (direto no Supabase) ───
  async function mudarCampanha(ids, novo) {
    let alvo = ids;
    if (novo === 'fila') alvo = ids.filter(id => { const l = leads.find(x => x.id === id); return l && !l.virou_cliente; });
    if (!alvo.length) return;
    const { error } = await supabase.from('leads_captacao').update({ campanha_status: novo }).in('id', alvo);
    if (error) { alert('Erro: ' + error.message); return; }
    setLeads(ls => ls.map(l => alvo.includes(l.id) ? { ...l, campanha_status: novo } : l));
    setSelec(new Set());
    carregarCampanha();
  }

  async function salvarObs(lead, txt) {
    const { error } = await supabase.from('leads_captacao').update({ observacoes: txt }).eq('id', lead.id);
    if (error) { alert('Erro: ' + error.message); return; }
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, observacoes: txt } : l));
  }
  async function excluir(lead) {
    if (!window.confirm('EXCLUIR de vez este lead? (pra só tirar da vista use "Fora do perfil")')) return;
    const { error } = await supabase.from('leads_captacao').delete().eq('id', lead.id);
    if (error) { alert('Erro: ' + error.message); return; }
    setLeads(ls => ls.filter(l => l.id !== lead.id));
    setDetalheId(null);
  }

  // ─── furar fila (prioridade) ───
  async function furarFila(lead) {
    setPriId(lead.id);
    try {
      const r = await fetch(BACKEND + '/captacao/priorizar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.id, prioridade: 1 }) });
      const j = await r.json();
      if (!j.ok) { alert('Não consegui furar a fila.'); return; }
      const novo = { prioridade: 1 };
      if (lead.campanha_status !== 'fila' && !lead.virou_cliente) {
        await supabase.from('leads_captacao').update({ campanha_status: 'fila' }).eq('id', lead.id);
        novo.campanha_status = 'fila';
      }
      setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, ...novo } : l));
      carregarCampanha();
    } catch (e) { alert('Erro de rede: ' + e.message); }
    finally { setPriId(null); }
  }
  async function tirarPrioridade(lead) {
    setPriId(lead.id);
    try {
      await fetch(BACKEND + '/captacao/priorizar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.id, prioridade: 0 }) });
      setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, prioridade: 0 } : l));
    } catch (e) { /* silencioso */ }
    finally { setPriId(null); }
  }
  async function furarFilaMass(ids) {
    for (const id of ids) { const l = leads.find(x => x.id === id); if (l) await furarFila(l); }
    setSelec(new Set());
  }

  // ─── abordar agora (backend, com trava) ───
  async function abordarAgora(lead) {
    if (!window.confirm('Enviar a abordagem AGORA para ' + lead.telefone + '?')) return;
    setEnviandoId(lead.id);
    try {
      const r = await fetch(BACKEND + '/captacao/abordar-agora', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.id }),
      });
      const j = await r.json();
      if (j.ok) {
        setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, campanha_status: 'enviado', campanha_enviado_em: new Date().toISOString() } : l));
        carregarCampanha();
        alert('✓ Abordagem enviada!');
      } else if (j.motivo === 'trava') alert('Aguarde ~' + Math.ceil((j.esperar_seg || 0) / 60) + ' min. A trava antiban evita rajada.');
      else if (j.motivo === 'limite_dia') alert('Teto de hoje atingido (' + j.maxDia + '). Aumente no painel ou tente amanhã.');
      else if (j.motivo === 'optout') alert('Esse contato pediu opt-out — não vou enviar.');
      else if (j.motivo === 'ja_enviado') alert('Esse lead já foi abordado.');
      else if (j.motivo === 'sem_numero') alert('Lead sem número válido.');
      else alert('Não enviou (' + (j.motivo || 'erro') + ').');
    } catch (e) { alert('Erro de rede com o backend: ' + e.message); }
    finally { setEnviandoId(null); }
  }

  // ─── disparo manual avulso (número + link) ───
  async function dispararManual() {
    const numero = (dispNum || '').replace(/\D/g, '');
    if (!numero) { alert('Informe o número (com DDD).'); return; }
    setDisparando(true);
    try {
      const r = await fetch(BACKEND + '/captacao/disparo-manual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero, url: dispUrl || '' }),
      });
      const j = await r.json();
      if (j.ok) { alert('✓ Disparo enviado!'); setDispNum(''); setDispUrl(''); }
      else if (j.motivo === 'optout') alert('Esse número pediu opt-out — não enviei.');
      else if (j.motivo === 'sem_numero') alert('Número inválido.');
      else alert('Não enviou (' + (j.motivo || 'erro') + ').');
    } catch (e) { alert('Erro de rede: ' + e.message); }
    finally { setDisparando(false); }
  }

  // ─── virar cliente ───
  function valorNumerico(p) { if (!p) return null; const n = Number(String(p).replace(/\D/g, '')); return isNaN(n) || n === 0 ? null : n; }
  function montarResumoImovel(l) {
    const p = [];
    if (l.subtipo || l.tipo) p.push(l.subtipo || l.tipo);
    if (l.transacao) p.push(l.transacao);
    if (l.preco) p.push(l.preco);
    if (l.quartos) p.push(l.quartos + ' qto');
    if (l.area) p.push(l.area);
    const loc = [l.setor, l.cidade, l.estado].filter(Boolean).join(', ');
    let s = '[Captado OLX] ' + p.join(' · ');
    if (loc) s += ' — ' + loc;
    if (l.url) s += '\n' + l.url;
    return s;
  }
  async function virarCliente(lead) {
    if (lead.virou_cliente) { alert('Este lead já virou cliente.'); return; }
    if (!window.confirm('Promover a cliente + demanda no CRM?\n\n' + (lead.nome || '(sem nome)') + ' · ' + lead.telefone)) return;
    setPromovendo(lead.id);
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const tel = so11(lead.telefone);
      const tail8 = tel.slice(-8);
      const { data: existentes, error: eb } = await supabase.from('clientes').select('id').ilike('telefone', '%' + tail8 + '%').limit(1);
      if (eb) throw eb;
      let clienteId;
      if (existentes && existentes.length) clienteId = existentes[0].id;
      else {
        const { data: cli, error: e1 } = await supabase.from('clientes')
          .insert([{ nome: lead.nome || ('Proprietário ' + tel), telefone: tel, entrada: hoje, origem: 'OLX', is_corretor: false }])
          .select().single();
        if (e1) throw e1;
        clienteId = cli.id;
      }
      const negociacao = {
        cliente_id: clienteId, modalidade: 'Venda', origem_tratativa: 'OLX',
        imovel: [lead.subtipo || lead.tipo, lead.transacao].filter(Boolean).join(' - ') || 'Imóvel OLX',
        localizacao: [lead.setor, lead.cidade, lead.estado].filter(Boolean).join(', ') || null,
        tipo_id: tipoIdDoLead(lead, tiposCRM) || null,
        detalhes: montarResumoImovel(lead), valor: valorNumerico(lead.preco), ativo: 'S', captado: false, ficha: lead.ficha || null,
      };
      if (perfil && perfil.id) { negociacao.corretor_id = perfil.id; negociacao.corretor = perfil.nome; negociacao.corretor_original_id = perfil.id; negociacao.corretor_original = perfil.nome; }
      const { error: e2 } = await supabase.from('negociacoes').insert([negociacao]);
      if (e2) throw e2;
      const { error: e3 } = await supabase.from('leads_captacao').update({ status: 'virou_cliente', virou_cliente: true, campanha_status: 'respondido' }).eq('id', lead.id);
      if (e3) throw e3;
      setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, status: 'virou_cliente', virou_cliente: true, campanha_status: 'respondido' } : l));
      if (onAtualizar) onAtualizar();
      alert('✓ Cliente e demanda criados (Tratativas/Funil, origem OLX).');
    } catch (err) { alert('Não consegui promover.\n\n' + err.message); }
    finally { setPromovendo(null); }
  }

  function exportarCSV() {
    if (!ordenados.length) { alert('Nada pra exportar.'); return; }
    const cols = ['telefone', 'nome', 'tipo', 'subtipo', 'transacao', 'preco', 'quartos', 'vagas', 'area', 'estado', 'regiao', 'subregiao', 'cidade', 'setor', 'campanha_status', 'observacoes', 'url', 'data_captura'];
    const linhas = [cols];
    ordenados.forEach(l => linhas.push(cols.map(c => l[c] == null ? '' : String(l[c]))));
    const csv = linhas.map(l => l.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'captacao-olx.csv'; a.click();
  }

  // ─── campanha: salvar config / mensagens / teste / liga-desliga ───
  async function postConfig(patch) {
    try {
      const r = await fetch(BACKEND + '/captacao/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const j = await r.json();
      if (j.config) setCfg(j.config);
      carregarCampanha();
      return true;
    } catch (e) { alert('Erro de rede com o backend: ' + e.message); return false; }
  }
  async function toggleAtivo() { if (!cfg) return; await postConfig({ ativo: !cfg.ativo }); }
  async function salvarAntiban() {
    if (!form) return;
    await postConfig({
      maxDia: Number(form.maxDia), pausaMin: Number(form.pausaMin) * 60, pausaMax: Number(form.pausaMax) * 60,
      longaMin: Number(form.longaMin) * 60, longaMax: Number(form.longaMax) * 60,
      longaCada: Number(form.longaCada), horaIni: Number(form.horaIni), horaFim: Number(form.horaFim), instancia: form.instancia, expiraHoras: Number(form.expiraHoras),
      diasSemana: Array.isArray(form.diasSemana) ? form.diasSemana : [1, 2, 3, 4, 5, 6],
    });
    alert('Ritmo & janela salvos.');
  }
  async function salvarMensagens() { await postConfig({ msg1: msgForm.msg1, msg2intro: msgForm.msg2intro }); alert('Mensagens salvas.'); }
  async function testarNoMeu() {
    const numero = testeNum.replace(/\D/g, '');
    if (!numero) { alert('Digite seu número (55 + DDD + número).'); return; }
    try {
      const r = await fetch(BACKEND + '/captacao/testar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ numero }) });
      const j = await r.json();
      alert(j.ok ? '✓ Teste enviado pro seu WhatsApp!' : 'Falhou: ' + (j.error || j.motivo || '?'));
    } catch (e) { alert('Erro de rede: ' + e.message); }
  }

  const setF = (k, v) => setForm(o => ({ ...o, [k]: v }));
  const DIAS_LABEL = [['Dom', 0], ['Seg', 1], ['Ter', 2], ['Qua', 3], ['Qui', 4], ['Sex', 5], ['Sáb', 6]];
  function toggleDia(n) {
    setForm(o => {
      const atual = Array.isArray(o.diasSemana) ? o.diasSemana.slice() : [1, 2, 3, 4, 5, 6];
      const i = atual.indexOf(n);
      if (i >= 0) atual.splice(i, 1); else atual.push(n);
      atual.sort((a, b) => a - b);
      return { ...o, diasSemana: atual };
    });
  }

  const det = detalheId ? leads.find(l => l.id === detalheId) : null;

  // ─── estilos base (Apple) ───
  const S = {
    page: { background: C.bg, minHeight: '100vh', padding: '0 0 80px' },
    wrap: { maxWidth: 1120, margin: '0 auto', padding: '0 20px' },
    seg: { display: 'inline-flex', background: '#ececf0', borderRadius: 12, padding: 4, gap: 4, margin: '20px 0 16px' },
    segBtn: (on) => ({ border: 0, background: on ? C.card : 'transparent', color: on ? C.ink : C.ink2, fontWeight: 600, fontSize: 13.5, padding: '8px 18px', borderRadius: 9, cursor: 'pointer', boxShadow: on ? '0 1px 3px rgba(0,0,0,.12)' : 'none', display: 'flex', alignItems: 'center', gap: 7 }),
    chip: (on) => ({ border: '1px solid ' + (on ? C.ink : C.line), background: on ? C.ink : C.card, color: on ? '#fff' : C.ink2, borderRadius: 999, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }),
    chipN: (on) => ({ background: on ? 'rgba(255,255,255,.22)' : '#f0f0f3', color: on ? '#fff' : C.ink2, borderRadius: 999, padding: '1px 8px', fontSize: 11 }),
    card: { background: C.card, border: '1px solid ' + C.line, borderRadius: 18, boxShadow: SHADOW, overflow: 'hidden' },
    toolbar: { background: C.card, border: '1px solid ' + C.line, borderRadius: 18, padding: 14, boxShadow: SHADOW, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 },
    inp: { border: '1px solid ' + C.line, background: '#fafafd', borderRadius: 11, padding: '10px 12px', font: 'inherit', fontSize: 13.5, color: C.ink, boxSizing: 'border-box' },
    th: { textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: C.ink3, padding: '13px 16px', borderBottom: '1px solid ' + C.line, whiteSpace: 'nowrap', background: '#fbfbfd', cursor: 'pointer', userSelect: 'none' },
    td: { padding: '14px 16px', borderBottom: '1px solid ' + C.line2, fontSize: 13.5, verticalAlign: 'middle' },
    btn: (bg, fg) => ({ border: 0, borderRadius: 12, padding: '11px 14px', font: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: bg, color: fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }),
    btnSm: (bg, fg) => ({ border: 0, borderRadius: 9, padding: '7px 12px', font: 'inherit', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', background: bg, color: fg }),
    sect: { background: C.card, border: '1px solid ' + C.line, borderRadius: 18, padding: 20, boxShadow: SHADOW, marginBottom: 14 },
    fl: { display: 'block', fontSize: 12, fontWeight: 700, color: C.ink2, margin: '0 0 6px' },
    mini: { background: C.card, border: '1px solid ' + C.line, borderRadius: 18, padding: '16px 18px', boxShadow: SHADOW },
  };

  function badge(s) {
    return <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '4px 11px', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', background: CAMP_BG[s] || '#f0f0f3', color: CAMP_COR[s] || C.ink2 }}>{CAMP_LABEL[s]}</span>;
  }
  function idade(l) {
    const d = diasDesde(l);
    if (d == null) return <span style={{ color: C.ink3 }}>—</span>;
    const cor = d >= 5 ? C.red : (d >= 3 ? C.amber : C.green);
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 12.5, color: d >= 5 ? C.red : C.ink, whiteSpace: 'nowrap' }}><span style={{ width: 9, height: 9, borderRadius: 9, background: cor, display: 'inline-block' }} />{d}d</span>;
  }

  // chips de status
  const CHIPS = [
    ['pendentes', 'Pendentes', cont['']],
    ['fila', 'Na fila', cont.fila],
    ['g_abordados', 'Abordados', cont.enviado + cont.qualificando + cont.respondido],
    ['andamento', 'Em andamento', cont.respondido],
    ['g_descartados', 'Descartados', cont.descartado + cont.optout + cont.corretor + cont.expirado],
    ['todos', 'Todos', leads.length],
  ];

  return (
    <div style={S.page}>
      <div style={S.wrap}>

        {/* sub-telas */}
        <div style={S.seg}>
          <button style={S.segBtn(subtela === 'olx')} onClick={() => setSubtela('olx')}>📍 Leads do OLX</button>
          <button style={S.segBtn(subtela === 'camp')} onClick={() => setSubtela('camp')}>📣 Campanha de abordagem</button>
        </div>

        {/* ════════════════════ TELA OLX ════════════════════ */}
        {subtela === 'olx' && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {CHIPS.map(([k, lbl, n]) => (
                <button key={k} style={S.chip(view === k)} onClick={() => { setView(k); setSelec(new Set()); }}>
                  {lbl} <span style={S.chipN(view === k)}>{n}</span>
                </button>
              ))}
            </div>

            <div style={S.toolbar}>
              <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: C.ink3 }}>🔍</span>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar na fila — bairro, tipo, telefone…  ex: terreno Jardim Marselha"
                  style={{ ...S.inp, width: '100%', paddingLeft: 38, background: '#fafafd' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.ink2, fontSize: 13, fontWeight: 600 }}>
                Preço
                <input value={precoMin} onChange={e => setPrecoMin(e.target.value)} placeholder="mín" style={{ ...S.inp, width: 104 }} />
                <span style={{ color: C.ink3 }}>—</span>
                <input value={precoMax} onChange={e => setPrecoMax(e.target.value)} placeholder="máx" style={{ ...S.inp, width: 104 }} />
              </div>
              <button style={S.btnSm('#f0f0f3', C.ink)} onClick={() => { carregar(); carregarCampanha(); }}>🔄 Atualizar</button>
              <button style={S.btnSm('#f0f0f3', C.ink)} onClick={exportarCSV}>⬇ CSV</button>
              {(busca || precoMin || precoMax) && <button style={{ border: 0, background: 'none', color: C.red, font: 'inherit', fontWeight: 600, fontSize: 13, cursor: 'pointer' }} onClick={() => { setBusca(''); setPrecoMin(''); setPrecoMax(''); }}>limpar</button>}
              <span style={{ color: C.ink3, fontSize: 13 }}>{ordenados.length} de {leads.length}</span>
            </div>

            {/* barra de seleção */}
            {idsSelec.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.ink, color: '#fff', borderRadius: 14, padding: '11px 16px', marginBottom: 12, fontSize: 13, fontWeight: 600, flexWrap: 'wrap' }}>
                <span>{idsSelec.length} selecionado{idsSelec.length > 1 ? 's' : ''}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button style={S.btnSm('rgba(255,255,255,.16)', '#fff')} onClick={() => mudarCampanha(idsSelec, 'fila')}>⏳ Mandar pra fila</button>
                  <button style={S.btnSm('rgba(255,255,255,.16)', '#fff')} onClick={() => furarFilaMass(idsSelec)}>⭐ Furar fila</button>
                  <button style={S.btnSm('rgba(255,255,255,.16)', '#fff')} onClick={() => mudarCampanha(idsSelec, 'descartado')}>🚫 Fora do perfil</button>
                  <button style={S.btnSm('rgba(255,255,255,.16)', '#fff')} onClick={() => mudarCampanha(idsSelec, null)}>↩ Tirar status</button>
                  <button style={S.btnSm('rgba(255,255,255,.1)', '#fff')} onClick={() => setSelec(new Set())}>limpar</button>
                </div>
              </div>
            )}

            {erro && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 12, marginBottom: 12, fontSize: 13 }}>Erro: {erro}</div>}
            {carregando ? <div style={{ color: C.ink2, padding: 20 }}>Carregando…</div> : (
              <div style={S.card}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...S.th, width: 42, textAlign: 'center', cursor: 'default' }}>
                        <input type="checkbox" checked={ordenados.length > 0 && ordenados.every(l => selec.has(l.id))} onChange={toggleTodos} style={{ accentColor: C.red }} />
                      </th>
                      <th style={S.th} onClick={() => clicarCab('data_captura')}>Idade{seta('data_captura')}</th>
                      <th style={S.th} onClick={() => clicarCab('subtipo')}>Imóvel{seta('subtipo')}</th>
                      <th style={S.th} onClick={() => clicarCab('preco')}>Preço{seta('preco')}</th>
                      <th style={S.th} onClick={() => clicarCab('quartos')}>Qtos{seta('quartos')}</th>
                      <th style={S.th} onClick={() => clicarCab('cidade')}>Cidade · Setor{seta('cidade')}</th>
                      <th style={S.th} onClick={() => clicarCab('campanha_status')}>Status{seta('campanha_status')}</th>
                      <th style={{ ...S.th, cursor: 'default' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenados.map(l => {
                      const cs = l.campanha_status || '';
                      const pri = (l.prioridade || 0) > 0;
                      return (
                        <tr key={l.id} onClick={() => setDetalheId(l.id)}
                          style={{ cursor: 'pointer', background: pri ? 'linear-gradient(90deg,rgba(224,163,26,.07),transparent 40%)' : undefined }}
                          onMouseEnter={e => { if (!pri) e.currentTarget.style.background = '#fafafd'; }}
                          onMouseLeave={e => { if (!pri) e.currentTarget.style.background = ''; }}>
                          <td style={{ ...S.td, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={selec.has(l.id)} onChange={() => toggleSel(l.id)} style={{ accentColor: C.red }} />
                          </td>
                          <td style={S.td}>{idade(l)}</td>
                          <td style={S.td}>
                            <div style={{ fontWeight: 700, color: C.ink }}>{pri && <span style={{ color: C.amber }}>★ </span>}{l.tipo || '—'}{l.subtipo ? ' · ' + l.subtipo : ''}</div>
                            <div style={{ fontWeight: 500, color: C.ink3, fontSize: 11.5, marginTop: 1 }}>{l.transacao || ''}</div>
                          </td>
                          <td style={{ ...S.td, fontWeight: 700, whiteSpace: 'nowrap' }}>{l.preco || '—'}</td>
                          <td style={{ ...S.td, color: C.ink2 }}>{l.quartos || '—'}</td>
                          <td style={{ ...S.td, color: C.ink2 }}>{l.cidade || '—'}<br /><span style={{ fontSize: 12 }}>{l.setor || ''}</span></td>
                          <td style={S.td}>{badge(cs)}</td>
                          <td style={{ ...S.td, color: C.ink3, textAlign: 'right' }}>›</td>
                        </tr>
                      );
                    })}
                    {!ordenados.length && <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: C.ink3, padding: 28 }}>Nenhum lead nesta visão.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            <p style={{ fontSize: 12, color: C.ink3, marginTop: 12 }}>A grade mostra só o essencial. <strong>Nome, sub-região, observação e a mensagem gerada</strong> aparecem ao clicar no anúncio. 🔴 = lead com +5 dias (anúncio pode já ter saído do ar — confirme antes de abordar).</p>
          </>
        )}

        {/* ════════════════════ TELA CAMPANHA ════════════════════ */}
        {subtela === 'camp' && (
          <>
            {/* status do dia */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 14 }}>
              <div style={S.mini}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: C.ink3, textTransform: 'uppercase', letterSpacing: '.04em' }}>Robô</div>
                {cfg ? (
                  <button onClick={toggleAtivo} style={{ ...S.btn(cfg.ativo ? C.green : '#9ca3af', '#fff'), marginTop: 8, width: '100%' }}>{cfg.ativo ? '● Ligado' : '○ Desligado'}</button>
                ) : <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>backend offline</div>}
              </div>
              <div style={S.mini}><div style={{ fontSize: 11.5, fontWeight: 600, color: C.ink3, textTransform: 'uppercase', letterSpacing: '.04em' }}>Hoje</div><div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.6px', marginTop: 6 }}>{stat ? stat.enviadosHoje : '—'}<span style={{ fontSize: 15, color: C.ink3, fontWeight: 600 }}> / {stat ? stat.maxDia : '—'}</span></div><div style={{ fontSize: 12.5, color: C.ink2, marginTop: 3 }}>abordagens</div></div>
              <div style={S.mini}><div style={{ fontSize: 11.5, fontWeight: 600, color: C.ink3, textTransform: 'uppercase', letterSpacing: '.04em' }}>Na fila</div><div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.6px', marginTop: 6 }}>{stat ? stat.fila : cont.fila}</div><div style={{ fontSize: 12.5, color: C.ink2, marginTop: 3 }}>aguardando</div></div>
              <div style={S.mini}><div style={{ fontSize: 11.5, fontWeight: 600, color: C.ink3, textTransform: 'uppercase', letterSpacing: '.04em' }}>Janela</div><div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.4px', marginTop: 8 }}>{stat ? stat.janela : '—'}</div></div>
            </div>

            {/* disparo manual avulso */}
            <div style={S.sect}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, letterSpacing: '-.3px' }}>Disparo manual</h3>
              <p style={{ margin: '0 0 16px', color: C.ink2, fontSize: 13 }}>Mandar a abordagem agora pra um número avulso, fora da fila. Útil quando você achou um imóvel específico que um cliente quer.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={S.fl}>Número (com DDD)</label><input value={dispNum} onChange={e => setDispNum(e.target.value)} placeholder="62 99999-8888" style={{ ...S.inp, width: '100%' }} /></div>
                <div><label style={S.fl}>Link do imóvel (opcional)</label><input value={dispUrl} onChange={e => setDispUrl(e.target.value)} placeholder="cole o link do anúncio" style={{ ...S.inp, width: '100%' }} /></div>
              </div>
              <button onClick={dispararManual} disabled={disparando} style={{ ...S.btn(C.green, '#fff'), marginTop: 14, opacity: disparando ? .6 : 1 }}>{disparando ? 'Enviando…' : '📨 Disparar agora'}</button>
              <p style={{ fontSize: 12, color: C.ink3, marginTop: 10 }}>Respeita opt-out: se o número já pediu PARAR, não envia. A mensagem sai com variação por IA (antiban) automática.</p>
            </div>

            {/* mensagem */}
            <div style={S.sect}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, letterSpacing: '-.3px' }}>Mensagem da abordagem</h3>
              <p style={{ margin: '0 0 16px', color: C.ink2, fontSize: 13 }}>Texto-base que o robô usa. Placeholders: {'{imovel} {tipo} {subtipo} {cidade} {bairro} {preco}'} — saudação, fechamento e opt-out entram automaticamente.</p>
              <label style={S.fl}>Mensagem (corpo)</label>
              <textarea value={msgForm.msg1} onChange={e => setMsgForm(m => ({ ...m, msg1: e.target.value }))} style={{ ...S.inp, width: '100%', minHeight: 84, resize: 'vertical', lineHeight: 1.5 }} />
              <div style={{ marginTop: 12 }}><label style={S.fl}>Introdução do link (2ª mensagem)</label>
                <input value={msgForm.msg2intro} onChange={e => setMsgForm(m => ({ ...m, msg2intro: e.target.value }))} style={{ ...S.inp, width: '100%' }} /></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                <button style={S.btnSm(C.blue, '#fff')} onClick={salvarMensagens}>💾 Salvar mensagens</button>
                <input style={{ ...S.inp, width: 210 }} placeholder="seu número p/ teste (5562…)" value={testeNum} onChange={e => setTesteNum(e.target.value)} />
                <button style={S.btnSm('#7c3aed', '#fff')} onClick={testarNoMeu}>📲 Testar no meu número</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: '#fafafd', border: '1px solid ' + C.line, borderRadius: 14, padding: '14px 16px', marginTop: 16 }}>
                <span style={{ width: 46, height: 28, borderRadius: 999, background: C.green, position: 'relative', flex: '0 0 auto' }}>
                  <span style={{ position: 'absolute', top: 3, left: 21, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>Variação por IA (antiban) — ligada</div>
                  <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 2 }}>A IA reescreve a abordagem de um jeito diferente pra cada lead (e guarda pra não gastar à toa). Se a IA falhar, usa o texto fixo acima.</div>
                </div>
              </div>
            </div>

            {/* ritmo & janela */}
            <div style={S.sect}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, letterSpacing: '-.3px' }}>Ritmo & janela</h3>
              <p style={{ margin: '0 0 16px', color: C.ink2, fontSize: 13 }}>Controles antiban do robô. {stat && <>Hoje: <b>{stat.enviadosHoje}/{stat.maxDia}</b> · Fila: <b>{stat.fila}</b> · Opt-out: <b>{stat.optout}</b></>}</p>
              {form ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
                    <div><label style={S.fl}>Teto por dia</label><input type="number" value={form.maxDia} onChange={e => setF('maxDia', e.target.value)} style={{ ...S.inp, width: '100%' }} /></div>
                    <div><label style={S.fl}>Pausa mín (min)</label><input type="number" value={form.pausaMin} onChange={e => setF('pausaMin', e.target.value)} style={{ ...S.inp, width: '100%' }} /></div>
                    <div><label style={S.fl}>Pausa máx (min)</label><input type="number" value={form.pausaMax} onChange={e => setF('pausaMax', e.target.value)} style={{ ...S.inp, width: '100%' }} /></div>
                    <div><label style={S.fl}>Pausa longa mín (min)</label><input type="number" value={form.longaMin} onChange={e => setF('longaMin', e.target.value)} style={{ ...S.inp, width: '100%' }} /></div>
                    <div><label style={S.fl}>Pausa longa máx (min)</label><input type="number" value={form.longaMax} onChange={e => setF('longaMax', e.target.value)} style={{ ...S.inp, width: '100%' }} /></div>
                    <div><label style={S.fl}>Longa a cada (envios)</label><input type="number" value={form.longaCada} onChange={e => setF('longaCada', e.target.value)} style={{ ...S.inp, width: '100%' }} /></div>
                    <div><label style={S.fl}>Hora início</label><input type="number" value={form.horaIni} onChange={e => setF('horaIni', e.target.value)} style={{ ...S.inp, width: '100%' }} /></div>
                    <div><label style={S.fl}>Hora fim</label><input type="number" value={form.horaFim} onChange={e => setF('horaFim', e.target.value)} style={{ ...S.inp, width: '100%' }} /></div>
                    <div><label style={S.fl}>Sem resposta vira descarte (h)</label><input type="number" value={form.expiraHoras} onChange={e => setF('expiraHoras', e.target.value)} style={{ ...S.inp, width: '100%' }} /></div>
                    <div><label style={S.fl}>Instância de envio</label><input value={form.instancia || ''} onChange={e => setF('instancia', e.target.value)} placeholder="vazio = SDR/imobiliária" style={{ ...S.inp, width: '100%' }} /></div>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <label style={S.fl}>Dias de envio</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {DIAS_LABEL.map(([rotulo, n]) => {
                        const marcado = Array.isArray(form.diasSemana) && form.diasSemana.indexOf(n) >= 0;
                        return <button key={n} type="button" onClick={() => toggleDia(n)} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: '1px solid ' + (marcado ? C.green : C.line), background: marcado ? C.green : C.card, color: marcado ? '#fff' : C.ink3 }}>{rotulo}</button>;
                      })}
                    </div>
                  </div>
                  <button style={{ ...S.btnSm(C.blue, '#fff'), marginTop: 16 }} onClick={salvarAntiban}>💾 Salvar ritmo & janela</button>
                </>
              ) : <div style={{ color: C.red, fontSize: 13 }}>Backend offline — clique em Atualizar na aba Leads.</div>}
            </div>

            {/* funil */}
            <div style={S.sect}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: '-.3px' }}>Funil da captação</h3>
                <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                  {[7, 30, 90].map(dd => (
                    <button key={dd} onClick={() => setFunilDias(dd)} style={{ padding: '6px 12px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + (funilDias === dd ? C.ink : C.line), background: funilDias === dd ? C.ink : C.card, color: funilDias === dd ? '#fff' : C.ink2 }}>{dd} dias</button>
                  ))}
                </div>
              </div>
              {!funil ? <div style={{ fontSize: 13, color: C.ink3 }}>Carregando métricas…</div> : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
                    {[
                      ['Captados', funil.total, ''],
                      ['Abordados', funil.enviados, ''],
                      ['Responderam', funil.responderam, funil.taxaResposta + '% dos abordados'],
                      ['Repassados', funil.repassados, funil.taxaRepasse + '% dos que responderam'],
                      ['Descartados', funil.descartados, ''],
                      ['Opt-out', funil.optout, ''],
                      ['Na fila', funil.naFila, ''],
                      ['T. médio repasse', funil.tempoMedioRepasseMin == null ? '—' : funil.tempoMedioRepasseMin + ' min', ''],
                    ].map((x, i) => (
                      <div key={i} style={{ background: '#fafafd', border: '1px solid ' + C.line2, borderRadius: 14, padding: '12px 14px' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: '-.4px' }}>{x[1]}</div>
                        <div style={{ fontSize: 11.5, color: C.ink2, marginTop: 2 }}>{x[0]}</div>
                        {x[2] ? <div style={{ fontSize: 11, color: C.ink3, marginTop: 3 }}>{x[2]}</div> : null}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ════════════════════ DRAWER DE DETALHE ════════════════════ */}
      {det && (
        <>
          <div onClick={() => setDetalheId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.28)', zIndex: 60 }} />
          <aside style={{ position: 'fixed', top: 0, right: 0, height: '100%', width: 420, maxWidth: '92vw', background: C.card, boxShadow: '-8px 0 40px rgba(0,0,0,.16)', zIndex: 61, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid ' + C.line, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-.3px' }}>{(det.tipo || 'Imóvel')}{det.subtipo ? ' · ' + det.subtipo : ''}</div>
                <div style={{ fontWeight: 500, color: C.ink3, fontSize: 12.5, marginTop: 2 }}>{[det.cidade, det.setor].filter(Boolean).join(' · ') || '—'}</div>
              </div>
              <button onClick={() => setDetalheId(null)} style={{ marginLeft: 'auto', border: 0, background: '#f0f0f3', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', color: C.ink2, fontSize: 15 }}>✕</button>
            </div>

            <div style={{ padding: '8px 20px 20px', overflow: 'auto', flex: 1 }}>
              <div style={{ marginTop: 16 }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: C.ink3, margin: '0 0 8px' }}>Contato</h4>
                {[
                  ['Nome', det.nome || '—'],
                  ['Telefone', det.telefone || '—'],
                  ['Status', null],
                  ['Idade do lead', null],
                ].map((kv, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '9px 0', borderBottom: '1px solid ' + C.line2, fontSize: 13.5 }}>
                    <span style={{ color: C.ink2 }}>{kv[0]}</span>
                    <span style={{ fontWeight: 600, textAlign: 'right' }}>{kv[0] === 'Status' ? badge(det.campanha_status || '') : kv[0] === 'Idade do lead' ? <span style={{ color: (diasDesde(det) || 0) >= 5 ? C.red : C.ink }}>{diasDesde(det) == null ? '—' : diasDesde(det) + ' dias' + ((diasDesde(det) || 0) >= 5 ? ' · confirmar se está no ar' : '')}</span> : kv[1]}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16 }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: C.ink3, margin: '0 0 8px' }}>Imóvel</h4>
                {[
                  ['Transação', det.transacao], ['Preço', det.preco], ['Quartos', det.quartos], ['Vagas', det.vagas],
                  ['Área', det.area], ['Estado', det.estado], ['Região', det.regiao], ['Sub-região', det.subregiao],
                ].map((kv, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '9px 0', borderBottom: '1px solid ' + C.line2, fontSize: 13.5 }}>
                    <span style={{ color: C.ink2 }}>{kv[0]}</span>
                    <span style={{ fontWeight: 600, textAlign: 'right' }}>{kv[1] || '—'}</span>
                  </div>
                ))}
                {det.url && <div style={{ paddingTop: 10 }}><a href={det.url} target="_blank" rel="noreferrer" style={{ color: C.blue, textDecoration: 'none', fontWeight: 600, fontSize: 13.5 }}>abrir anúncio no OLX ↗</a></div>}
              </div>

              <div style={{ marginTop: 16 }}>
                <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: C.ink3, margin: '0 0 8px' }}>Observação</h4>
                <textarea defaultValue={det.observacoes || ''} placeholder="anotar…" onBlur={e => { if (e.target.value !== (det.observacoes || '')) salvarObs(det, e.target.value); }}
                  style={{ ...S.inp, width: '100%', minHeight: 60, resize: 'vertical', background: '#fafafd' }} />
              </div>

              {det.campanha_resposta && (
                <div style={{ marginTop: 16 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: C.ink3, margin: '0 0 8px' }}>Resposta do proprietário</h4>
                  <div style={{ background: '#e4f4f8', border: '1px solid #c6e8f1', borderRadius: 12, padding: '11px 13px', fontSize: 13, color: '#0a5e76' }}>{det.campanha_resposta}</div>
                </div>
              )}

              {det.msg1_gerada && (
                <div style={{ marginTop: 16 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: C.ink3, margin: '0 0 8px' }}>Mensagem gerada pela IA</h4>
                  <div style={{ background: C.tint, border: '1px solid #f3c9c2', borderRadius: 12, padding: '11px 13px', fontSize: 12.5, color: '#7a241a', whiteSpace: 'pre-line' }}>{det.msg1_gerada}</div>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid ' + C.line, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              {(det.prioridade || 0) > 0
                ? <button style={S.btn('#fff7e6', C.amber)} disabled={priId === det.id} onClick={() => tirarPrioridade(det)}>★ Tirar da frente</button>
                : <button style={S.btn('#fff', C.amber)} disabled={priId === det.id} onClick={() => furarFila(det)}>⭐ Furar fila</button>}
              <button style={S.btn(det.campanha_status === 'enviado' || det.campanha_status === 'optout' ? '#e5e7eb' : C.green, det.campanha_status === 'enviado' || det.campanha_status === 'optout' ? '#9ca3af' : '#fff')}
                disabled={det.campanha_status === 'enviado' || det.campanha_status === 'optout' || enviandoId === det.id} onClick={() => abordarAgora(det)}>{enviandoId === det.id ? '…' : '📨 Abordar agora'}</button>
              <button style={{ ...S.btn(det.virou_cliente ? '#e5e7eb' : C.red, det.virou_cliente ? '#9ca3af' : '#fff'), gridColumn: '1 / -1' }}
                disabled={det.virou_cliente || promovendo === det.id} onClick={() => virarCliente(det)}>{det.virou_cliente ? '✓ já é cliente' : (promovendo === det.id ? '…' : '→ Virar cliente')}</button>
              <button style={S.btn('#f0f0f3', C.ink2)} onClick={() => mudarCampanha([det.id], 'descartado')}>🚫 Fora do perfil</button>
              <button style={S.btn('#fef2f2', '#b91c1c')} onClick={() => excluir(det)}>🗑 Excluir</button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
