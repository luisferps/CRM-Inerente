import { useState, useMemo, useEffect, useCallback } from 'react';

const WA_AGENT_URL = 'https://agentes-de-whatsapp-production.up.railway.app';
const WA_EVOLUTION_URL = 'https://evolution-api-production-6f9a.up.railway.app';
const WA_API_KEY = '40d03599cab78737a4c9eaf7c00723dbe1bc93b6b329fce0a80ff43d393e4c47';
const DAYS_LABEL = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];

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

// ── Painel WA (lado direito) ──────────────────────────────────────────────────
function WAPainel({ instancia, mensagemCRM, darkMode }) {
  const [agenda, setAgenda] = useState({ cats: {}, grupos: [], categorias: [] });
  const [CATS, setCATS] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [secAtiva, setSecAtiva] = useState('mensagens');

  // Slot substituído: { catId, slotIdx, msgOriginal }
  const [slotSubstituido, setSlotSubstituido] = useState(null);

  // Disparo
  const [disparoMsg, setDisparoMsg] = useState('');
  const [catsSelDisparo, setCatsSelDisparo] = useState(new Set());
  const [logDisparo, setLogDisparo] = useState([]);
  const [disparando, setDisparando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastWarn, setToastWarn] = useState(false);

  const card = darkMode ? '#16213e' : '#ffffff';
  const border = darkMode ? '#0f3460' : '#e2e8f0';
  const textColor = darkMode ? '#e2e8f0' : '#1a202c';
  const textMuted = darkMode ? '#94a3b8' : '#64748b';
  const bg = darkMode ? '#0f1117' : '#f8fafc';
  const accentBg = darkMode ? 'rgba(37,99,235,0.08)' : '#eff6ff';

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
    } catch { toast('Erro ao carregar dados do WA Scheduler', true); }
    setCarregando(false);
  }, [instancia]);

  useEffect(() => { carregarAgenda(); }, [carregarAgenda]);

  // Quando mensagem do CRM muda, preenche campo de disparo
  useEffect(() => {
    if (mensagemCRM) setDisparoMsg(mensagemCRM);
  }, [mensagemCRM]);

  // Substituir slot por mensagem do CRM
  function substituirSlot(catId, slotIdx) {
    if (!mensagemCRM) { toast('Nenhuma mensagem gerada ainda', true); return; }

    setAgenda(prev => {
      const novaCats = { ...prev.cats };

      // Restaura slot anterior se havia substituição
      if (slotSubstituido && novaCats[slotSubstituido.catId]?.slots) {
        const slots = [...novaCats[slotSubstituido.catId].slots];
        slots[slotSubstituido.slotIdx] = { ...slots[slotSubstituido.slotIdx], msg: slotSubstituido.msgOriginal };
        novaCats[slotSubstituido.catId] = { ...novaCats[slotSubstituido.catId], slots };
      }

      // Se clicou no mesmo slot, só restaura (desfaz)
      if (slotSubstituido?.catId === catId && slotSubstituido?.slotIdx === slotIdx) {
        setSlotSubstituido(null);
        return { ...prev, cats: novaCats };
      }

      // Substitui novo slot
      const msgOriginal = novaCats[catId]?.slots?.[slotIdx]?.msg || '';
      const slots = [...(novaCats[catId]?.slots || [])];
      slots[slotIdx] = { ...slots[slotIdx], msg: mensagemCRM };
      novaCats[catId] = { ...novaCats[catId], slots };
      setSlotSubstituido({ catId, slotIdx, msgOriginal });

      return { ...prev, cats: novaCats };
    });
  }

  async function salvarSubstituicao() {
    if (!slotSubstituido) { toast('Selecione um slot para substituir', true); return; }
    setSalvando(true);
    try {
      const r = await fetch(`${WA_AGENT_URL}/scheduler/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': WA_API_KEY, 'x-instancia': instancia },
        body: JSON.stringify({ ...agenda, instancia, categorias: CATS })
      });
      if (r.ok) toast('Mensagem salva no agendamento!');
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

  async function dispararAgora() {
    if (!disparoMsg.trim()) { toast('Digite a mensagem', true); return; }
    if (!catsSelDisparo.size) { toast('Selecione uma categoria', true); return; }
    const grupos = (agenda.grupos || []).filter(g => catsSelDisparo.has(g.cat));
    if (!grupos.length) { toast('Nenhum grupo nas categorias selecionadas', true); return; }
    setDisparando(true);
    setLogDisparo([]);
    let ok = 0, err = 0;
    for (const g of grupos) {
      try {
        const r = await fetch(`${WA_EVOLUTION_URL}/message/sendText/${instancia}`, {
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

  const totalGruposDisparo = (agenda.grupos || []).filter(g => catsSelDisparo.has(g.cat)).length;

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
        {slotSubstituido && (
          <span style={{ fontSize: 10, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
            1 slot substituído
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
            {/* ── Mensagens ── */}
            {secAtiva === 'mensagens' && (
              <>
                <p style={{ fontSize: 12, color: textMuted, marginBottom: 14, lineHeight: 1.6 }}>
                  Clique em um horário para substituir a mensagem agendada pela mensagem gerada automaticamente. Clique novamente para desfazer.
                </p>

                {CATS.map(cat => {
                  const slots = agenda.cats?.[cat.id]?.slots || [];
                  const grpCount = (agenda.grupos || []).filter(g => g.cat === cat.id).length;
                  return (
                    <div key={cat.id} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.cor, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, fontSize: 13, color: textColor, flex: 1 }}>{cat.name}</span>
                        <span style={{ fontSize: 11, color: textMuted }}>{grpCount} grupo{grpCount !== 1 ? 's' : ''}</span>
                      </div>

                      {slots.map((slot, i) => {
                        const isSub = slotSubstituido?.catId === cat.id && slotSubstituido?.slotIdx === i;
                        return (
                          <div key={i}
                            onClick={() => substituirSlot(cat.id, i)}
                            style={{
                              border: `2px solid ${isSub ? '#2563eb' : border}`,
                              borderRadius: 10, padding: '10px 12px', marginBottom: 8,
                              background: isSub ? accentBg : bg,
                              cursor: mensagemCRM ? 'pointer' : 'default',
                              transition: 'all .15s'
                            }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 11, color: isSub ? '#2563eb' : textMuted, fontWeight: 600 }}>
                                ⏰ {slot.time}
                              </span>
                              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', flex: 1 }}>
                                {DAYS_LABEL.map((d, j) => (
                                  <span key={j} style={{
                                    fontSize: 9, padding: '1px 5px', borderRadius: 20,
                                    background: slot.days?.includes(j) ? (isSub ? '#bfdbfe' : '#f1f5f9') : 'transparent',
                                    color: slot.days?.includes(j) ? (isSub ? '#1d4ed8' : textMuted) : '#d1d5db',
                                    fontWeight: slot.days?.includes(j) ? 600 : 400
                                  }}>{d}</span>
                                ))}
                              </div>
                              {isSub && (
                                <span style={{ fontSize: 10, color: '#2563eb', fontWeight: 700, flexShrink: 0 }}>● Substituído</span>
                              )}
                            </div>
                            <div style={{
                              fontSize: 11, color: isSub ? '#1d4ed8' : textMuted,
                              lineHeight: 1.5, maxHeight: 48, overflow: 'hidden',
                              textOverflow: 'ellipsis', display: '-webkit-box',
                              WebkitLineClamp: 3, WebkitBoxOrient: 'vertical'
                            }}>
                              {slot.msg || <em style={{ color: '#d1d5db' }}>Sem mensagem configurada</em>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {slotSubstituido && (
                  <button onClick={salvarSubstituicao} disabled={salvando}
                    style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: salvando ? '#9ca3af' : '#2563eb', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700, cursor: salvando ? 'not-allowed' : 'pointer', marginTop: 4 }}>
                    {salvando ? 'Salvando...' : '💾 Salvar substituição no agendamento'}
                  </button>
                )}
              </>
            )}

            {/* ── Disparo ── */}
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
                  <div style={{ fontSize: 12, color: textMuted, marginBottom: 12, padding: '8px 12px', background: bg, borderRadius: 8, border: `1px solid ${border}` }}>
                    📤 {totalGruposDisparo} grupo(s) receberão a mensagem
                  </div>
                )}

                <button disabled={disparando} onClick={dispararAgora}
                  style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: disparando ? '#9ca3af' : '#dc2626', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 700, cursor: disparando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {disparando ? '⏳ Enviando...' : '⚡ Enviar agora'}
                </button>

                {logDisparo.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Resultado</div>
                    {logDisparo.map((l, i) => (
                      <div key={i} style={{ fontSize: 12, padding: '6px 10px', background: bg, borderRadius: 8, borderLeft: `3px solid ${l.ok ? '#059669' : '#dc2626'}`, marginBottom: 5, color: l.ok ? textColor : textMuted }}>
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
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          background: card, border: `1px solid ${toastWarn ? '#f59e0b' : '#059669'}`,
          borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 600,
          color: toastWarn ? '#b45309' : '#059669', whiteSpace: 'nowrap', zIndex: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          {toastMsg}
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
  const instancia = perfil?.whatsapp_instancia || '';

  const card = darkMode ? '#16213e' : '#ffffff';
  const border = darkMode ? '#0f3460' : '#e2e8f0';
  const textColor = darkMode ? '#e2e8f0' : '#1a202c';
  const textMuted = darkMode ? '#94a3b8' : '#64748b';
  const bg = darkMode ? '#0f1117' : '#f8fafc';

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', color: textColor }}>

      {/* ── Esquerda: Demandas ── */}
      <div style={{ flex: '0 0 54%', minWidth: 0 }}>
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

              {editando ? (
                <textarea value={textoFinal} onChange={e => setTextoEditado(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', minHeight: 180, padding: '10px 12px', fontFamily: 'Inter,sans-serif', fontSize: 12, lineHeight: 1.8, border: '2px solid #f59e0b', borderRadius: 8, background: darkMode ? '#0f1117' : '#fffbeb', color: textColor, resize: 'vertical', outline: 'none' }} />
              ) : (
                <pre style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: textColor, margin: 0, padding: '10px 12px', background: bg, borderRadius: 8, border: `1px solid ${border}` }}>
                  {textoFinal}
                </pre>
              )}
              <div style={{ marginTop: 8, fontSize: 11, color: textMuted }}>
                Formato: <strong>Imóvel Região. Observações. Preço</strong>
                {instancia && <span style={{ marginLeft: 10, color: '#25d366', fontWeight: 600 }}>● {instancia}</span>}
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
                    <div key={c.id} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
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

      {/* ── Direita: WA Scheduler ── */}
      <div style={{ flex: '0 0 43%', position: 'sticky', top: 0, height: 'calc(100vh - 130px)', minHeight: 500 }}>
        {instancia ? (
          <WAPainel
            instancia={instancia}
            mensagemCRM={textoFinal}
            darkMode={darkMode}
          />
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
