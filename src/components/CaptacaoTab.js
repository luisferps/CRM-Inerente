import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';

// ───────────────────────────────────────────────────────────────────────────
// Aba "📍 Captação" — leads do OLX + campanha de abordagem (SDR outbound).
// Estados (campanha_status): '' não analisado · fila · enviado (abordado) ·
// respondido (em andamento) · optout · corretor · expirado (não respondeu) · descartado (fora do perfil).
// REGRA DE OURO: nada vira cliente automaticamente (só no botão "→ Virar cliente").
// ───────────────────────────────────────────────────────────────────────────

const BACKEND = 'https://agentes-de-whatsapp-production.up.railway.app';

// Telefone padrão: 11 dígitos (DDD + número), sem o 55. O 55 entra só no envio ao WhatsApp.
function so11(x) {
  let d = String(x == null ? '' : x).replace(/\D/g, '');
  if (d.length >= 12 && d.length <= 13 && d.slice(0, 2) === '55') d = d.slice(2);
  return d;
}


const CAMP_COR = { '': '#9ca3af', fila: '#2563eb', enviado: '#059669', respondido: '#0891b2', expirado: '#94a3b8', corretor: '#9333ea', descartado: '#6b7280', optout: '#b91c1c' };
const CAMP_LABEL = { '': '— não analisado', fila: '⏳ na fila', enviado: '📨 abordado', respondido: '💬 em andamento', expirado: '⌛ não respondeu', corretor: '👔 corretor', descartado: '🚫 fora do perfil', optout: '⛔ opt-out' };

const COLS = [
  { key: 'telefone', label: 'Telefone', kind: 'texto' },
  { key: 'nome', label: 'Nome', kind: 'texto' },
  { key: 'tipo', label: 'Tipo', kind: 'sel' },
  { key: 'subtipo', label: 'Subtipo', kind: 'sel' },
  { key: 'transacao', label: 'Transação', kind: 'sel' },
  { key: 'preco', label: 'Preço', kind: 'num' },
  { key: 'quartos', label: 'Quartos', kind: 'num' },
  { key: 'vagas', label: 'Vagas', kind: 'num' },
  { key: 'area', label: 'Área', kind: 'num' },
  { key: 'estado', label: 'Estado', kind: 'sel' },
  { key: 'regiao', label: 'Região', kind: 'sel' },
  { key: 'subregiao', label: 'Sub-região', kind: 'sel' },
  { key: 'cidade', label: 'Cidade', kind: 'multi' },
  { key: 'setor', label: 'Setor', kind: 'multi' },
];

function parseNum(v) {
  if (v == null) return null;
  const s = String(v).replace(/\D/g, '');
  if (s === '') return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}


function MultiSelect({ options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const popRef = useRef(null);
  useEffect(() => {
    function onDoc(e) { if (popRef.current && !popRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  function abrir() {
    if (btnRef.current) { const r = btnRef.current.getBoundingClientRect(); setPos({ top: r.bottom + 4, left: r.left }); }
    setOpen(o => !o);
  }
  const filt = options.filter(o => String(o).toLowerCase().includes(q.toLowerCase()));
  function toggle(v) { const n = new Set(selected); n.has(v) ? n.delete(v) : n.add(v); onChange(n); }
  const todosMarcados = filt.length > 0 && filt.every(o => selected.has(o));
  function marcarTodos() { const n = new Set(selected); if (todosMarcados) filt.forEach(o => n.delete(o)); else filt.forEach(o => n.add(o)); onChange(n); }
  return (
    <>
      <button ref={btnRef} onClick={abrir} style={{ width: '100%', padding: '4px 4px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 11, background: '#fff', textAlign: 'left', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {selected.size ? selected.size + ' sel.' : 'todos'} ▾
      </button>
      {open && (
        <div ref={popRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: 230, maxHeight: 280, overflow: 'auto', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.18)', padding: 8 }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="filtrar..." style={{ width: '100%', padding: '5px 7px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12, marginBottom: 6, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 }}>
            <button onClick={marcarTodos} style={{ fontSize: 11, fontWeight: 600, border: '1px solid #d1d5db', background: '#f9fafb', borderRadius: 5, padding: '2px 6px', color: '#1a1a2e', cursor: 'pointer' }}>{todosMarcados ? '☑ desmarcar todos' : '☐ marcar todos'}</button>
            <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>{selected.size} sel.</span>
            {selected.size > 0 && <button onClick={() => onChange(new Set())} style={{ fontSize: 11, border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer' }}>limpar</button>}
          </div>
          {filt.map(o => (
            <label key={o} style={{ display: 'flex', gap: 6, fontSize: 12, padding: '3px 2px', cursor: 'pointer' }}>
              <input type="checkbox" checked={selected.has(o)} onChange={() => toggle(o)} /> {o || '(vazio)'}
            </label>
          ))}
          {!filt.length && <div style={{ fontSize: 11, color: '#9ca3af', padding: 4 }}>nenhum item</div>}
        </div>
      )}
    </>
  );
}

export default function CaptacaoTab({ perfil }) {
  const [leads, setLeads] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [promovendo, setPromovendo] = useState(null);
  const [enviandoId, setEnviandoId] = useState(null);
  const [view, setView] = useState('pendentes');
  const [selec, setSelec] = useState(new Set());

  // filtros por coluna
  const [multiSel, setMultiSel] = useState({}); // { coluna: Set } — todos os filtros são multi-seleção

  // ordenação
  const [sortCol, setSortCol] = useState('data_captura');
  const [sortDir, setSortDir] = useState('desc');

  // campanha (backend)
  const [cfg, setCfg] = useState(null);
  const [stat, setStat] = useState(null);
  const [form, setForm] = useState(null);
  const [msgForm, setMsgForm] = useState({ msg1: '', msg2intro: '' });
  const [testeNum, setTesteNum] = useState('');
  const [painelAberto, setPainelAberto] = useState(false);

  // rolagem horizontal: barra de cima sincronizada com a tabela
  const scrollRef = useRef(null);
  const topRef = useRef(null);
  const [tableW, setTableW] = useState(1500);
  function syncFromTop() { if (scrollRef.current && topRef.current) scrollRef.current.scrollLeft = topRef.current.scrollLeft; }
  function syncFromTable() { if (scrollRef.current && topRef.current) topRef.current.scrollLeft = scrollRef.current.scrollLeft; }

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
      });
      setMsgForm({ msg1: c.msg1 || '', msg2intro: c.msg2intro || '' });
    } catch (e) { /* backend offline */ }
  }

  useEffect(() => { carregar(); carregarCampanha(); }, []);

  useEffect(() => {
    function medir() { const sc = scrollRef.current; if (sc) { const t = sc.querySelector('table'); if (t) setTableW(t.scrollWidth); } }
    medir();
    const id = setTimeout(medir, 300);
    window.addEventListener('resize', medir);
    return () => { clearTimeout(id); window.removeEventListener('resize', medir); };
  });

  const numericasOpc = ['preco', 'quartos', 'vagas', 'area'];
  const opcoes = useMemo(() => {
    const o = {};
    COLS.forEach(col => {
      let vals = [...new Set(leads.map(l => (l[col.key] == null ? '' : String(l[col.key]))).filter(v => v !== ''))];
      if (numericasOpc.includes(col.key)) vals.sort((a, b) => (parseNum(a) || 0) - (parseNum(b) || 0));
      else vals.sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
      o[col.key] = vals;
    });
    return o;
  }, [leads]);

  const cont = useMemo(() => {
    const c = { '': 0, fila: 0, enviado: 0, respondido: 0, descartado: 0, optout: 0, corretor: 0, expirado: 0 };
    leads.forEach(l => { const st = l.campanha_status || ''; if (c[st] !== undefined) c[st]++; });
    return c;
  }, [leads]);

  function passaView(l) {
    const s = l.campanha_status || '';
    if (view === 'g_abordar') return s === '' || s === 'fila';
    if (view === 'g_abordados') return ['enviado', 'respondido'].includes(s);
    if (view === 'g_descartados') return ['descartado', 'optout', 'corretor', 'expirado'].includes(s);
    if (view === 'pendentes') return s === '';
    if (view === 'fila') return s === 'fila';
    if (view === 'naocompensa') return s === 'descartado';
    if (view === 'abordados') return ['enviado', 'respondido', 'optout', 'corretor', 'expirado'].includes(s);
    if (view === 'aguardando') return s === 'enviado';
    if (view === 'andamento') return s === 'respondido';
    if (view === 'descartadas') return ['optout', 'corretor', 'expirado'].includes(s);
    if (view === 'optout') return s === 'optout';
    if (view === 'corretor') return s === 'corretor';
    if (view === 'naoresp') return s === 'expirado';
    return true;
  }

  const filtrados = useMemo(() => {
    return leads.filter(l => {
      if (!passaView(l)) return false;
      for (const col of COLS) {
        const ms = multiSel[col.key];
        if (ms && ms.size) {
          const v = l[col.key] == null ? '' : String(l[col.key]);
          if (!ms.has(v)) return false;
        }
      }
      return true;
    });
  }, [leads, view, multiSel]);

  const numericas = ['preco', 'quartos', 'vagas', 'area'];
  const ordenados = useMemo(() => {
    const arr = [...filtrados];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (numericas.includes(sortCol)) {
        const na = parseNum(a[sortCol]), nb = parseNum(b[sortCol]);
        return ((na == null ? -Infinity : na) - (nb == null ? -Infinity : nb)) * dir;
      }
      return String(a[sortCol] || '').localeCompare(String(b[sortCol] || ''), 'pt-BR', { numeric: true }) * dir;
    });
    return arr;
  }, [filtrados, sortCol, sortDir]);

  function clicarCabecalho(key) {
    if (sortCol === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(key); setSortDir('asc'); }
  }
  function setaSort(key) { return sortCol !== key ? '' : (sortDir === 'asc' ? ' ↑' : ' ↓'); }
  function limparFiltros() { setMultiSel({}); }
  const temFiltro = Object.values(multiSel).some(x => x && x.size);

  // ─── seleção ───
  function toggleSel(id) { setSelec(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleTodos() {
    setSelec(s => {
      const visiveis = ordenados.map(l => l.id);
      const todosMarcados = visiveis.every(id => s.has(id)) && visiveis.length > 0;
      return todosMarcados ? new Set() : new Set(visiveis);
    });
  }

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

  // ─── mudança de status (triagem do lead, campo status) ───
  async function salvarObs(lead, txt) {
    const { error } = await supabase.from('leads_captacao').update({ observacoes: txt }).eq('id', lead.id);
    if (error) { alert('Erro: ' + error.message); return; }
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, observacoes: txt } : l));
  }
  async function excluir(lead) {
    if (!window.confirm('EXCLUIR de vez este lead? (pra só tirar da vista use "Descartar")')) return;
    const { error } = await supabase.from('leads_captacao').delete().eq('id', lead.id);
    if (error) { alert('Erro: ' + error.message); return; }
    setLeads(ls => ls.filter(l => l.id !== lead.id));
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
        detalhes: montarResumoImovel(lead), valor: valorNumerico(lead.preco), ativo: 'S', captado: false, ficha: lead.ficha || null,
      };
      if (perfil && perfil.id) { negociacao.corretor_id = perfil.id; negociacao.corretor = perfil.nome; negociacao.corretor_original_id = perfil.id; negociacao.corretor_original = perfil.nome; }
      const { error: e2 } = await supabase.from('negociacoes').insert([negociacao]);
      if (e2) throw e2;
      const { error: e3 } = await supabase.from('leads_captacao').update({ status: 'virou_cliente', virou_cliente: true, campanha_status: 'respondido' }).eq('id', lead.id);
      if (e3) throw e3;
      setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, status: 'virou_cliente', virou_cliente: true, campanha_status: 'respondido' } : l));
      alert('✓ Cliente e demanda criados (Tratativas/Funil, origem OLX).');
    } catch (err) { alert('Não consegui promover.\n\n' + err.message); }
    finally { setPromovendo(null); }
  }

  function exportarCSV() {
    if (!ordenados.length) { alert('Nada pra exportar.'); return; }
    const cols = ['telefone', 'nome', 'tipo', 'subtipo', 'transacao', 'preco', 'quartos', 'vagas', 'banheiros', 'area', 'estado', 'regiao', 'subregiao', 'cidade', 'setor', 'codigo', 'campanha_status', 'observacoes', 'url', 'data_captura'];
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
    });
    alert('Antiban salvo.');
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

  // ─── estilos ───
  const S = {
    wrap: { padding: 16 },
    barra: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 },
    btn: { padding: '7px 12px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    btnm: { padding: '4px 7px', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' },
    th: { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', background: '#f9fafb', fontWeight: 700 },
    thF: { padding: '4px 8px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', verticalAlign: 'top' },
    td: { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid #f1f1f1', verticalAlign: 'top', whiteSpace: 'nowrap' },
    inp: { padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12, width: '100%', boxSizing: 'border-box' },
    inpN: { padding: '3px 4px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 11, width: 48, boxSizing: 'border-box', textAlign: 'right' },
    selF: { padding: '4px 4px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 11, width: '100%', background: '#fff', boxSizing: 'border-box' },
    fix: { position: 'sticky', left: 0, zIndex: 30, background: '#fff', boxShadow: '3px 0 6px -2px rgba(0,0,0,.25)' },
    fixH: { position: 'sticky', left: 0, zIndex: 50, background: '#eef2f5', boxShadow: '3px 0 6px -2px rgba(0,0,0,.25)' },
    cardCfg: { border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 12, background: '#fbfbfd' },
    cfgRow: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 8 },
    lab: { fontSize: 12, color: '#6b7280' },
    chip: (c) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#fff', background: c }),
  };
  const setF = (k, v) => setForm(o => ({ ...o, [k]: v }));

  function celulaFiltro(col) {
    const cur = multiSel[col.key] || new Set();
    return <MultiSelect options={opcoes[col.key] || []} selected={cur} onChange={(ns) => setMultiSel(m => ({ ...m, [col.key]: ns }))} />;
  }

  function bView(key, label, count, cor) {
    const ativo = view === key;
    return (
      <button onClick={() => { setView(key); setSelec(new Set()); }} style={{ padding: '5px 9px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + (ativo ? cor : '#d1d5db'), background: ativo ? cor : '#fff', color: ativo ? '#fff' : '#374151', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
        {label}<span style={{ background: ativo ? 'rgba(255,255,255,.25)' : '#f3f4f6', color: ativo ? '#fff' : '#6b7280', borderRadius: 10, padding: '0 6px', fontSize: 11 }}>{count}</span>
      </button>
    );
  }
  const grupoBox = { display: 'flex', flexDirection: 'column', gap: 5 };
  const grupoTit = { fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '.04em' };
  const grupoLinha = { display: 'flex', gap: 5, flexWrap: 'wrap' };

  const idsSelec = [...selec];

  return (
    <div style={S.wrap}>
      {/* ── PAINEL DE CAMPANHA ── */}
      <div style={S.cardCfg}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 15 }}>📨 Campanha de abordagem</strong>
          {cfg ? (
            <button style={{ ...S.btn, background: cfg.ativo ? '#059669' : '#9ca3af', color: '#fff' }} onClick={toggleAtivo}>
              {cfg.ativo ? '● Ligada (enviando na fila)' : '○ Desligada'}
            </button>
          ) : <span style={{ color: '#b91c1c', fontSize: 12 }}>backend offline — recarregue</span>}
          {stat && <span style={S.lab}>Hoje: <b>{stat.enviadosHoje}/{stat.maxDia}</b> · Fila: <b>{stat.fila}</b> · Enviados: <b>{stat.enviadoTotal}</b> · Opt-out: <b>{stat.optout}</b> · Janela {stat.janela}</span>}
          <button style={{ ...S.btnm, background: '#f3f4f6', color: '#1a1a2e', marginLeft: 'auto' }} onClick={() => setPainelAberto(a => !a)}>{painelAberto ? 'fechar ajustes ▲' : 'ajustes (antiban + mensagens) ▼'}</button>
        </div>

        {painelAberto && form && (
          <div style={{ marginTop: 12 }}>
            <div style={S.cfgRow}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Antiban</span>
              <label style={S.lab}>Máx/dia <input style={{ ...S.inpN, width: 56 }} type="number" value={form.maxDia} onChange={e => setF('maxDia', e.target.value)} /></label>
              <label style={S.lab}>Pausa mín(min) <input style={S.inpN} type="number" value={form.pausaMin} onChange={e => setF('pausaMin', e.target.value)} /></label>
              <label style={S.lab}>máx(min) <input style={S.inpN} type="number" value={form.pausaMax} onChange={e => setF('pausaMax', e.target.value)} /></label>
              <label style={S.lab}>Longa mín(min) <input style={S.inpN} type="number" value={form.longaMin} onChange={e => setF('longaMin', e.target.value)} /></label>
              <label style={S.lab}>máx(min) <input style={S.inpN} type="number" value={form.longaMax} onChange={e => setF('longaMax', e.target.value)} /></label>
              <label style={S.lab}>a cada <input style={{ ...S.inpN, width: 44 }} type="number" value={form.longaCada} onChange={e => setF('longaCada', e.target.value)} /></label>
              <label style={S.lab}>Janela <input style={{ ...S.inpN, width: 40 }} type="number" value={form.horaIni} onChange={e => setF('horaIni', e.target.value)} />h–<input style={{ ...S.inpN, width: 40 }} type="number" value={form.horaFim} onChange={e => setF('horaFim', e.target.value)} />h</label>
              <label style={S.lab}>Sem resposta vira descarte em (h) <input style={{ ...S.inpN, width: 50 }} type="number" value={form.expiraHoras} onChange={e => setF('expiraHoras', e.target.value)} /></label>
              <label style={S.lab}>Instância de envio <input style={{ ...S.inp, width: 160, display: 'inline-block' }} value={form.instancia || ''} onChange={e => setF('instancia', e.target.value)} placeholder="vazio = SDR/imobiliária" /></label>
              <button style={{ ...S.btnm, background: '#2563eb', color: '#fff' }} onClick={salvarAntiban}>💾 salvar antiban</button>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Mensagem 1 (texto da abordagem)</div>
              <div style={{ ...S.lab, marginBottom: 4 }}>Placeholders: {'{imovel} {tipo} {subtipo} {cidade} {bairro} {preco}'} — saudação, fechamento e opt-out são adicionados automaticamente (variados).</div>
              <textarea style={{ ...S.inp, minHeight: 70, fontSize: 13 }} value={msgForm.msg1} onChange={e => setMsgForm(m => ({ ...m, msg1: e.target.value }))} />
              <div style={{ fontWeight: 700, fontSize: 13, margin: '8px 0 4px' }}>Mensagem 2 (frase antes do link do OLX)</div>
              <input style={{ ...S.inp, fontSize: 13 }} value={msgForm.msg2intro} onChange={e => setMsgForm(m => ({ ...m, msg2intro: e.target.value }))} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <button style={{ ...S.btnm, background: '#2563eb', color: '#fff' }} onClick={salvarMensagens}>💾 salvar mensagens</button>
                <span style={S.lab}>|</span>
                <input style={{ ...S.inp, width: 200 }} placeholder="seu número p/ teste (5562...)" value={testeNum} onChange={e => setTesteNum(e.target.value)} />
                <button style={{ ...S.btnm, background: '#7c3aed', color: '#fff' }} onClick={testarNoMeu}>📲 testar no meu número</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── ATALHOS DE VISÃO (grupos) ── */}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 12, padding: '10px 12px', background: '#fbfbfd', border: '1px solid #e5e7eb', borderRadius: 10 }}>
        <div style={grupoBox}>
          <span style={grupoTit}>A ABORDAR</span>
          <div style={grupoLinha}>
            {bView('pendentes', 'Não analisados', cont[''], '#9ca3af')}
            {bView('fila', 'Na fila', cont.fila, '#2563eb')}
          </div>
        </div>
        <div style={grupoBox}>
          <span style={grupoTit}>ABORDADOS</span>
          <div style={grupoLinha}>
            {bView('g_abordados', 'Todos', cont.enviado + cont.respondido, '#047857')}
            {bView('aguardando', 'Aguardando', cont.enviado, '#059669')}
            {bView('andamento', 'Em andamento', cont.respondido, '#0891b2')}
          </div>
        </div>
        <div style={grupoBox}>
          <span style={grupoTit}>DESCARTADOS</span>
          <div style={grupoLinha}>
            {bView('g_descartados', 'Todos', cont.descartado + cont.optout + cont.corretor + cont.expirado, '#4b5563')}
            {bView('naocompensa', 'Fora do perfil', cont.descartado, '#6b7280')}
            {bView('optout', 'Opt-out', cont.optout, '#b91c1c')}
            {bView('corretor', 'Corretor', cont.corretor, '#9333ea')}
            {bView('naoresp', 'Não respondeu', cont.expirado, '#94a3b8')}
          </div>
        </div>
        <div style={grupoBox}>
          <span style={grupoTit}>&nbsp;</span>
          <div style={grupoLinha}>{bView('todos', 'Todos os leads', leads.length, '#1a1a2e')}</div>
        </div>
      </div>

      {/* ── BARRA SUPERIOR ── */}
      <div style={S.barra}>
        <strong style={{ fontSize: 16 }}>📍 Captação OLX</strong>
        <span style={{ color: '#6b7280', fontSize: 13 }}>{ordenados.length} de {leads.length}</span>
        <button style={{ ...S.btn, background: '#f3f4f6', color: '#1a1a2e' }} onClick={() => { carregar(); carregarCampanha(); }}>🔄 Atualizar</button>
        <button style={{ ...S.btn, background: '#059669', color: '#fff' }} onClick={exportarCSV}>⬇ CSV</button>
        {temFiltro && <button style={{ ...S.btn, background: '#f3f4f6', color: '#1a1a2e' }} onClick={limparFiltros}>limpar filtros</button>}
      </div>

      {/* ── AÇÕES EM MASSA ── */}
      {idsSelec.length > 0 && (
        <div style={{ ...S.barra, background: '#eff6ff', padding: 8, borderRadius: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{idsSelec.length} selecionado(s):</span>
          <button style={{ ...S.btnm, background: '#2563eb', color: '#fff' }} onClick={() => mudarCampanha(idsSelec, 'fila')}>⏳ Adicionar à campanha (fila)</button>
          <button style={{ ...S.btnm, background: '#6b7280', color: '#fff' }} onClick={() => mudarCampanha(idsSelec, 'descartado')}>🚫 Fora do perfil</button>
          <button style={{ ...S.btnm, background: '#f3f4f6', color: '#1a1a2e' }} onClick={() => mudarCampanha(idsSelec, null)}>↩ tirar status</button>
          <button style={{ ...S.btnm, background: '#fff', color: '#6b7280', border: '1px solid #d1d5db' }} onClick={() => setSelec(new Set())}>limpar seleção</button>
        </div>
      )}

      {erro && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 7, marginBottom: 12, fontSize: 13 }}>Erro: {erro}</div>}
      {carregando && <div style={{ color: '#6b7280' }}>Carregando...</div>}

      {!carregando && (
        <>
        <div ref={topRef} onScroll={syncFromTop} style={{ overflowX: 'auto', overflowY: 'hidden', position: 'sticky', top: 0, zIndex: 5, height: 16, background: '#eef0f3', border: '1px solid #e5e7eb', borderBottom: 'none', borderRadius: '8px 8px 0 0' }}>
          <div style={{ width: tableW, height: 1 }} />
        </div>
        <div ref={scrollRef} onScroll={syncFromTable} style={{ overflow: 'auto', maxHeight: '68vh', border: '1px solid #e5e7eb', borderRadius: '0 0 8px 8px' }}>
          <table style={{ borderCollapse: 'collapse', background: '#fff', minWidth: 1500 }}>
            <thead>
              <tr>
                <th style={{ ...S.th, ...S.fixH, cursor: 'default' }}>
                  <input type="checkbox" checked={ordenados.length > 0 && ordenados.every(l => selec.has(l.id))} onChange={toggleTodos} />
                  <span style={{ marginLeft: 6 }} onClick={() => clicarCabecalho('telefone')}>Telefone{setaSort('telefone')}</span>
                </th>
                {COLS.slice(1).map(col => <th key={col.key} style={S.th} onClick={() => clicarCabecalho(col.key)}>{col.label}{setaSort(col.key)}</th>)}
                <th style={S.th}>Campanha</th>
                <th style={S.th}>Obs.</th>
                <th style={S.th}>Ações</th>
              </tr>
              <tr>
                <th style={{ ...S.thF, ...S.fixH }}>{celulaFiltro(COLS[0])}</th>
                {COLS.slice(1).map(col => <th key={col.key} style={S.thF}>{celulaFiltro(col)}</th>)}
                <th style={S.thF}></th><th style={S.thF}></th><th style={S.thF}></th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map(l => {
                const cs = l.campanha_status || '';
                return (
                  <tr key={l.id}>
                    <td style={{ ...S.td, ...S.fix, background: '#fff' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <input type="checkbox" checked={selec.has(l.id)} onChange={() => toggleSel(l.id)} style={{ marginTop: 3 }} />
                        <div>
                          <strong style={{ color: '#C0392B' }}>{l.telefone}</strong>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{(l.data_captura || '').slice(0, 10)}</div>
                          {l.url && <a href={l.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#2563eb' }}>ver anúncio ↗</a>}
                        </div>
                      </div>
                    </td>
                    <td style={S.td}>{l.nome || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td style={S.td}>{l.tipo || '—'}</td>
                    <td style={S.td}>{l.subtipo || '—'}</td>
                    <td style={S.td}>{l.transacao || '—'}</td>
                    <td style={{ ...S.td, fontWeight: 600 }}>{l.preco || '—'}</td>
                    <td style={S.td}>{l.quartos || '—'}</td>
                    <td style={S.td}>{l.vagas || '—'}</td>
                    <td style={S.td}>{l.area || '—'}</td>
                    <td style={S.td}>{l.estado || '—'}</td>
                    <td style={S.td}>{l.regiao || '—'}</td>
                    <td style={S.td}>{l.subregiao || '—'}</td>
                    <td style={S.td}>{l.cidade || '—'}</td>
                    <td style={S.td}>{l.setor || '—'}</td>
                    <td style={S.td}><span style={S.chip(CAMP_COR[cs])} title={l.campanha_resposta || ''}>{CAMP_LABEL[cs]}</span>{l.campanha_resposta ? <div style={{ fontSize: 10, color: '#6b7280', maxWidth: 130, whiteSpace: 'normal' }}>“{String(l.campanha_resposta).slice(0, 60)}”</div> : null}</td>
                    <td style={S.td}>
                      <input style={{ ...S.inp, width: 120 }} defaultValue={l.observacoes || ''} placeholder="anotar..." onBlur={e => { if (e.target.value !== (l.observacoes || '')) salvarObs(l, e.target.value); }} />
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
                        <button style={{ ...S.btnm, background: cs === 'enviado' || cs === 'optout' ? '#e5e7eb' : '#16a34a', color: cs === 'enviado' || cs === 'optout' ? '#9ca3af' : '#fff' }} disabled={cs === 'enviado' || cs === 'optout' || enviandoId === l.id} onClick={() => abordarAgora(l)}>{enviandoId === l.id ? '...' : '📨 Abordar agora'}</button>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button title="Fora do perfil (não abordar)" style={{ ...S.btnm, background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', flex: 1 }} onClick={() => mudarCampanha([l.id], 'descartado')}>🚫 fora do perfil</button>
                          <button title="Excluir de vez" style={{ ...S.btnm, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }} onClick={() => excluir(l)}>🗑</button>
                        </div>
                        <button style={{ ...S.btnm, background: l.virou_cliente ? '#e5e7eb' : '#7c3aed', color: l.virou_cliente ? '#9ca3af' : '#fff' }} disabled={l.virou_cliente || promovendo === l.id} onClick={() => virarCliente(l)}>{l.virou_cliente ? '✓ já é cliente' : (promovendo === l.id ? '...' : '→ Virar cliente')}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!ordenados.length && <tr><td colSpan={COLS.length + 3} style={{ ...S.td, textAlign: 'center', color: '#9ca3af', padding: 24 }}>Nenhum lead nesta visão.</td></tr>}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
