import { useState, useMemo } from 'react';

export default function ResumoDemandasTab({ data, darkMode }) {
  const [copiado, setCopiado] = useState(false);

  const ativas = useMemo(() => data.filter(c => c.ativo === 'S' && !c.is_corretor), [data]);

  const porModalidade = useMemo(() => {
    const grupos = {};
    ativas.forEach(c => {
      const mod = c.modalidade || 'Outros';
      if (!grupos[mod]) grupos[mod] = [];
      grupos[mod].push(c);
    });
    return grupos;
  }, [ativas]);

  function formatarLinha(c) {
    const partes = [];
    if (c.imovel) partes.push(c.imovel);
    if (c.localizacao) partes.push(`em ${c.localizacao}`);
    if (c.valor) partes.push(`R$ ${Number(c.valor).toLocaleString('pt-BR')}`);
    if (c.detalhes) partes.push(c.detalhes);
    return `- ${partes.join('. ')}`;
  }

  const texto = useMemo(() => {
    if (ativas.length === 0) return '';
    let out = 'Preciso de: (ENVIAR SOMENTE IMÓVEIS NOS PERFIS RELACIONADOS)\n';
    const ordem = ['Compra', 'Venda', 'Locação'];
    const mods = [...new Set([...ordem.filter(m => porModalidade[m]), ...Object.keys(porModalidade).filter(m => !ordem.includes(m))])];
    mods.forEach(mod => {
      out += `${mod.toUpperCase()}:\n`;
      porModalidade[mod].forEach(c => { out += formatarLinha(c) + '\n'; });
    });
    return out.trim();
  }, [ativas, porModalidade]);

  function copiar() {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  const card = darkMode ? '#16213e' : '#ffffff';
  const border = darkMode ? '#0f3460' : '#e2e8f0';
  const textColor = darkMode ? '#e2e8f0' : '#1a202c';
  const textMuted = darkMode ? '#94a3b8' : '#64748b';

  return (
    <div style={{ maxWidth: 760, color: textColor }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>📋 Resumo de Demandas</h2>
        <p style={{ margin: '6px 0 0', color: textMuted, fontSize: 14 }}>
          Tratativas ativas agrupadas por modalidade — excluindo corretores.
          {' '}<strong>{ativas.length}</strong> tratativa{ativas.length !== 1 ? 's' : ''} no total.
        </p>
      </div>

      {ativas.length === 0 ? (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 40, textAlign: 'center', color: textMuted }}>
          Nenhuma tratativa ativa encontrada.
        </div>
      ) : (
        <>
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Prévia do Resumo</span>
              <button onClick={copiar}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: copiado ? '#059669' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}>
                {copiado ? '✓ Copiado!' : '📋 Copiar Texto'}
              </button>
            </div>
            <pre style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: textColor, margin: 0 }}>{texto}</pre>
          </div>

          {Object.entries(porModalidade).map(([mod, clientes]) => (
            <div key={mod} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  {mod === 'Compra' ? '🛒' : mod === 'Venda' ? '🏠' : mod === 'Locação' ? '🔑' : '📄'} {mod}
                </span>
                <span style={{ fontSize: 12, color: textMuted, background: darkMode ? '#0f3460' : '#f1f5f9', padding: '3px 10px', borderRadius: 20 }}>
                  {clientes.length} tratativa{clientes.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {clientes.map(c => (
                  <div key={c.id} style={{ background: darkMode ? '#0f1117' : '#f8fafc', border: `1px solid ${border}`, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.nome}</div>
                    <div style={{ color: textMuted, lineHeight: 1.6 }}>
                      {c.imovel && <span>{c.imovel}</span>}
                      {c.localizacao && <span> · {c.localizacao}</span>}
                      {c.valor && <span style={{ color: '#059669', fontWeight: 600 }}> · R$ {Number(c.valor).toLocaleString('pt-BR')}</span>}
                    </div>
                    {c.detalhes && <div style={{ color: textMuted, fontSize: 12, marginTop: 4 }}>{c.detalhes}</div>}
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
