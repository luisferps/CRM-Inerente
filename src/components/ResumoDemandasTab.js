import { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const WA_AGENT_URL = 'https://agentes-de-whatsapp-production.up.railway.app';
const TITULO_PADRAO = 'Preciso de: (enviar somente imóveis nos perfis relacionados)';

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
function formatarPreco(valor) {
  const n = Number(valor);
  if (valor === '' || valor === null || valor === undefined) return null;
  if (n === 0) return 'Em aberto';
  return `Paga até R$ ${n.toLocaleString('pt-BR')}`;
}
function formatarLinha(c) {
  const limpar = p => String(p).replace(/\s+/g, ' ').replace(/\.\s*$/, '').trim();
  const imovel = c.imovel ? limpar(capitalize(c.imovel)) : '';
  const local = c.localizacao ? limpar(capitalize(c.localizacao)) : '';
  // Demais partes (observações externas + preço), juntadas com ". "
  const resto = [];
  if (c.detalhes_externos) resto.push(limpar(capitalize(c.detalhes_externos.trim())));
  const preco = formatarPreco(c.valor);
  if (preco) resto.push(limpar(preco));

  let cabeca;
  if (imovel && local) {
    // Só entre imóvel e local o separador é ":"
    cabeca = `${imovel}: ${local}`;
  } else {
    cabeca = [imovel, local].filter(Boolean).join('. ');
  }
  const texto = [cabeca, ...resto].filter(Boolean).join('. ');
  return `- ${texto}.`;
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

function WAPainelDisparos({ instancia, darkMode, refreshKey }) {
  const [preview, setPreview] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState('agendadas');

  const card = darkMode ? '#16213e' : '#ffffff';
  const border = darkMode ? '#0f3460' : '#e2e8f0';
  const textColor = darkMode ? '#e2e8f0' : '#1a202c';
  const textMuted = darkMode ? '#94a3b8' : '#64748b';
  const accentBg = darkMode ? 'rgba(37,99,235,0.08)' : '#eff6ff';

  const carregarPreview = useCallback(async () => {
    if (!instancia) return;
    setLoadingPreview(true);
    setErro('');
    try {
      const r = await fetch(`${WA_AGENT_URL}/scheduler/preview?instancia=${encodeURIComponent(instancia)}`);
      if (!r.ok) throw new Error('Erro ' + r.status);
      const data = await r.json();
      setPreview(data);
    } catch (err) {
      setErro('Erro carregando: ' + err.message);
    } finally {
      setLoadingPreview(false);
    }
  }, [instancia]);

  const carregarHistorico = useCallback(async () => {
    if (!instancia) return;
    setLoadingHistorico(true);
    try {
      const r = await fetch(`${WA_AGENT_URL}/scheduler/historico?instancia=${encodeURIComponent(instancia)}&tipo=crm`);
      if (!r.ok) throw new Error('Erro ' + r.status);
      const data = await r.json();
      setHistorico(data.historico || []);
    } catch (err) {
      console.warn('Erro histórico:', err.message);
    } finally {
      setLoadingHistorico(false);
    }
  }, [instancia]);

  useEffect(() => {
    carregarPreview();
    carregarHistorico();
  }, [carregarPreview, carregarHistorico, refreshKey]);

  const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const formatarDias = (days) => {
    if (!Array.isArray(days) || !days.length) return '—';
    if (days.length === 7) return 'Todos os dias';
    return days.map(d => DAYS[d]).join(', ');
  };
  const formatarData = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const navBtnStyle = (ativa) => ({
    flex: 1, padding: '10px 8px', background: 'transparent', border: 'none',
    borderBottom: `2px solid ${ativa ? '#2563eb' : 'transparent'}`,
    color: ativa ? '#2563eb' : textMuted, fontFamily: 'Inter, sans-serif',
    fontSize: 12, fontWeight: ativa ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap'
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: card, border: `1px solid ${border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, background: '#25d366', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>💬</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: textColor }}>Disparos WhatsApp</div>
          <div style={{ fontSize: 10, color: textMuted }}>{instancia}</div>
        </div>
        <button onClick={() => { carregarPreview(); carregarHistorico(); }}
          style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${border}`, background: 'transparent', color: textMuted, fontSize: 11, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          🔄
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${border}` }}>
        <button style={navBtnStyle(aba === 'agendadas')} onClick={() => setAba('agendadas')}>📅 Agendadas</button>
        <button style={navBtnStyle(aba === 'historico')} onClick={() => setAba('historico')}>📜 Histórico</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {erro && (
          <div style={{ background: '#fee', border: '1px solid #fcc', color: '#c00', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
            {erro}
          </div>
        )}

        {aba === 'agendadas' && (
          <>
            {loadingPreview && (
              <div style={{ textAlign: 'center', padding: 20, color: textMuted, fontSize: 12 }}>Calculando…</div>
            )}
            {!loadingPreview && preview && (
              <>
                <div style={{ background: accentBg, border: `1px solid ${border}`, padding: '10px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12, color: textColor }}>
                  {preview.agendado ? (
                    <div>
                      <strong>Horário 1 (CRM):</strong> {preview.agendado.time}
                      <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>{formatarDias(preview.agendado.days)}</div>
                      {preview.agendado.ativo === false && (
                        <div style={{ color: '#dc2626', marginTop: 4, fontSize: 11, fontWeight: 600 }}>● Desligado</div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: textMuted }}>Horário do CRM não configurado.</div>
                  )}
                  {preview.totalDemandas !== undefined && (
                    <div style={{ marginTop: 6, fontSize: 11, color: textMuted }}>
                      {preview.totalDemandas} demanda(s) elegível(eis) · {preview.totalGruposCasados || 0} de {preview.totalGruposAtivos || 0} grupos ativos
                    </div>
                  )}
                  {preview.razao && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#b45309', fontStyle: 'italic' }}>{preview.razao}</div>
                  )}
                </div>

                {preview.agrupado && preview.agrupado.length > 0 ? (
                  preview.agrupado.map((bloco, i) => (
                    <CardMensagem key={i} mensagem={bloco.mensagem} grupos={bloco.grupos} darkMode={darkMode} />
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: 20, color: textMuted, fontSize: 12, fontStyle: 'italic' }}>
                    Nenhuma mensagem agendada.
                  </div>
                )}
              </>
            )}
          </>
        )}

        {aba === 'historico' && (
          <>
            {loadingHistorico && (
              <div style={{ textAlign: 'center', padding: 20, color: textMuted, fontSize: 12 }}>Carregando…</div>
            )}
            {!loadingHistorico && historico.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: textMuted, fontSize: 12, fontStyle: 'italic' }}>
                Nenhum envio registrado ainda.
              </div>
            )}
            {!loadingHistorico && historico.map(h => (
              <CardMensagem key={h.id} mensagem={h.mensagem}
                grupos={(h.grupos || []).map(g => ({ id: g.id, nome: g.nome, status: g.status }))}
                data={formatarData(h.quando)} mostrarStatus darkMode={darkMode} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function CardMensagem({ mensagem, grupos, data, mostrarStatus, darkMode }) {
  const [aberto, setAberto] = useState(false);
  const card = darkMode ? '#0f1117' : '#fff';
  const border = darkMode ? '#0f3460' : '#e5e7eb';
  const textColor = darkMode ? '#e2e8f0' : '#1a202c';
  const textMuted = darkMode ? '#94a3b8' : '#6b7280';
  const bg = darkMode ? '#0f1117' : '#f9fafb';
  return (
    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {data && <div style={{ fontSize: 11, color: textMuted }}>{data}</div>}
          <div style={{ fontWeight: 500, fontSize: 12, color: textColor, marginTop: 2 }}>
            {grupos.length} grupo(s) {mostrarStatus ? 'receberam' : 'receberão'}
          </div>
        </div>
        <button onClick={() => setAberto(!aberto)}
          style={{ background: 'transparent', border: 'none', color: '#2563eb', fontSize: 11, cursor: 'pointer', padding: '2px 6px', whiteSpace: 'nowrap' }}>
          {aberto ? 'Recolher ▲' : 'Ver ▼'}
        </button>
      </div>
      {aberto && (
        <>
          <pre style={{ background: bg, border: `1px solid ${border}`, padding: 10, borderRadius: 7, fontSize: 11, fontFamily: 'Inter,sans-serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 10, color: textColor, lineHeight: 1.6 }}>
            {mensagem}
          </pre>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${border}` }}>
            <div style={{ fontSize: 10, color: textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600 }}>Grupos:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {grupos.map((g, i) => (
                <span key={i} style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 12,
                  background: g.status === 'erro' ? '#fee' : (g.status === 'ok' ? '#eef9ee' : (darkMode ? '#0f3460' : '#eff6ff')),
                  color: g.status === 'erro' ? '#c00' : (g.status === 'ok' ? '#2a7' : '#2563eb'),
                  border: '1px solid ' + (g.status === 'erro' ? '#fcc' : (g.status === 'ok' ? '#bce8bc' : (darkMode ? '#1e3a5c' : '#bfdbfe')))
                }}>
                  {g.nome}{mostrarStatus && g.status && ` · ${g.status === 'ok' ? '✓' : '✗'}`}
                </span>
              ))}
            </div>
          </div>
        </>
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
  const [tituloCarregado, setTituloCarregado] = useState(false);
  const [salvandoTitulo, setSalvandoTitulo] = useState(false);
  const [refreshDireita, setRefreshDireita] = useState(0);
  const [amostras, setAmostras] = useState([]);
  const [carregandoAmostra, setCarregandoAmostra] = useState(false);

  const instancia = perfil?.whatsapp_instancia || '';

  // Carrega título do banco ao abrir
  useEffect(() => {
    if (!instancia) { setTituloCarregado(true); return; }
    fetch(`${WA_AGENT_URL}/scheduler/agenda?instancia=${encodeURIComponent(instancia)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.titulo_crm) setTitulo(d.titulo_crm);
        setTituloCarregado(true);
      })
      .catch(() => setTituloCarregado(true));
  }, [instancia]);

  // Salva título no banco com debounce de 1.5s.
  // Estratégia: lê tudo, altera só o titulo_crm, regrava (preserva grupos/horarios/etc).
  useEffect(() => {
    if (!tituloCarregado) return;
    if (!instancia) return;
    const timer = setTimeout(async () => {
      setSalvandoTitulo(true);
      try {
        const rGet = await fetch(`${WA_AGENT_URL}/scheduler/agenda?instancia=${encodeURIComponent(instancia)}`);
        if (!rGet.ok) throw new Error('GET ' + rGet.status);
        const agenda = await rGet.json();
        const payload = {
          instancia,
          titulo_crm: titulo,
          horarios: agenda.horarios,
          grupos: agenda.grupos,
          regioes: agenda.regioes,
          cats: agenda.cats,
          categorias: agenda.categorias,
          mapeamento_modalidade: agenda.mapeamento_modalidade
        };
        Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
        const r = await fetch(`${WA_AGENT_URL}/scheduler/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-instancia': instancia },
          body: JSON.stringify(payload)
        });
        if (r.ok) setRefreshDireita(k => k + 1);
      } catch (e) {
        console.warn('Erro salvando título:', e.message);
      } finally {
        setSalvandoTitulo(false);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [titulo, instancia, tituloCarregado]);

  const elegiveis = useMemo(() => data.filter(c => {
    if (c.ativo !== 'S') return false;
    if (c.is_corretor) return false;
    if (c.modalidade === 'Venda') return false;
    const etapasAvancadas = ['contrato','financiamento','recebimento','recebido'];
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

  async function verAmostra() {
    if (!textoFinal.trim()) return;
    setCarregandoAmostra(true);
    setAmostras([]);
    try {
      const r = await fetch(`${WA_AGENT_URL}/demandas/amostra-variacao`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textoFinal })
      });
      const j = await r.json();
      if (j.ok && j.ativo === false) setAmostras(['A variação por IA está desligada — a mensagem sai exatamente como está acima.']);
      else if (j.ok && j.amostras && j.amostras.length) setAmostras(j.amostras);
      else if (j.ok) setAmostras(['Não consegui gerar a amostra agora. Tente de novo.']);
      else setAmostras(['Erro ao gerar amostra: ' + (j.error || 'desconhecido')]);
    } catch (e) { setAmostras(['Erro ao gerar amostra: ' + e.message]); }
    setCarregandoAmostra(false);
  }

  const card = darkMode ? '#16213e' : '#ffffff';
  const border = darkMode ? '#0f3460' : '#e2e8f0';
  const textColor = darkMode ? '#e2e8f0' : '#1a202c';
  const textMuted = darkMode ? '#94a3b8' : '#64748b';
  const bg = darkMode ? '#0f1117' : '#f8fafc';

  const ordem = ['Compra', 'Locação'];
  const mods = [...new Set([...ordem.filter(m => porModalidade[m]), ...Object.keys(porModalidade).filter(m => !ordem.includes(m))])];

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', color: textColor }}>
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
                                {' · '}{Number(c.valor) === 0 ? 'Em aberto' : `Paga até R$ ${Number(c.valor).toLocaleString('pt-BR')}`}
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
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
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
                  {salvandoTitulo && <span style={{ fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>salvando…</span>}
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
                  <button onClick={verAmostra} disabled={!textoFinal || carregandoAmostra}
                    style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: (!textoFinal || carregandoAmostra) ? '#c4b5fd' : '#7c3aed', color: '#fff', fontSize: 11, fontWeight: 600, cursor: (!textoFinal || carregandoAmostra) ? 'default' : 'pointer' }}>
                    {carregandoAmostra ? '✨ gerando…' : '✨ Ver amostra da variação'}
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
              {amostras.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: '#7c3aed' }}>✨ Como a IA vai variar (cada grupo recebe uma versão nova):</div>
                  {amostras.map((a, i) => (
                    <pre key={i} style={{ fontFamily: 'Inter,sans-serif', fontSize: 11.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: textColor, margin: '0 0 10px', padding: '10px 12px', background: darkMode ? '#1e1b2e' : '#faf5ff', borderRadius: 8, border: '1px solid #ddd6fe' }}>
                      {a}
                    </pre>
                  ))}
                  <div style={{ fontSize: 10.5, color: textMuted, fontStyle: 'italic' }}>
                    Confira que preço, bairro, quartos e contato aparecem em todos os exemplos. O envio real gera uma versão fresca pra cada grupo — nunca sai igual.
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div style={{ flex: '0 0 43%', position: 'sticky', top: 0, height: 'calc(100vh - 130px)', minHeight: 500 }}>
        {instancia ? (
          <WAPainelDisparos instancia={instancia} darkMode={darkMode} refreshKey={refreshDireita} />
        ) : (
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 32, textAlign: 'center', color: textMuted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: textColor }}>Disparos WhatsApp</div>
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
              Configure sua instância do WhatsApp na aba <strong>Perfil</strong> para visualizar os disparos aqui.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
