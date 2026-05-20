import { useState, useMemo, useEffect, useCallback } from 'react';

const WA_AGENT_URL = 'https://agentes-de-whatsapp-production.up.railway.app';
const WA_API_KEY = '40d03599cab78737a4c9eaf7c00723dbe1bc93b6b329fce0a80ff43d393e4c47';
const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];

// ── Helpers ───────────────────────────────────────────────────────────────────
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
function gerarTexto(ativas, porModalidade) {
  if (ativas.length === 0) return '';
  let out = 'Preciso de: (enviar somente imóveis nos perfis relacionados)\n\n';
  const ordem = ['Compra', 'Venda', 'Locação'];
  const mods = [...new Set([...ordem.filter(m => porModalidade[m]), ...Object.keys(porModalidade).filter(m => !ordem.includes(m))])];
  mods.forEach(mod => {
    const icon = mod === 'Compra' ? '🛒' : mod === 'Venda' ? '🏠' : mod === 'Locação' ? '🔑' : '📄';
    out += `${icon} *${capitalize(mod)}:*\n`;
    porModalidade[mod].forEach(c => { out += formatarLinha(c) + '\n'; });
    out += '\n';
  });
  return out.trim();
}

// ── WA Scheduler Component ────────────────────────────────────────────────────
function WAScheduler({ instancia, textoParaDisparo, onTextoUsado }) {
  const [secAtiva, setSecAtiva] = useState('mensagens');
  const [agenda, setAgenda] = useState({ cats: {}, grupos: [], categorias: [] });
  const [CATS, setCATS] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastWarn, setToastWarn] = useState(false);

  // Disparo
  const [disparoMsg, setDisparoMsg] = useState('');
  const [catsSelDisparo, setCatsSelDisparo] = useState(new Set());
  const [logDisparo, setLogDisparo] = useState([]);
  const [disparando, setDisparando] = useState(false);

  // Categoria modal
  const [modalCat, setModalCat] = useState(false);
  const [modalNomeCat, setModalNomeCat] = useState('');
  const [modalCorCat, setModalCorCat] = useState('#25d366');
  const [modalDelCat, setModalDelCat] = useState(null);

  function toast(msg, warn = false) {
    setToastMsg(msg);
    setToastWarn(warn);
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
    } catch (e) {
      toast('Erro ao carregar dados', true);
    }
    setCarregando(false);
  }, [instancia]);

  useEffect(() => { carregarAgenda(); }, [carregarAgenda]);

  // Quando texto do CRM chegar, preenche campo de disparo
  useEffect(() => {
    if (textoParaDisparo) {
      setDisparoMsg(textoParaDisparo);
      setSecAtiva('disparo');
      if (onTextoUsado) onTextoUsado();
    }
  }, [textoParaDisparo]);

  async function salvarAgenda(novaAgenda) {
    setSalvando(true);
    try {
      const r = await fetch(`${WA_AGENT_URL}/scheduler/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': WA_API_KEY, 'x-instancia': instancia },
        body: JSON.stringify({ ...novaAgenda, instancia, categorias: CATS })
      });
      if (r.ok) toast('Salvo!');
      else toast('Erro ao salvar', true);
    } catch { toast('Erro ao salvar', true); }
    setSalvando(false);
  }

  async function sincronizar() {
    try {
      const res = await fetch(`${WA_AGENT_URL}/scheduler/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': WA_API_KEY, 'x-instancia': instancia },
        body: JSON.stringify({ instancia })
      });
      if (res.ok) {
        await carregarAgenda();
        toast('Grupos sincronizados!');
      } else toast('Erro ao sincronizar', true);
    } catch (e) { toast('Erro: ' + e.message, true); }
  }

  async function dispararAgora() {
    if (!disparoMsg.trim()) { toast('Digite a mensagem', true); return; }
    if (!catsSelDisparo.size) { toast('Selecione uma categoria', true); return; }
    const grupos = (agenda.grupos || []).filter(g => catsSelDisparo.has(g.cat));
    if (!grupos.length) { toast('Nenhum grupo nas categorias', true); return; }
    setDisparando(true);
    setLogDisparo([]);
    let ok = 0, err = 0;
    for (const g of grupos) {
      try {
        const r = await fetch(`${WA_AGENT_URL.replace('agentes-de-whatsapp', 'evolution-api').replace('production.up.railway.app', 'production-6f9a.up.railway.app')}/message/sendText/${instancia}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': WA_API_KEY },
          body: JSON.stringify({ number: g.id, text: disparoMsg, delay: 1000 })
        });
        if (r.ok) { ok++; setLogDisparo(l => [...l, { ok: true, nome: g.name }]); }
        else { err++; setLogDisparo(l => [...l, { ok: false, nome: g.name, status: r.status }]); }
      } catch { err++; setLogDisparo(l => [...l, { ok: false, nome: g.name }]); }
      await new Promise(r => setTimeout(r, 800));
    }
    setDisparando(false);
    toast(`${ok} enviado(s)${err ? ` | ${err} erro(s)` : ''}`);
  }

  function atualizarSlot(catId, slotIdx, campo, valor) {
    setAgenda(prev => {
      const nova = { ...prev };
      if (!nova.cats[catId]) nova.cats[catId] = { slots: [{time:'08:00',msg:'',days:[1,2,3,4,5]},{time:'13:00',msg:'',days:[1,2,3,4,5]},{time:'18:00',msg:'',days:[1,2,3,4,5]}] };
      nova.cats[catId].slots[slotIdx] = { ...nova.cats[catId].slots[slotIdx], [campo]: valor };
      return nova;
    });
  }

  function toggleDia(catId, slotIdx, dayIdx) {
    const slot = agenda.cats[catId]?.slots[slotIdx];
    if (!slot) return;
    const days = slot.days.includes(dayIdx) ? slot.days.filter(d => d !== dayIdx) : [...slot.days, dayIdx];
    atualizarSlot(catId, slotIdx, 'days', days);
  }

  function toggleCatDisparo(id) {
    setCatsSelDisparo(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function setGrupoCat(gid, cat) {
    setAgenda(prev => ({ ...prev, grupos: prev.grupos.map(g => g.id === gid ? { ...g, cat } : g) }));
  }

  function criarCategoria() {
    if (!modalNomeCat.trim()) { toast('Digite um nome', true); return; }
    const id = 'cat-' + Date.now();
    const nova = { id, name: modalNomeCat.trim(), cor: modalCorCat };
    setCATS(prev => [...prev, nova]);
    setAgenda(prev => ({ ...prev, cats: { ...prev.cats, [id]: { slots: [{time:'08:00',msg:'',days:[1,2,3,4,5]},{time:'13:00',msg:'',days:[1,2,3,4,5]},{time:'18:00',msg:'',days:[1,2,3,4,5]}] } } }));
    setModalCat(false);
    setModalNomeCat('');
    toast('Categoria criada!');
  }

  function excluirCategoria(id) {
    setCATS(prev => prev.filter(c => c.id !== id));
    setAgenda(prev => {
      const nova = { ...prev };
      delete nova.cats[id];
      nova.grupos = nova.grupos.map(g => g.cat === id ? { ...g, cat: '' } : g);
      return nova;
    });
    setModalDelCat(null);
    toast('Categoria removida');
  }

  function atualizarCat(id, campo, valor) {
    setCATS(prev => prev.map(c => c.id === id ? { ...c, [campo]: valor } : c));
  }

  // ── Estilos ──
  const s = {
    container: { height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0f0d', borderRadius: 12, overflow: 'hidden', fontFamily: "'Sora', sans-serif", color: '#e8f0ea', fontSize: 13 },
    header: { padding: '10px 14px', borderBottom: '1px solid #1e2e22', display: 'flex', alignItems: 'center', gap: 8, background: '#111a15' },
    logo: { width: 24, height: 24, background: '#25d366', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 },
    title: { flex: 1, fontWeight: 700, fontSize: 13 },
    inst: { fontSize: 10, color: '#7a9980' },
    nav: { display: 'flex', borderBottom: '1px solid #1e2e22', background: '#0a0f0d', overflowX: 'auto' },
    navBtn: (ativa) => ({ flex: 1, minWidth: 50, padding: '9px 4px', background: 'transparent', border: 'none', fontFamily: "'Sora', sans-serif", fontSize: 9, fontWeight: 500, color: ativa ? '#25d366' : '#7a9980', cursor: 'pointer', borderBottom: `2px solid ${ativa ? '#25d366' : 'transparent'}`, whiteSpace: 'nowrap' }),
    sec: { flex: 1, overflowY: 'auto', padding: 12 },
    catCard: { background: '#111a15', border: '1px solid #1e2e22', borderRadius: 10, marginBottom: 10, overflow: 'hidden' },
    catHdr: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', userSelect: 'none' },
    slotLabel: { fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: '#3d5242', margin: '10px 0 4px' },
    timePill: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0a0f0d', border: '1px solid #243329', borderRadius: 20, padding: '3px 8px', marginBottom: 6 },
    daysRow: { display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 },
    dchip: (on) => ({ padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 500, cursor: 'pointer', border: `1px solid ${on ? '#1a9e4a' : '#243329'}`, background: on ? 'rgba(37,211,102,.12)' : 'transparent', color: on ? '#25d366' : '#3d5242', userSelect: 'none' }),
    textarea: { width: '100%', background: '#0a0f0d', border: '1px solid #243329', borderRadius: 8, padding: '8px 10px', fontFamily: "'Sora', sans-serif", fontSize: 11, color: '#e8f0ea', resize: 'none', outline: 'none', minHeight: 60, lineHeight: 1.6, marginBottom: 4, boxSizing: 'border-box' },
    catToggle: (sel, cor) => ({ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: '#0a0f0d', border: `2px solid ${sel ? cor : '#243329'}`, borderRadius: 8, cursor: 'pointer', userSelect: 'none', transition: 'all .2s' }),
    groupItem: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: '#111a15', border: '1px solid #1e2e22', borderRadius: 8, marginBottom: 6 },
    grpStat: { flex: 1, minWidth: 55, background: '#111a15', border: '1px solid #1e2e22', borderRadius: 8, padding: '6px 8px', textAlign: 'center' },
    mgcatItem: { background: '#111a15', border: '1px solid #1e2e22', borderRadius: 10, marginBottom: 8, padding: 10 },
    btn: (bg, color = '#000') => ({ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: bg, color, fontFamily: "'Sora', sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 6 }),
    btnSm: (bg, color = '#000') => ({ padding: '5px 10px', borderRadius: 6, border: 'none', background: bg, color, fontFamily: "'Sora', sans-serif", fontSize: 11, fontWeight: 600, cursor: 'pointer' }),
    input: { width: '100%', background: '#0a0f0d', border: '1px solid #243329', borderRadius: 8, padding: '7px 10px', fontFamily: "'Sora', sans-serif", fontSize: 12, color: '#e8f0ea', outline: 'none', boxSizing: 'border-box', marginBottom: 4 },
    logItem: (ok) => ({ fontSize: 11, padding: '4px 8px', background: '#0a0f0d', borderRadius: 6, borderLeft: `3px solid ${ok ? '#25d366' : '#ff4d4d'}`, marginBottom: 4, color: ok ? '#e8f0ea' : '#7a9980' }),
    sectionTitle: { fontSize: 10, fontWeight: 600, color: '#7a9980', letterSpacing: '.5px', marginBottom: 10, textTransform: 'uppercase' },
  };

  const totalGruposDisparo = (agenda.grupos || []).filter(g => catsSelDisparo.has(g.cat)).length;

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.logo}>💬</div>
        <div style={{ flex: 1 }}>
          <div style={s.title}>WA Scheduler</div>
          <div style={s.inst}>{instancia || 'sem instância'}</div>
        </div>
      </div>

      {/* Nav */}
      <div style={s.nav}>
        {[['mensagens','📋 Msg'],['disparo','⚡ Disparo'],['grupos','👥 Grupos'],['categorias','🏷️ Cats'],['config','⚙️']].map(([id,label]) => (
          <button key={id} style={s.navBtn(secAtiva===id)} onClick={() => setSecAtiva(id)}>{label}</button>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={s.sec}>
        {carregando ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#7a9980' }}>Carregando...</div>
        ) : (

          <>
            {/* ── Mensagens ── */}
            {secAtiva === 'mensagens' && (
              <>
                <div style={s.sectionTitle}>Mensagens programadas</div>
                {CATS.map(cat => {
                  const data = agenda.cats?.[cat.id] || { slots: [{time:'08:00',msg:'',days:[1,2,3,4,5]},{time:'13:00',msg:'',days:[1,2,3,4,5]},{time:'18:00',msg:'',days:[1,2,3,4,5]}] };
                  const grpCount = (agenda.grupos||[]).filter(g => g.cat === cat.id).length;
                  const [aberto, setAberto] = useState(false);
                  return (
                    <div key={cat.id} style={s.catCard}>
                      <div style={s.catHdr} onClick={() => setAberto(a => !a)}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.cor, flexShrink: 0 }} />
                        <div style={{ fontWeight: 600, flex: 1, fontSize: 12 }}>{cat.name}</div>
                        <div style={{ fontSize: 10, color: '#7a9980', background: '#0a0f0d', padding: '1px 6px', borderRadius: 20, border: '1px solid #243329' }}>{grpCount}g</div>
                        <div style={{ fontSize: 10, color: '#3d5242' }}>{aberto ? '▲' : '▼'}</div>
                      </div>
                      {aberto && (
                        <div style={{ padding: '0 12px 12px', borderTop: '1px solid #1e2e22' }}>
                          {data.slots.map((slot, i) => (
                            <div key={i}>
                              <div style={s.slotLabel}>Horário {i+1}</div>
                              <div style={s.timePill}>
                                <span style={{ fontSize: 10, color: '#7a9980' }}>⏰</span>
                                <input type="time" value={slot.time} onChange={e => atualizarSlot(cat.id, i, 'time', e.target.value)}
                                  style={{ background: 'transparent', border: 'none', color: '#25d366', fontSize: 11, fontWeight: 500, outline: 'none', fontFamily: "'Sora', sans-serif", width: 80, colorScheme: 'dark' }} />
                              </div>
                              <div style={s.daysRow}>
                                {DAYS.map((d, j) => (
                                  <span key={j} style={s.dchip(slot.days?.includes(j))} onClick={() => toggleDia(cat.id, i, j)}>{d}</span>
                                ))}
                              </div>
                              <textarea value={slot.msg} onChange={e => atualizarSlot(cat.id, i, 'msg', e.target.value)}
                                placeholder={`Mensagem horário ${i+1}...`} style={s.textarea} rows={3} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button style={s.btn('#25d366')} disabled={salvando} onClick={() => salvarAgenda(agenda)}>
                  {salvando ? 'Salvando...' : '💾 Salvar tudo'}
                </button>
              </>
            )}

            {/* ── Disparo ── */}
            {secAtiva === 'disparo' && (
              <>
                <div style={s.sectionTitle}>Disparo imediato</div>
                <textarea value={disparoMsg} onChange={e => setDisparoMsg(e.target.value)}
                  placeholder="Digite a mensagem..." style={{ ...s.textarea, minHeight: 80 }} />
                <div style={s.sectionTitle}>Categorias</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                  {CATS.map(cat => (
                    <div key={cat.id} style={s.catToggle(catsSelDisparo.has(cat.id), cat.cor)} onClick={() => toggleCatDisparo(cat.id)}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: cat.cor, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 500, color: catsSelDisparo.has(cat.id) ? '#e8f0ea' : '#7a9980', flex: 1, lineHeight: 1.3 }}>{cat.name}</span>
                      {catsSelDisparo.has(cat.id) && <span style={{ color: cat.cor, fontSize: 12 }}>✓</span>}
                    </div>
                  ))}
                </div>
                {catsSelDisparo.size > 0 && (
                  <div style={{ fontSize: 11, color: '#7a9980', marginBottom: 8, padding: '6px 10px', background: '#0a0f0d', borderRadius: 6, border: '1px solid #243329' }}>
                    {totalGruposDisparo} grupo(s) receberão
                  </div>
                )}
                <button style={{ ...s.btn('#ff4d4d', '#fff'), opacity: disparando ? .5 : 1 }} disabled={disparando} onClick={dispararAgora}>
                  {disparando ? 'Enviando...' : '⚡ Enviar agora'}
                </button>
                {logDisparo.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={s.sectionTitle}>Resultado</div>
                    {logDisparo.map((l, i) => (
                      <div key={i} style={s.logItem(l.ok)}>{l.ok ? '✓' : '✗'} {l.nome}{l.status ? ` (${l.status})` : ''}</div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Grupos ── */}
            {secAtiva === 'grupos' && (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  <div style={s.grpStat}><div style={{ fontSize: 16, fontWeight: 700, color: '#25d366' }}>{(agenda.grupos||[]).length}</div><div style={{ fontSize: 9, color: '#7a9980' }}>Total</div></div>
                  <div style={s.grpStat}><div style={{ fontSize: 16, fontWeight: 700, color: '#f0a500' }}>{(agenda.grupos||[]).filter(g=>!g.cat).length}</div><div style={{ fontSize: 9, color: '#7a9980' }}>Sem cat.</div></div>
                  {CATS.map(cat => {
                    const n = (agenda.grupos||[]).filter(g=>g.cat===cat.id).length;
                    return <div key={cat.id} style={s.grpStat}><div style={{ fontSize: 16, fontWeight: 700, color: cat.cor }}>{n}</div><div style={{ fontSize: 9, color: '#7a9980' }}>{cat.name.split(' ')[0]}</div></div>;
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '6px 10px', background: '#111a15', border: '1px solid #1e2e22', borderRadius: 8 }}>
                  <span style={{ fontSize: 11, color: '#7a9980' }}>Sincronização automática</span>
                  <button onClick={sincronizar} style={{ background: 'transparent', border: '1px solid #1a9e4a', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#25d366', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}>🔄 Sync</button>
                </div>
                {(agenda.grupos||[]).map(g => (
                  <div key={g.id} style={s.groupItem}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                      <div style={{ fontSize: 9, color: '#3d5242', marginTop: 1 }}>{g.id}</div>
                    </div>
                    <select value={g.cat||''} onChange={e => setGrupoCat(g.id, e.target.value)}
                      style={{ background: '#0a0f0d', border: '1px solid #243329', borderRadius: 6, padding: '4px 6px', fontSize: 10, color: '#e8f0ea', outline: 'none', fontFamily: "'Sora', sans-serif", maxWidth: 100, flexShrink: 0, cursor: 'pointer' }}>
                      <option value="">— Sem cat —</option>
                      {CATS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                ))}
                <button style={s.btn('#25d366')} disabled={salvando} onClick={() => salvarAgenda(agenda)}>
                  {salvando ? 'Salvando...' : '💾 Salvar categorias'}
                </button>
              </>
            )}

            {/* ── Categorias ── */}
            {secAtiva === 'categorias' && (
              <>
                <div style={s.sectionTitle}>Gerenciar categorias</div>
                {CATS.map(cat => (
                  <div key={cat.id} style={s.mgcatItem}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ position: 'relative', width: 24, height: 24, borderRadius: '50%', background: cat.cor, flexShrink: 0, cursor: 'pointer' }}>
                        <input type="color" value={cat.cor} onChange={e => atualizarCat(cat.id, 'cor', e.target.value)}
                          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', border: 'none', padding: 0 }} />
                      </div>
                      <input type="text" value={cat.name} onChange={e => atualizarCat(cat.id, 'name', e.target.value)}
                        style={{ ...s.input, margin: 0, flex: 1 }} />
                      <button onClick={() => setModalDelCat(cat)} style={{ background: 'transparent', border: '1px solid #243329', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: '#7a9980', cursor: 'pointer' }}>🗑</button>
                    </div>
                    <div style={{ fontSize: 10, color: '#3d5242', marginTop: 4, paddingLeft: 32 }}>
                      {(agenda.grupos||[]).filter(g=>g.cat===cat.id).length} grupo(s)
                    </div>
                  </div>
                ))}
                <button onClick={() => setModalCat(true)}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '2px dashed #243329', background: 'transparent', color: '#7a9980', fontFamily: "'Sora', sans-serif", fontSize: 12, cursor: 'pointer', marginBottom: 8 }}>
                  + Nova categoria
                </button>
                <button style={s.btn('#25d366')} disabled={salvando} onClick={() => salvarAgenda(agenda)}>
                  {salvando ? 'Salvando...' : '💾 Salvar'}
                </button>
              </>
            )}

            {/* ── Config ── */}
            {secAtiva === 'config' && (
              <>
                <div style={s.sectionTitle}>Instância ativa</div>
                <div style={{ background: '#111a15', border: '1px solid #1e2e22', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#25d366' }} />
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{instancia}</span>
                  </div>
                  <button onClick={() => window.open('https://evolution-api-production-6f9a.up.railway.app/manager', '_blank')}
                    style={{ width: '100%', padding: '7px', borderRadius: 7, border: '1px solid #243329', background: 'transparent', color: '#7a9980', fontFamily: "'Sora', sans-serif", fontSize: 11, cursor: 'pointer' }}>
                    Abrir Evolution Manager →
                  </button>
                </div>
                <div style={{ background: '#111a15', border: '1px solid #1e2e22', borderRadius: 10, padding: 12 }}>
                  <div style={s.sectionTitle}>Usar outra conta</div>
                  <div style={{ fontSize: 11, color: '#7a9980', lineHeight: 1.8 }}>
                    1. Acesse o Evolution Manager<br/>
                    2. Crie nova instância e conecte via QR Code<br/>
                    3. No seu perfil do CRM, atualize o campo de instância<br/>
                    4. Recarregue esta página
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          background: '#111a15', border: `1px solid ${toastWarn ? '#f0a500' : '#1a9e4a'}`,
          borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 500,
          color: toastWarn ? '#f0a500' : '#25d366', whiteSpace: 'nowrap', zIndex: 10
        }}>{toastMsg}</div>
      )}

      {/* Modal nova categoria */}
      {modalCat && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: 16 }}>
          <div style={{ background: '#111a15', border: '1px solid #1e2e22', borderRadius: 14, padding: 20, width: '100%', maxWidth: 280 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14 }}>Nova categoria</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ position: 'relative', width: 32, height: 32, borderRadius: '50%', background: modalCorCat, flexShrink: 0, cursor: 'pointer' }}>
                <input type="color" value={modalCorCat} onChange={e => setModalCorCat(e.target.value)}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', border: 'none' }} />
              </div>
              <input value={modalNomeCat} onChange={e => setModalNomeCat(e.target.value)} placeholder="Nome da categoria"
                style={{ ...s.input, margin: 0, flex: 1 }} autoFocus />
            </div>
            <p style={{ fontSize: 11, color: '#7a9980', marginBottom: 14 }}>Clique no círculo para escolher a cor.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModalCat(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #243329', background: 'transparent', color: '#7a9980', fontFamily: "'Sora', sans-serif", fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={criarCategoria} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#25d366', color: '#000', fontFamily: "'Sora', sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal excluir categoria */}
      {modalDelCat && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: 16 }}>
          <div style={{ background: '#111a15', border: '1px solid #1e2e22', borderRadius: 14, padding: 20, width: '100%', maxWidth: 280 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Apagar categoria?</h3>
            <p style={{ fontSize: 12, color: '#7a9980', marginBottom: 6 }}>Apagar "{modalDelCat.name}"?</p>
            <p style={{ fontSize: 11, color: '#f0a500', marginBottom: 16 }}>Os grupos dessa categoria ficarão sem categoria.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModalDelCat(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #243329', background: 'transparent', color: '#7a9980', fontFamily: "'Sora', sans-serif", fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => excluirCategoria(modalDelCat.id)} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#ff4d4d', color: '#fff', fontFamily: "'Sora', sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Apagar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ResumoDemandasTab ─────────────────────────────────────────────────────────
export default function ResumoDemandasTab({ data, darkMode, perfil }) {
  const [copiado, setCopiado] = useState(false);
  const [editando, setEditando] = useState(false);
  const [textoEditado, setTextoEditado] = useState('');
  const [textoParaDisparo, setTextoParaDisparo] = useState(null);

  const ativas = useMemo(() => data.filter(c => {
    if (c.ativo !== 'S') return false;
    if (c.is_corretor) return false;
    if (!c.solicitar_parceria) return false;
    const etapasAvancadas = ['proposta','contrato','financiamento','recebimento','recebido'];
    if (etapasAvancadas.some(e => c[e])) return false;
    return true;
  }), [data]);

  const porModalidade = useMemo(() => {
    const grupos = {};
    ativas.forEach(c => {
      const mod = c.modalidade || 'Outros';
      if (!grupos[mod]) grupos[mod] = [];
      grupos[mod].push(c);
    });
    return grupos;
  }, [ativas]);

  const textoGerado = useMemo(() => gerarTexto(ativas, porModalidade), [ativas, porModalidade]);

  useEffect(() => {
    setTextoEditado(textoGerado);
    setEditando(false);
  }, [textoGerado]);

  const textoFinal = textoEditado || textoGerado;

  function copiar() {
    navigator.clipboard.writeText(textoFinal).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  function resetar() {
    setTextoEditado(textoGerado);
    setEditando(false);
  }

  const instancia = perfil?.whatsapp_instancia || '';

  const card = darkMode ? '#16213e' : '#ffffff';
  const border = darkMode ? '#0f3460' : '#e2e8f0';
  const textColor = darkMode ? '#e2e8f0' : '#1a202c';
  const textMuted = darkMode ? '#94a3b8' : '#64748b';

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', color: textColor }}>

      {/* ── Lado esquerdo: Demandas ── */}
      <div style={{ flex: '0 0 55%', minWidth: 0 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>📋 Demandas</h2>
          <p style={{ margin: '6px 0 0', color: textMuted, fontSize: 13 }}>
            Tratativas ativas com parceria solicitada.{' '}
            <strong>{ativas.length}</strong> demanda{ativas.length !== 1 ? 's' : ''}.
          </p>
        </div>

        {ativas.length === 0 ? (
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 40, textAlign: 'center', color: textMuted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🤝</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Nenhuma demanda encontrada</div>
            <div style={{ fontSize: 13 }}>Marque "Solicitar Parceria" em uma tratativa.</div>
          </div>
        ) : (
          <>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  Mensagem {editando && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 400 }}>— editando</span>}
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {editando && (
                    <button onClick={resetar} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      ↺ Resetar
                    </button>
                  )}
                  <button onClick={() => setEditando(e => !e)}
                    style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid ${editando ? '#f59e0b' : '#d1d5db'}`, background: editando ? '#fffbeb' : '#fff', color: editando ? '#b45309' : '#6b7280', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {editando ? '✓ Concluir' : '✏️ Editar'}
                  </button>
                  <button onClick={copiar}
                    style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: copiado ? '#059669' : '#2563eb', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {copiado ? '✓ Copiado!' : '📋 Copiar'}
                  </button>
                  <button onClick={() => {
                    if (!instancia) { alert('Configure sua instância no perfil.'); return; }
                    setTextoParaDisparo(textoFinal);
                  }}
                    style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#25d366', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    💬 Enviar →
                  </button>
                </div>
              </div>

              {editando ? (
                <textarea value={textoFinal} onChange={e => setTextoEditado(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', minHeight: 180, padding: '10px 12px', fontFamily: 'Inter, sans-serif', fontSize: 12, lineHeight: 1.8, border: '2px solid #f59e0b', borderRadius: 8, background: darkMode ? '#0f1117' : '#fffbeb', color: textColor, resize: 'vertical', outline: 'none' }} />
              ) : (
                <pre style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: textColor, margin: 0, padding: '10px 12px', background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 8, border: `1px solid ${border}` }}>
                  {textoFinal}
                </pre>
              )}
              <div style={{ marginTop: 8, fontSize: 11, color: textMuted }}>
                Formato: <strong>Imóvel Região. Observações. Preço</strong>
                {instancia && <span style={{ marginLeft: 10, color: '#25d366' }}>● {instancia}</span>}
              </div>
            </div>

            {Object.entries(porModalidade).map(([mod, clientes]) => (
              <div key={mod} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 16, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>
                    {mod === 'Compra' ? '🛒' : mod === 'Venda' ? '🏠' : mod === 'Locação' ? '🔑' : '📄'} {mod}
                  </span>
                  <span style={{ fontSize: 11, color: textMuted, background: darkMode ? '#0f3460' : '#f1f5f9', padding: '2px 8px', borderRadius: 20 }}>
                    {clientes.length} demanda{clientes.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {clientes.map(c => (
                    <div key={c.id} style={{ background: darkMode ? '#0f1117' : '#f8fafc', border: `1px solid ${border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                      <div style={{ fontWeight: 600, marginBottom: 3 }}>{c.nome}</div>
                      <div style={{ color: textMuted, lineHeight: 1.6, fontSize: 11 }}>
                        {[c.imovel, c.localizacao].filter(Boolean).join(' ')}
                        {c.detalhes_externos && <span> · {c.detalhes_externos}</span>}
                        {c.valor !== '' && c.valor !== null && c.valor !== undefined && (
                          <span style={{ color: Number(c.valor) === 0 ? '#9ca3af' : '#059669', fontWeight: 600 }}>
                            {' · '}{Number(c.valor) === 0 ? 'Em aberto' : `R$ ${Number(c.valor).toLocaleString('pt-BR')}`}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Lado direito: WA Scheduler ── */}
      <div style={{ flex: '0 0 42%', position: 'sticky', top: 0, height: 'calc(100vh - 120px)', minHeight: 500 }}>
        {instancia ? (
          <WAScheduler
            instancia={instancia}
            textoParaDisparo={textoParaDisparo}
            onTextoUsado={() => setTextoParaDisparo(null)}
          />
        ) : (
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 24, textAlign: 'center', color: textMuted }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>💬</div>
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 14 }}>WA Scheduler</div>
            <div style={{ fontSize: 12 }}>Configure sua instância do WhatsApp no seu Perfil para usar o disparador aqui.</div>
          </div>
        )}
      </div>
    </div>
  );
}
