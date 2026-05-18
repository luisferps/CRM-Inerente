import { useState, useMemo, useEffect } from 'react';

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
  // IMÓVEL REGIÃO (sem +, só espaço)
  const imovelRegiao = [c.imovel, c.localizacao].filter(Boolean).join(' ');
  if (imovelRegiao) partes.push(capitalize(imovelRegiao));
  // OBSERVAÇÕES EXTERNAS
  if (c.detalhes_externos) partes.push(capitalize(c.detalhes_externos.trim()));
  // PREÇO
  const preco = formatarPreco(c.valor);
  if (preco) partes.push(preco);
  return `- ${partes.join('. ')}`;
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

export default function ResumoDemandasTab({ data, darkMode }) {
  const [copiado, setCopiado] = useState(false);
  const [editando, setEditando] = useState(false);
  const [textoEditado, setTextoEditado] = useState('');

  // Filtro: ativo, não corretor, (solicitar_parceria OU pesquisa marcada), e pesquisa obrigatória
  const ativas = useMemo(() => data.filter(c =>
    c.ativo === 'S' &&
    !c.is_corretor &&
    c.pesquisa === true &&
    (c.solicitar_parceria === true || c.pesquisa === true)
  ), [data]);

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

  function abrirWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(textoFinal)}`, '_blank');
  }

  function resetar() {
    setTextoEditado(textoGerado);
    setEditando(false);
  }

  const card = darkMode ? '#16213e' : '#ffffff';
  const border = darkMode ? '#0f3460' : '#e2e8f0';
  const textColor = darkMode ? '#e2e8f0' : '#1a202c';
  const textMuted = darkMode ? '#94a3b8' : '#64748b';

  return (
    <div style={{ maxWidth: 760, color: textColor }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>📋 Demandas</h2>
        <p style={{ margin: '6px 0 0', color: textMuted, fontSize: 14 }}>
          Tratativas com parceria solicitada e etapa pesquisa marcada.
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
            {/* Header */}
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
                <button onClick={abrirWhatsApp}
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
            </div>
          </div>

          {/* Cards por modalidade */}
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
    </div>
  );
}
