import { useState, useMemo, useEffect } from 'react';

const WA_AGENT_URL = 'https://agentes-de-whatsapp-production.up.railway.app';
const WA_API_KEY = '40d03599cab78737a4c9eaf7c00723dbe1bc93b6b329fce0a80ff43d393e4c47';

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

// ── Modal de Disparo ──────────────────────────────────────────────────────────
function ModalDisparo({ texto, instancia, onClose, darkMode }) {
  const [modo, setModo] = useState('agora'); // 'agora' | 'agendar'
  const [categorias, setCategorias] = useState([]);
  const [catsSelecionadas, setCatsSelecionadas] = useState([]);
  const [dataAgendada, setDataAgendada] = useState('');
  const [horaAgendada, setHoraAgendada] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  const bg = darkMode ? '#16213e' : '#fff';
  const border = darkMode ? '#0f3460' : '#e2e8f0';
  const textColor = darkMode ? '#e2e8f0' : '#1a202c';
  const textMuted = darkMode ? '#94a3b8' : '#64748b';

  useEffect(() => {
    async function buscarCategorias() {
      try {
        const res = await fetch(`${WA_AGENT_URL}/scheduler/agenda?instancia=${encodeURIComponent(instancia)}`);
        const data = await res.json();
        const cats = data.categorias || [];
        setCategorias(cats);
      } catch (e) {
        setErro('Não foi possível carregar as categorias do WA Scheduler.');
      } finally {
        setCarregando(false);
      }
    }
    buscarCategorias();
  }, [instancia]);

  function toggleCat(id) {
    setCatsSelecionadas(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }

  async function enviarAgora() {
    if (!catsSelecionadas.length) { setErro('Selecione pelo menos uma categoria.'); return; }
    setErro('');
    setEnviando(true);
    let ok = 0, erros = 0;

    // Busca grupos de cada categoria selecionada
    try {
      const res = await fetch(`${WA_AGENT_URL}/scheduler/agenda?instancia=${encodeURIComponent(instancia)}`);
      const data = await res.json();
      const grupos = (data.grupos || []).filter(g => catsSelecionadas.includes(g.cat));

      for (const grupo of grupos) {
        try {
          const r = await fetch(`https://evolution-api-production-6f9a.up.railway.app/message/sendText/${encodeURIComponent(instancia)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': WA_API_KEY },
            body: JSON.stringify({ number: grupo.id, text: texto, delay: 1000 })
          });
          if (r.ok) ok++; else erros++;
        } catch { erros++; }
        await new Promise(r => setTimeout(r, 800));
      }
      setResultado({ ok, erros, total: grupos.length });
    } catch (e) {
      setErro('Erro ao buscar grupos: ' + e.message);
    }
    setEnviando(false);
  }

  async function salvarAgendamento() {
    if (!catsSelecionadas.length) { setErro('Selecione pelo menos uma categoria.'); return; }
    if (!dataAgendada || !horaAgendada) { setErro('Informe a data e hora do agendamento.'); return; }
    setErro('');
    setEnviando(true);

    try {
      // Busca agenda atual
      const res = await fetch(`${WA_AGENT_URL}/scheduler/agenda?instancia=${encodeURIComponent(instancia)}`);
      const agenda = await res.json();

      // Para cada categoria selecionada, salva a mensagem no próximo slot disponível
      catsSelecionadas.forEach(catId => {
        if (!agenda.cats[catId]) agenda.cats[catId] = { slots: [{ time: horaAgendada, msg: '', days: [0,1,2,3,4,5,6] }, { time: '', msg: '', days: [1,2,3,4,5] }, { time: '', msg: '', days: [1,2,3,4,5] }] };
        // Usa o primeiro slot para agendar
        agenda.cats[catId].slots[0].msg = texto;
        agenda.cats[catId].slots[0].time = horaAgendada;
        agenda.cats[catId].slots[0].days = [0,1,2,3,4,5,6];
      });

      const r = await fetch(`${WA_AGENT_URL}/scheduler/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': WA_API_KEY, 'x-instancia': instancia },
        body: JSON.stringify({ ...agenda, instancia })
      });

      if (r.ok) {
        setResultado({ agendado: true, hora: horaAgendada, cats: catsSelecionadas.map(id => categorias.find(c => c.id === id)?.name).join(', ') });
      } else {
        setErro('Erro ao salvar agendamento.');
      }
    } catch (e) {
      setErro('Erro: ' + e.message);
    }
    setEnviando(false);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20
    }}>
      <div style={{
        background: bg, border: `1px solid ${border}`, borderRadius: 16,
        padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
        color: textColor
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>💬 Disparar via WA Scheduler</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: textMuted }}>✕</button>
        </div>

        {resultado ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            {resultado.agendado ? (
              <>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Agendamento salvo!</div>
                <div style={{ color: textMuted, fontSize: 13 }}>
                  Horário: <strong>{resultado.hora}</strong><br />
                  Categorias: <strong>{resultado.cats}</strong>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Disparo concluído!</div>
                <div style={{ color: textMuted, fontSize: 13 }}>
                  {resultado.ok} enviado(s) · {resultado.erros} erro(s) · {resultado.total} grupo(s) no total
                </div>
              </>
            )}
            <button onClick={onClose} style={{ marginTop: 20, padding: '10px 24px', borderRadius: 8, border: 'none', background: '#25d366', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Fechar
            </button>
          </div>
        ) : (
          <>
            {/* Modo */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {['agora', 'agendar'].map(m => (
                <button key={m} onClick={() => setModo(m)} style={{
                  flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${modo === m ? '#25d366' : border}`,
                  background: modo === m ? 'rgba(37,211,102,0.08)' : 'transparent',
                  color: modo === m ? '#25d366' : textMuted, fontWeight: 600, fontSize: 13, cursor: 'pointer'
                }}>
                  {m === 'agora' ? '⚡ Enviar agora' : '🕐 Agendar'}
                </button>
              ))}
            </div>

            {/* Instância */}
            <div style={{ marginBottom: 16, padding: '8px 12px', background: darkMode ? '#0f1117' : '#f8fafc', borderRadius: 8, border: `1px solid ${border}`, fontSize: 12, color: textMuted }}>
              Instância: <strong style={{ color: textColor }}>{instancia}</strong>
            </div>

            {/* Agendar — data/hora */}
            {modo === 'agendar' && (
              <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Data</div>
                  <input type="date" value={dataAgendada} onChange={e => setDataAgendada(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${border}`, background: darkMode ? '#0f1117' : '#fff', color: textColor, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Hora</div>
                  <input type="time" value={horaAgendada} onChange={e => setHoraAgendada(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${border}`, background: darkMode ? '#0f1117' : '#fff', color: textColor, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}

            {/* Categorias */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase', marginBottom: 8 }}>Categorias</div>
              {carregando ? (
                <div style={{ color: textMuted, fontSize: 13 }}>Carregando categorias...</div>
              ) : categorias.length === 0 ? (
                <div style={{ color: textMuted, fontSize: 13 }}>Nenhuma categoria encontrada.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {categorias.map(cat => (
                    <div key={cat.id} onClick={() => toggleCat(cat.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 12px', borderRadius: 10,
                      border: `2px solid ${catsSelecionadas.includes(cat.id) ? cat.cor : border}`,
                      background: catsSelecionadas.includes(cat.id) ? `${cat.cor}15` : 'transparent',
                      cursor: 'pointer', transition: 'all 0.15s'
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.cor, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: catsSelecionadas.includes(cat.id) ? textColor : textMuted, lineHeight: 1.3 }}>{cat.name}</span>
                      {catsSelecionadas.includes(cat.id) && <span style={{ marginLeft: 'auto', color: cat.cor, fontSize: 13 }}>✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preview da mensagem */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase', marginBottom: 6 }}>Mensagem</div>
              <pre style={{
                fontFamily: 'Inter, sans-serif', fontSize: 11, lineHeight: 1.7,
                whiteSpace: 'pre-wrap', color: textMuted, margin: 0,
                padding: '10px 12px', background: darkMode ? '#0f1117' : '#f8fafc',
                borderRadius: 8, border: `1px solid ${border}`,
                maxHeight: 120, overflowY: 'auto'
              }}>{texto}</pre>
            </div>

            {erro && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{erro}</div>}

            <button
              onClick={modo === 'agora' ? enviarAgora : salvarAgendamento}
              disabled={enviando || carregando}
              style={{
                width: '100%', padding: '13px', borderRadius: 10, border: 'none',
                background: enviando ? '#9ca3af' : '#25d366', color: '#fff',
                fontWeight: 700, fontSize: 14, cursor: enviando ? 'not-allowed' : 'pointer'
              }}>
              {enviando ? 'Processando...' : modo === 'agora' ? '⚡ Enviar agora' : '🕐 Salvar agendamento'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ResumoDemandasTab({ data, darkMode, perfil }) {
  const [copiado, setCopiado] = useState(false);
  const [editando, setEditando] = useState(false);
  const [textoEditado, setTextoEditado] = useState('');
  const [modalDisparo, setModalDisparo] = useState(false);

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
    <div style={{ maxWidth: 760, color: textColor }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>📋 Demandas</h2>
        <p style={{ margin: '6px 0 0', color: textMuted, fontSize: 14 }}>
          Tratativas ativas com parceria solicitada, sem proposta ou etapas posteriores marcadas.
          {' '}<strong>{ativas.length}</strong> demanda{ativas.length !== 1 ? 's' : ''} no total.
        </p>
      </div>

      {ativas.length === 0 ? (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 40, textAlign: 'center', color: textMuted }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🤝</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Nenhuma demanda encontrada</div>
          <div style={{ fontSize: 13 }}>Marque "Solicitar Parceria" e a etapa "Pesquisa" em uma tratativa para ela aparecer aqui.</div>
        </div>
      ) : (
        <>
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                Mensagem {editando && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 400 }}>— editando</span>}
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {editando && (
                  <button onClick={resetar}
                    style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    ↺ Resetar
                  </button>
                )}
                <button onClick={() => setEditando(e => !e)}
                  style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${editando ? '#f59e0b' : '#d1d5db'}`, background: editando ? '#fffbeb' : '#fff', color: editando ? '#b45309' : '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {editando ? '✓ Concluir' : '✏️ Editar'}
                </button>
                <button onClick={copiar}
                  style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: copiado ? '#059669' : '#2563eb', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}>
                  {copiado ? '✓ Copiado!' : '📋 Copiar'}
                </button>
                <button onClick={() => {
                  if (!instancia) { alert('Configure sua instância do WhatsApp no perfil antes de disparar.'); return; }
                  setModalDisparo(true);
                }}
                  style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#25d366', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  💬 WhatsApp
                </button>
              </div>
            </div>

            {editando ? (
              <textarea
                value={textoFinal}
                onChange={e => setTextoEditado(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  minHeight: 220, padding: '12px 14px',
                  fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.8,
                  border: '2px solid #f59e0b', borderRadius: 8,
                  background: darkMode ? '#0f1117' : '#fffbeb',
                  color: textColor, resize: 'vertical', outline: 'none',
                }}
              />
            ) : (
              <pre style={{
                fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.8,
                whiteSpace: 'pre-wrap', color: textColor, margin: 0,
                padding: '12px 14px', background: darkMode ? '#0f1117' : '#f8fafc',
                borderRadius: 8, border: `1px solid ${border}`,
              }}>
                {textoFinal}
              </pre>
            )}

            <div style={{ marginTop: 10, fontSize: 11, color: textMuted }}>
              Formato: <strong>Imóvel Região. Observações externas. Preço</strong>
              {instancia && <span style={{ marginLeft: 12, color: '#25d366' }}>● {instancia}</span>}
            </div>
          </div>

          {Object.entries(porModalidade).map(([mod, clientes]) => (
            <div key={mod} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  {mod === 'Compra' ? '🛒' : mod === 'Venda' ? '🏠' : mod === 'Locação' ? '🔑' : '📄'} {mod}
                </span>
                <span style={{ fontSize: 12, color: textMuted, background: darkMode ? '#0f3460' : '#f1f5f9', padding: '3px 10px', borderRadius: 20 }}>
                  {clientes.length} demanda{clientes.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {clientes.map(c => (
                  <div key={c.id} style={{ background: darkMode ? '#0f1117' : '#f8fafc', border: `1px solid ${border}`, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.nome}</div>
                    <div style={{ color: textMuted, lineHeight: 1.7, fontSize: 12 }}>
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

      {modalDisparo && (
        <ModalDisparo
          texto={textoFinal}
          instancia={instancia}
          onClose={() => setModalDisparo(false)}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}
