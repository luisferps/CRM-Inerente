import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
const WA_AGENT_URL = 'https://agentes-de-whatsapp-production.up.railway.app';
const WA_EVOLUTION_URL = 'https://evolution-api-production-6f9a.up.railway.app';
const WA_API_KEY = '40d03599cab78737a4c9eaf7c00723dbe1bc93b6b329fce0a80ff43d393e4c47';
const DAYS_LABEL = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];
const TITULO_PADRAO = 'Preciso de: (enviar somente imóveis nos perfis relacionados)';
const LIMITE_AVISO_GRUPOS = 20;
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function formatarPreco(valor) {
  const n = Number(valor);
  if (valor === '' || valor === null || valor === undefined) return null;
  if (n === 0) return 'Em aberto';
  return `R$ ${n.toLocaleString('pt-BR')}`;
}
function formatarLinha(c) {
  const partes = [];
  const imovelRegiao = [c.imovel, c.localizacao].filter(Boolean).join(' ');
  if (imovelRegiao) partes.push(capitalize(imovelRegiao));
  if (c.detalhes_externos) partes.push(capitalize(c.detalhes_externos.trim()));
  const preco = formatarPreco(c.valor);
  if (preco) partes.push(preco);
  return `- ${partes.join(' ')}`;
}
function gerarTexto(titulo, selecionados, porModalidade) {
  const ids = new Set(selecionados);
  if (ids.size === 0) return '';
  let out = titulo + '\n\n';
  const ordem = ['Compra', 'Locação'];
  const mods = [...new Set([...ordem.filter(m => porModalidade[m]), ...Object.keys(porModalidade).filter(m => !ordem.includes(m) && m !== 'Venda')])];
  let temConteudo = false;
  mods.forEach(mod => {
    const filtrados = (porModalidade[mod] || []).filter(c => ids.has(c.id));
    if (!filtrados.length) return;
    temConteudo = true;
    const icon = mod === 'Compra' ? '🛒' : mod === 'Locação' ? '🔑' : '📄';
    out += `${icon} *${capitalize(mod)}:*\n`;
    filtrados.forEach(c => { out += formatarLinha(c) + '\n'; });
    out += '\n';
  });
  return temConteudo ? out.trim() : '';
}
function gerarMensagemCompleta(titulo, demandas) {
  if (!demandas.length) return '';
  const porMod = {};
  demandas.forEach(c => {
    const mod = c.modalidade || 'Outros';
    if (mod === 'Venda') return;
    if (!porMod[mod]) porMod[mod] = [];
    porMod[mod].push(c);
  });
  const ordem = ['Compra', 'Locação'];
  const mods = [...new Set([...ordem.filter(m => porMod[m]), ...Object.keys(porMod).filter(m => !ordem.includes(m) && m !== 'Venda')])];
  let out = titulo + '\n\n'; let tem = false;
  mods.forEach(mod => {
    const f = porMod[mod] || []; if (!f.length) return; tem = true;
    const icon = mod === 'Compra' ? '🛒' : mod === 'Locação' ? '🔑' : '📄';
    out += `${icon} *${capitalize(mod)}:*\n`;
    f.forEach(c => { out += formatarLinha(c) + '\n'; }); out += '\n';
  });
  return tem ? out.trim() : '';
}
function gerarMensagemSoLocacao(titulo, demandas) {
  const locacao = demandas.filter(c => c.modalidade === 'Locação');
  if (!locacao.length) return '';
  let out = titulo + '\n\n🔑 *Locação:*\n';
  locacao.forEach(c => { out += formatarLinha(c) + '\n'; });
  return out.trim();
}
function gerarPreviewCategoria(catName, titulo, demandas) {
  const nome = (catName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (nome.includes('aluguel') || nome.includes('locacao')) return gerarMensagemSoLocacao(titulo, demandas);
  return gerarMensagemCompleta(titulo, demandas);
}
function IconeParceria({ ativo, onClick, size = 18 }) {
  return (
    <button onClick={onClick}
      title={ativo ? 'Remover da mensagem' : 'Incluir na mensagem'}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 4, transition: 'background .1s' }}
      onMouseEnter={e => e.currentTarget.style.background = ativo ? '#dbeafe' : '#f3f4f6'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <span style={{ fontSize: size, lineHeight: 1 }}>{ativo ? '🤝' : '🫱'}</span>
    </button>
  );
}
function WAPainel({ instancia, mensagemCRM, darkMode, demandasSelecionadas, tituloCRMExterno }) {
  const [agenda, setAgenda] = useState({ cats: {}, grupos: [], categorias: [] });
  const [CATS, setCATS] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [secAtiva, setSecAtiva] = useState('mensagens');
  const [catsAbertas, setCatsAbertas] = useState(new Set());
  const [slotsSubstituidos, setSlotsSubstituidos] = useState(new Map());
  const [disparoMsg, setDisparoMsg] = useState('');
  const [catsSelDisparo, setCatsSelDisparo] = useState(new Set());
  const [logDisparo, setLogDisparo] = useState([]);
  const [disparando, setDisparando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastWarn, setToastWarn] = useState(false);
  const [tituloCRM, setTituloCRM] = useState('Preciso de: (enviar somente imóveis nos perfis relacionados)');
  const [tituloCRMEditando, setTituloCRMEditando] = useState(false);
  const [pendenteSalvar, setPendenteSalvar] = useState(false);
  const [previasAbertas, setPreviasAbertas] = useState(new Set());
  const card = darkMode ? '#16213e' : '#ffffff';
  const border = darkMode ? '#0f3460' : '#e2e8f0';
  const textColor = darkMode ? '#e2e8f0' : '#1a202c';
  const textMuted = darkMode ? '#94a3b8' : '#64748b';
  const bg = darkMode ? '#0f1117' : '#f8fafc';
  const accentBg = darkMode ? 'rgba(37,99,235,0.08)' : '#eff6ff';
  function toast(msg, warn = false) {
    setToastMsg(msg); setToastWarn(warn);
    setTimeout(() => setToastMsg(''), 3000);
  }
  const carregarAgenda = useCallback(async () => {
    if (!instancia) return;
    setCarregando(true);
    try {
      const res = await fetch(`${WA_AGENT_URL}/scheduler/agenda?instancia=${encodeURIComponent(instancia)}`);
      if (res.ok) {
        const data = await res.json();
        setAgenda(data);
        setCATS(data.categorias || []);
      }
    } catch { toast('Erro ao carregar dados', true); }
    setCarregando(false);
  }, [instancia]);
  useEffect(() => { carregarAgenda(); }, [carregarAgenda]);
  useEffect(() => {
    if (mensagemCRM) setDisparoMsg(mensagemCRM);
  }, [mensagemCRM]);

  // Ref para sempre ter agenda atualizada no useEffect
  const agendaRef = useRef(agenda);
  useEffect(() => { agendaRef.current = agenda; }, [agenda]);

  // Quando mensagemCRM muda, atualiza e salva automaticamente todos os slots com CRM ON
  useEffect(() => {
    if (!mensagemCRM) return;
    const timer = setTimeout(async () => {
      const agendaAtual = agendaRef.current;
      if (!agendaAtual.cats) return;
      let temSlotCRM = false;
      const novaCats = {};
      Object.entries(agendaAtual.cats).forEach(([catId, catData]) => {
        if (!catData.slots) { novaCats[catId] = catData; return; }
        const slots = catData.slots.map(slot => {
          if (slot.espelhar_crm && slot.ativo !== false) {
            temSlotCRM = true;
            return { ...slot, msg: mensagemCRM };
          }
          return slot;
        });
        novaCats[catId] = { ...catData, slots };
      });
      if (!temSlotCRM) return;
      const novaAgenda = { ...agendaAtual, cats: novaCats };
      setAgenda(novaAgenda);
      try {
        const r = await fetch(`${WA_AGENT_URL}/scheduler/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': WA_API_KEY, 'x-instancia': instancia },
          body: JSON.stringify({ cats: novaAgenda.cats, titulo_crm: novaAgenda.titulo_crm, instancia })
        });
        if (r.ok) toast('Mensagem salva nos slots ✓');
        else toast('Erro ao salvar', true);
      } catch { toast('Erro ao salvar', true); }
    }, 1000);
    return () => clearTimeout(timer);
  }, [mensagemCRM]);
  // Carrega título CRM da agenda
  useEffect(() => {
    if (agenda.titulo_crm) setTituloCRM(agenda.titulo_crm);
  }, [agenda.titulo_crm]);

  // Salva título automaticamente com debounce de 1.5s
  useEffect(() => {
    if (!tituloCRMEditando) return;
    const timer = setTimeout(async () => {
      const novaAgenda = { ...agenda, titulo_crm: tituloCRM };
      setAgenda(novaAgenda);
      await fetch(`${WA_AGENT_URL}/scheduler/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': WA_API_KEY, 'x-instancia': instancia },
        body: JSON.stringify({ cats: novaAgenda.cats, titulo_crm: novaAgenda.titulo_crm, instancia })
      });
      toast('Título salvo ✓');
    }, 1500);
    return () => clearTimeout(timer);
  }, [tituloCRM]);

  async function salvarTituloCRM() {
    setTituloCRMEditando(false);
    toast('Título salvo ✓');
  }

  function toggleEspelharCRM(catId, slotIdx) {
    setAgenda(prev => {
      const novaCats = { ...prev.cats };
      const slots = [...(novaCats[catId]?.slots || [])];
      slots[slotIdx] = { ...slots[slotIdx], espelhar_crm: !slots[slotIdx].espelhar_crm };
      novaCats[catId] = { ...novaCats[catId], slots };
      const novaAgenda = { ...prev, cats: novaCats };
      // Salva automaticamente
      setTimeout(() => salvarAgendaAuto(novaAgenda), 0);
      return novaAgenda;
    });
  }

  function toggleAtivoSlot(catId, slotIdx) {
    setAgenda(prev => {
      const novaCats = { ...prev.cats };
      const slots = [...(novaCats[catId]?.slots || [])];
      const atual = slots[slotIdx].ativo !== false;
      slots[slotIdx] = { ...slots[slotIdx], ativo: !atual };
      novaCats[catId] = { ...novaCats[catId], slots };
      const novaAgenda = { ...prev, cats: novaCats };
      // Salva automaticamente
      setTimeout(() => salvarAgendaAuto(novaAgenda), 0);
      return novaAgenda;
    });
  }

  async function salvarAgendaAuto(agendaAtual) {
    try {
      const r = await fetch(`${WA_AGENT_URL}/scheduler/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': WA_API_KEY, 'x-instancia': instancia },
        body: JSON.stringify({ cats: agendaAtual.cats, titulo_crm: agendaAtual.titulo_crm, instancia })
      });
      if (r.ok) toast('Salvo ✓');
      else toast('Erro ao salvar', true);
    } catch { toast('Erro ao salvar', true); }
  }

  async function salvarConfiguracoes() {
    setSalvando(true);
    try {
      const r = await fetch(`${WA_AGENT_URL}/scheduler/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': WA_API_KEY, 'x-instancia': instancia },
        body: JSON.stringify({ cats: agenda.cats, titulo_crm: agenda.titulo_crm, instancia })
      });
      if (r.ok) { toast('Configurações salvas!'); setPendenteSalvar(false); }
      else toast('Erro ao salvar', true);
    } catch { toast('Erro ao salvar', true); }
    setSalvando(false);
  }

  function toggleCatAberta(catId) {
    setCatsAbertas(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  }
  function toggleSlot(catId, slotIdx) {
    if (!mensagemCRM) { toast('Nenhuma mensagem gerada ainda', true); return; }
    const key = `${catId}-${slotIdx}`;
    setSlotsSubstituidos(prev => {
      const next = new Map(prev);
      if (next.has(key)) {
        const msgOriginal = next.get(key);
        next.delete(key);
        setAgenda(ag => {
          const novaCats = { ...ag.cats };
          const slots = [...(novaCats[catId]?.slots || [])];
          slots[slotIdx] = { ...slots[slotIdx], msg: msgOriginal };
          novaCats[catId] = { ...novaCats[catId], slots };
          return { ...ag, cats: novaCats };
        });
      } else {
        const msgOriginal = agenda.cats?.[catId]?.slots?.[slotIdx]?.msg || '';
        next.set(key, msgOriginal);
        setAgenda(ag => {
          const novaCats = { ...ag.cats };
          const slots = [...(novaCats[catId]?.slots || [])];
          slots[slotIdx] = { ...slots[slotIdx], msg: mensagemCRM };
          novaCats[catId] = { ...novaCats[catId], slots };
          return { ...ag, cats: novaCats };
        });
      }
      return next;
    });
  }
  async function salvarSubstituicoes() {
    if (!slotsSubstituidos.size) { toast('Nenhuma substituição feita', true); return; }
    setSalvando(true);
    try {
      const r = await fetch(`${WA_AGENT_URL}/scheduler/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': WA_API_KEY, 'x-instancia': instancia },
        body: JSON.stringify({ cats: agenda.cats, titulo_crm: agenda.titulo_crm, instancia })
      });
      if (r.ok) toast(`${slotsSubstituidos.size} slot(s) salvo(s)!`);
      else toast('Erro ao salvar', true);
    } catch { toast('Erro ao salvar', true); }
    setSalvando(false);
  }
  function toggleCatDisparo(id) {
    setCatsSelDisparo(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const totalGruposDisparo = (agenda.grupos || []).filter(g => catsSelDisparo.has(g.cat)).length;
  const acimaDoLimite = totalGruposDisparo > LIMITE_AVISO_GRUPOS;
  async function dispararAgora() {
    if (!disparoMsg.trim()) { toast('Digite a mensagem', true); return; }
    if (!catsSelDisparo.size) { toast('Selecione uma categoria', true); return; }
    const grupos = (agenda.grupos || []).filter(g => catsSelDisparo.has(g.cat));
    if (!grupos.length) { toast('Nenhum grupo nas categorias selecionadas', true); return; }
    if (acimaDoLimite && !window.confirm(`Você está prestes a enviar para ${totalGruposDisparo} grupos de uma vez. Isso pode aumentar o risco de suspensão. Deseja continuar?`)) return;
    setDisparando(true);
    setLogDisparo([]);
    let ok = 0, err = 0;
    const porCat = {};
    grupos.forEach(g => {
      if (!porCat[g.cat]) porCat[g.cat] = [];
      porCat[g.cat].push(g);
    });
    let primeiraCategoria = true;
    for (const [catId, gruposCat] of Object.entries(porCat)) {
      if (!primeiraCategoria) {
        setLogDisparo(l => [...l, { info: true, msg: 'Aguardando entre categorias...' }]);
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 10000) + 10000));
      }
      primeiraCategoria = false;
      for (const g of gruposCat) {
        try {
          const r = await fetch(`${WA_EVOLUTION_URL}/message/sendText/${instancia}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': WA_API_KEY },
            body: JSON.stringify({ number: g.id, text: disparoMsg, delay: 1000 })
          });
          if (r.ok) { ok++; setLogDisparo(l => [...l, { ok: true, nome: g.name }]); }
          else { err++; setLogDisparo(l => [...l, { ok: false, nome: g.name, status: r.status }]); }
        } catch { err++; setLogDisparo(l => [...l, { ok: false, nome: g.name }]); }
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 4000) + 3000));
      }
    }
    setDisparando(false);
    toast(`${ok} enviado(s)${err ? ` | ${err} erro(s)` : ''}`);
  }
  const navBtnStyle = (ativa) => ({
    flex: 1, padding: '10px 8px', background: 'transparent', border: 'none',
    borderBottom: `2px solid ${ativa ? '#2563eb' : 'transparent'}`,
    color: ativa ? '#2563eb' : textMuted, fontFamily: 'Inter, sans-serif',
    fontSize: 12, fontWeight: ativa ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap'
  });
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: card, border: `1px solid ${border}`, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, background: '#25d366', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>💬</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: textColor }}>WA Scheduler</div>
          <div style={{ fontSize: 10, color: textMuted }}>{instancia}</div>
        </div>
        {slotsSubstituidos.size > 0 && (
          <span style={{ fontSize: 10, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
            {slotsSubstituidos.size} slot{slotsSubstituidos.size > 1 ? 's' : ''} substituído{slotsSubstituidos.size > 1 ? 's' : ''}
          </span>
        )}
      </div>
      {/* Nav */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${border}` }}>
        <button style={navBtnStyle(secAtiva === 'mensagens')} onClick={() => setSecAtiva('mensagens')}>📋 Mensagens</button>
        <button style={navBtnStyle(secAtiva === 'disparo')} onClick={() => setSecAtiva('disparo')}>⚡ Disparo</button>
      </div>
      {/* Conteúdo */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {carregando ? (
          <div style={{ textAlign: 'center', padding: 30, color: textMuted, fontSize: 13 }}>Carregando...</div>
        ) : (
          <>
            {/* Mensagens — Configuração CRM Automático */}
            {secAtiva === 'mensagens' && (
              <>
                {/* Título CRM */}
                <div style={{ marginBottom: 14, padding: '12px 14px', background: bg, border: `1px solid ${border}`, borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '.5px' }}>Título da mensagem CRM</span>
                    {tituloCRMEditando
                      ? <button onClick={salvarTituloCRM} style={{ padding: '2px 8px', borderRadius: 6, border: '1px solid #059669', background: '#f0fdf4', color: '#059669', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>💾 Salvar</button>
                      : <button onClick={() => setTituloCRMEditando(true)} style={{ padding: '2px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: 'transparent', color: '#9ca3af', fontSize: 10, cursor: 'pointer' }}>✏️ Editar</button>
                    }
                  </div>
                  {tituloCRMEditando
                    ? <textarea value={tituloCRM} onChange={e => setTituloCRM(e.target.value)} rows={2}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '2px solid #059669', borderRadius: 8, background: darkMode ? '#0f1117' : '#f0fdf4', color: textColor, fontSize: 12, resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                    : <div style={{ fontSize: 12, color: textMuted, fontStyle: 'italic' }}>{tituloCRM}</div>
                  }
                </div>

                <p style={{ fontSize: 12, color: textMuted, marginBottom: 14, lineHeight: 1.6 }}>
                  Ative o disparo automático CRM nos slots desejados. O backend buscará as demandas do CRM e enviará automaticamente no horário configurado.
                </p>

                {CATS.map(cat => {
                  const slots = agenda.cats?.[cat.id]?.slots || [];
                  const grpCount = (agenda.grupos || []).filter(g => g.cat === cat.id).length;
                  const aberta = catsAbertas.has(cat.id);
                  const numAtivos = slots.filter(s => s.espelhar_crm && s.ativo !== false).length;
                  return (
                    <div key={cat.id} style={{ marginBottom: 10, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
                      <div onClick={() => toggleCatAberta(cat.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer', userSelect: 'none', background: aberta ? accentBg : bg }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.cor, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, fontSize: 13, color: textColor, flex: 1 }}>{cat.name}</span>
                        {numAtivos > 0 && (
                          <span style={{ fontSize: 10, background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0', borderRadius: 20, padding: '1px 7px', fontWeight: 600 }}>
                            {numAtivos} CRM ativo{numAtivos > 1 ? 's' : ''}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: textMuted }}>{grpCount}g</span>
                        <span style={{ fontSize: 11, color: textMuted, marginLeft: 4 }}>{aberta ? '▲' : '▼'}</span>
                      </div>
                      {aberta && (
                        <div style={{ borderTop: `1px solid ${border}` }}>
                          {slots.length === 0 && (
                            <div style={{ padding: '12px 14px', fontSize: 12, color: textMuted, fontStyle: 'italic' }}>Nenhum slot configurado</div>
                          )}
                          {slots.map((slot, i) => {
                            const crmAtivo = slot.espelhar_crm === true;
                            const slotAtivo = slot.ativo !== false;
                            return (
                              <div key={i} style={{ padding: '12px 14px', background: crmAtivo ? (slotAtivo ? accentBg : bg) : card, borderBottom: i < slots.length - 1 ? `1px solid ${border}` : 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 11, color: crmAtivo ? '#2563eb' : textMuted, fontWeight: 600, flexShrink: 0 }}>⏰ {slot.time}</span>
                                  <div style={{ display: 'flex', gap: 3, flex: 1, flexWrap: 'wrap' }}>
                                    {DAYS_LABEL.map((d, j) => (
                                      <span key={j} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 20, background: slot.days?.includes(j) ? '#f1f5f9' : 'transparent', color: slot.days?.includes(j) ? textMuted : '#d1d5db', fontWeight: slot.days?.includes(j) ? 600 : 400 }}>{d}</span>
                                    ))}
                                  </div>
                                  {/* Toggle CRM automático */}
                                  <button onClick={() => toggleEspelharCRM(cat.id, i)}
                                    style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${crmAtivo ? '#059669' : '#d1d5db'}`, background: crmAtivo ? '#f0fdf4' : 'transparent', color: crmAtivo ? '#059669' : textMuted, fontSize: 10, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    {crmAtivo ? '✓ CRM ON' : 'CRM OFF'}
                                  </button>
                                  {/* Toggle suspender */}
                                  {crmAtivo && (
                                    <button onClick={() => toggleAtivoSlot(cat.id, i)}
                                      style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${slotAtivo ? '#f59e0b' : '#dc2626'}`, background: slotAtivo ? '#fffbeb' : '#fee2e2', color: slotAtivo ? '#b45309' : '#dc2626', fontSize: 10, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                      {slotAtivo ? '⏸ Suspender' : '▶ Ativar'}
                                    </button>
                                  )}
                                </div>
                                {crmAtivo && (
                                  <div style={{ marginTop: 6, fontSize: 11, color: slotAtivo ? '#059669' : '#dc2626', fontWeight: 600 }}>
                                    {slotAtivo ? '● Disparo automático ativo' : '○ Disparo suspenso'}
                                  </div>
                                )}
                                {crmAtivo && demandasSelecionadas?.length > 0 && (() => {
                                  const key = `${cat.id}-${i}`;
                                  const previewAberta = previasAbertas.has(key);
                                  const tituloUsar = tituloCRM || tituloCRMExterno || TITULO_PADRAO;
                                  const preview = gerarPreviewCategoria(cat.name, tituloUsar, demandasSelecionadas);
                                  return (
                                    <div style={{ marginTop: 8 }}>
                                      <button onClick={() => setPreviasAbertas(prev => {
                                        const next = new Set(prev);
                                        if (next.has(key)) next.delete(key); else next.add(key);
                                        return next;
                                      })} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 6, border: `1px solid ${border}`, background: 'transparent', color: textMuted, cursor: 'pointer' }}>
                                        {previewAberta ? '▲ Fechar prévia' : '👁 Ver prévia'}
                                      </button>
                                      {previewAberta && (
                                        <pre style={{ marginTop: 8, fontFamily: 'Inter,sans-serif', fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: textColor, background: bg, borderRadius: 8, border: `1px solid ${border}`, padding: '10px 12px', maxHeight: 200, overflowY: 'auto' }}>
                                          {preview || <em style={{ color: '#d1d5db' }}>Nenhuma demanda elegível para esta categoria</em>}
                                        </pre>
                                      )}
                                    </div>
                                  );
                                })()}
                                {!crmAtivo && slot.msg && (
                                  <div style={{ marginTop: 6, fontSize: 11, color: textMuted, lineHeight: 1.5, maxHeight: 40, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                    {slot.msg}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
            {/* Disparo */}
            {secAtiva === 'disparo' && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Mensagem</label>
                  <textarea value={disparoMsg} onChange={e => setDisparoMsg(e.target.value)}
                    placeholder="A mensagem das demandas aparece aqui automaticamente..."
                    style={{ width: '100%', boxSizing: 'border-box', minHeight: 100, padding: '10px 12px', fontFamily: 'Inter, sans-serif', fontSize: 12, lineHeight: 1.7, border: `1px solid ${border}`, borderRadius: 10, background: bg, color: textColor, resize: 'vertical', outline: 'none' }} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Categorias</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {CATS.map(cat => {
                      const sel = catsSelDisparo.has(cat.id);
                      const grpCount = (agenda.grupos || []).filter(g => g.cat === cat.id).length;
                      return (
                        <div key={cat.id} onClick={() => toggleCatDisparo(cat.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: sel ? accentBg : bg, border: `2px solid ${sel ? '#2563eb' : border}`, borderRadius: 10, cursor: 'pointer', userSelect: 'none', transition: 'all .15s' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.cor, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: sel ? '#1d4ed8' : textColor, lineHeight: 1.3 }}>{cat.name}</div>
                            <div style={{ fontSize: 10, color: textMuted }}>{grpCount}g</div>
                          </div>
                          {sel && <span style={{ color: '#2563eb', fontSize: 13 }}>✓</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {catsSelDisparo.size > 0 && (
                  <div style={{ fontSize: 12, marginBottom: 12, padding: '8px 12px', background: acimaDoLimite ? '#fef3c7' : bg, borderRadius: 8, border: `1px solid ${acimaDoLimite ? '#fcd34d' : border}`, color: acimaDoLimite ? '#92400e' : textMuted }}>
                    {acimaDoLimite ? '⚠️' : '📤'} {totalGruposDisparo} grupo(s) receberão a mensagem
                    {acimaDoLimite && <div style={{ fontSize: 11, marginTop: 3 }}>Muitos grupos podem aumentar o risco de suspensão.</div>}
                  </div>
                )}
                {catsSelDisparo.size > 0 && disparoMsg.trim() && (
                  <div style={{ marginBottom: 12, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 14px', background: bg, borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '.5px' }}>👁 Prévia do disparo</span>
                      <span style={{ fontSize: 11, color: textMuted }}>{totalGruposDisparo} grupo(s)</span>
                    </div>
                    <div style={{ padding: '10px 14px' }}>
                      {Array.from(catsSelDisparo).map(catId => {
                        const cat = CATS.find(c => c.id === catId);
                        const grpCount = (agenda.grupos || []).filter(g => g.cat === catId).length;
                        if (!cat) return null;
                        return (
                          <div key={catId} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: cat.cor }} />
                              <span style={{ fontSize: 11, fontWeight: 600, color: textColor }}>{cat.name}</span>
                              <span style={{ fontSize: 10, color: textMuted }}>({grpCount}g)</span>
                            </div>
                            <pre style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: textMuted, margin: 0, padding: '8px 10px', background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 6, border: `1px solid ${border}`, maxHeight: 120, overflowY: 'auto' }}>
                              {disparoMsg}
                            </pre>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <button disabled={disparando} onClick={dispararAgora}
                  style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: disparando ? '#9ca3af' : '#dc2626', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 700, cursor: disparando ? 'not-allowed' : 'pointer' }}>
                  {disparando ? '⏳ Enviando...' : '⚡ Enviar agora'}
                </button>
                {logDisparo.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Resultado</div>
                    {logDisparo.map((l, i) => (
                      l.info
                        ? <div key={i} style={{ fontSize: 11, padding: '4px 8px', color: textMuted, fontStyle: 'italic', marginBottom: 4 }}>{l.msg}</div>
                        : <div key={i} style={{ fontSize: 12, padding: '6px 10px', background: bg, borderRadius: 8, borderLeft: `3px solid ${l.ok ? '#059669' : '#dc2626'}`, marginBottom: 5, color: l.ok ? textColor : textMuted }}>
                            {l.ok ? '✅' : '❌'} {l.nome}{l.status ? ` — erro ${l.status}` : ''}
                          </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
      {/* Toast */}
      {toastMsg && (
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: card, border: `1px solid ${toastWarn ? '#f59e0b' : '#059669'}`, borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 600, color: toastWarn ? '#b45309' : '#059669', whiteSpace: 'nowrap', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {toastMsg}
        </div>
      )}
    </div>
  );
}
export default function ResumoDemandasTab({ data, darkMode, perfil, onToggleParceria }) {
  const [copiado, setCopiado] = useState(false);
  const [editando, setEditando] = useState(false);
  const [textoEditado, setTextoEditado] = useState('');
  const [titulo, setTitulo] = useState(TITULO_PADRAO);
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const elegiveis = useMemo(() => data.filter(c => {
    if (c.ativo !== 'S') return false;
    if (c.is_corretor) return false;
    if (c.modalidade === 'Venda') return false;
    const etapasAvancadas = ['proposta','contrato','financiamento','recebimento','recebido'];
    if (etapasAvancadas.some(e => c[e])) return false;
    return true;
  }), [data]);
  const [selecionados, setSelecionados] = useState(new Set());
  const inicializado = useState(false);
  useEffect(() => {
    if (!inicializado[0]) {
      setSelecionados(new Set(elegiveis.filter(c => c.solicitar_parceria).map(c => c.id)));
      inicializado[1](true);
    }
  }, [elegiveis]);
  async function toggleSelecionado(id) {
    const estaAtivo = selecionados.has(id);
    const novoValor = !estaAtivo;
    setSelecionados(prev => {
      const next = new Set(prev);
      if (estaAtivo) next.delete(id); else next.add(id);
      return next;
    });
    await supabase.from('negociacoes').update({ solicitar_parceria: novoValor }).eq('id', id);
    onToggleParceria?.(id, novoValor);
  }
  const porModalidade = useMemo(() => {
    const grupos = {};
    elegiveis.forEach(c => {
      const mod = c.modalidade || 'Outros';
      if (mod === 'Venda') return;
      if (!grupos[mod]) grupos[mod] = [];
      grupos[mod].push(c);
    });
    return grupos;
  }, [elegiveis]);
  const textoGerado = useMemo(() => gerarTexto(titulo, [...selecionados], porModalidade), [titulo, selecionados, porModalidade]);
  useEffect(() => {
    if (!editando) setTextoEditado(textoGerado);
  }, [textoGerado, editando]);
  const textoFinal = editando ? textoEditado : textoGerado;
  const instancia = perfil?.whatsapp_instancia || '';
  const card = darkMode ? '#16213e' : '#ffffff';
  const border = darkMode ? '#0f3460' : '#e2e8f0';
  const textColor = darkMode ? '#e2e8f0' : '#1a202c';
  const textMuted = darkMode ? '#94a3b8' : '#64748b';
  const bg = darkMode ? '#0f1117' : '#f8fafc';
  const ordem = ['Compra', 'Locação'];
  const mods = [...new Set([...ordem.filter(m => porModalidade[m]), ...Object.keys(porModalidade).filter(m => !ordem.includes(m))])];
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', color: textColor }}>
      {/* Esquerda */}
      <div style={{ flex: '0 0 54%', minWidth: 0 }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>📋 Demandas</h2>
          <p style={{ margin: '6px 0 0', color: textMuted, fontSize: 13 }}>
            Selecione as demandas que entram na mensagem.{' '}
            <strong>{selecionados.size}</strong> de <strong>{elegiveis.length}</strong> selecionada{elegiveis.length !== 1 ? 's' : ''}.
          </p>
        </div>
        {elegiveis.length === 0 ? (
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 40, textAlign: 'center', color: textMuted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🤝</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Nenhuma demanda encontrada</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={() => setSelecionados(new Set(elegiveis.map(c => c.id)))}
                style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${border}`, background: 'transparent', color: textMuted, fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Selecionar todos
              </button>
              <button onClick={() => setSelecionados(new Set())}
                style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${border}`, background: 'transparent', color: textMuted, fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Desmarcar todos
              </button>
            </div>
            {mods.map(mod => (
              <div key={mod} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>
                    {mod === 'Compra' ? '🛒' : mod === 'Locação' ? '🔑' : '📄'} {mod}
                  </span>
                  <span style={{ fontSize: 12, color: textMuted, background: darkMode ? '#0f3460' : '#f1f5f9', padding: '2px 8px', borderRadius: 20 }}>
                    {(porModalidade[mod] || []).filter(c => selecionados.has(c.id)).length}/{(porModalidade[mod] || []).length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(porModalidade[mod] || []).map(c => {
                    const sel = selecionados.has(c.id);
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: sel ? (darkMode ? 'rgba(37,99,235,0.08)' : '#eff6ff') : bg, border: `1px solid ${sel ? '#bfdbfe' : border}`, borderRadius: 8, padding: '8px 12px', transition: 'all .15s' }}>
                        <IconeParceria ativo={sel} onClick={() => toggleSelecionado(c.id)} size={18} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: sel ? (darkMode ? '#93c5fd' : '#1d4ed8') : textColor, marginBottom: 2 }}>{c.nome}</div>
                          <div style={{ color: textMuted, lineHeight: 1.5, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {[c.imovel, c.localizacao].filter(Boolean).join(' ')}
                            {c.detalhes_externos && <span> · {c.detalhes_externos}</span>}
                            {c.valor !== '' && c.valor !== null && c.valor !== undefined && (
                              <span style={{ color: Number(c.valor) === 0 ? '#9ca3af' : '#059669', fontWeight: 600 }}>
                                {' · '}{Number(c.valor) === 0 ? 'Em aberto' : `R$ ${Number(c.valor).toLocaleString('pt-BR')}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* Mensagem gerada */}
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
              {/* Título editável */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '.5px' }}>Título da mensagem</span>
                  <button onClick={() => setEditandoTitulo(e => !e)}
                    style={{ padding: '2px 8px', borderRadius: 6, border: `1px solid ${editandoTitulo ? '#f59e0b' : '#d1d5db'}`, background: editandoTitulo ? '#fffbeb' : 'transparent', color: editandoTitulo ? '#b45309' : '#9ca3af', fontSize: 10, cursor: 'pointer' }}>
                    {editandoTitulo ? '✓ Ok' : '✏️ Editar'}
                  </button>
                  {titulo !== TITULO_PADRAO && (
                    <button onClick={() => setTitulo(TITULO_PADRAO)}
                      style={{ padding: '2px 8px', borderRadius: 6, border: '1px solid #d1d5db', background: 'transparent', color: '#9ca3af', fontSize: 10, cursor: 'pointer' }}>
                      ↺ Resetar
                    </button>
                  )}
                </div>
                {editandoTitulo ? (
                  <input value={titulo} onChange={e => setTitulo(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '2px solid #f59e0b', borderRadius: 8, background: darkMode ? '#0f1117' : '#fffbeb', color: textColor, fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }} />
                ) : (
                  <div style={{ fontSize: 12, color: textMuted, fontStyle: 'italic', padding: '4px 0' }}>{titulo}</div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  Mensagem gerada {editando && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 400 }}>— editando</span>}
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {editando && (
                    <button onClick={() => { setTextoEditado(textoGerado); setEditando(false); }}
                      style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      ↺ Resetar
                    </button>
                  )}
                  <button onClick={() => setEditando(e => !e)}
                    style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid ${editando ? '#f59e0b' : '#d1d5db'}`, background: editando ? '#fffbeb' : '#fff', color: editando ? '#b45309' : '#6b7280', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {editando ? '✓ Concluir' : '✏️ Editar'}
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(textoFinal).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); })}
                    style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: copiado ? '#059669' : '#2563eb', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {copiado ? '✓ Copiado!' : '📋 Copiar'}
                  </button>
                </div>
              </div>
              {textoFinal ? (
                editando ? (
                  <textarea value={textoEditado} onChange={e => setTextoEditado(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', minHeight: 160, padding: '10px 12px', fontFamily: 'Inter,sans-serif', fontSize: 12, lineHeight: 1.8, border: '2px solid #f59e0b', borderRadius: 8, background: darkMode ? '#0f1117' : '#fffbeb', color: textColor, resize: 'vertical', outline: 'none' }} />
                ) : (
                  <pre style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: textColor, margin: 0, padding: '10px 12px', background: bg, borderRadius: 8, border: `1px solid ${border}` }}>
                    {textoFinal}
                  </pre>
                )
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: textMuted, fontSize: 12 }}>
                  Selecione ao menos uma demanda para gerar a mensagem.
                </div>
              )}
              {instancia && textoFinal && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#25d366', fontWeight: 600 }}>● {instancia}</div>
              )}
            </div>
          </>
        )}
      </div>
      {/* Direita: WA Scheduler */}
      <div style={{ flex: '0 0 43%', position: 'sticky', top: 0, height: 'calc(100vh - 130px)', minHeight: 500 }}>
        {instancia ? (
          <WAPainel instancia={instancia} mensagemCRM={textoFinal} darkMode={darkMode} demandasSelecionadas={elegiveis.filter(c => selecionados.has(c.id))} tituloCRMExterno={titulo} />
        ) : (
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 32, textAlign: 'center', color: textMuted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: textColor }}>WA Scheduler</div>
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
              Configure sua instância do WhatsApp na aba <strong>Perfil</strong> para usar o disparador aqui.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
