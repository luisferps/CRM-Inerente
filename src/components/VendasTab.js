import { useState, useMemo } from 'react';
import { ETAPAS_FUNIL_COMPLETO, ETAPAS_LABEL, ehCaptacao } from '../constants';

const BACKEND = 'https://agentes-de-whatsapp-production.up.railway.app';

function getEtapaAtual(c) {
  for (let i = ETAPAS_FUNIL_COMPLETO.length - 1; i >= 0; i--) {
    if (c[ETAPAS_FUNIL_COMPLETO[i]]) return ETAPAS_FUNIL_COMPLETO[i];
  }
  return null;
}

// Nome exibido na coluna Corretor: quem tem a estrela da tratativa; senão a da
// captação; senão o corretor responsável gravado na linha.
function corretorDaEstrela(c) {
  const divT = Array.isArray(c.tratativa_divisao) ? c.tratativa_divisao : [];
  const donoT = divT.find(d => d.id === c.tratativa_dono_edicao);
  if (donoT && donoT.nome) return donoT.nome;
  const divC = Array.isArray(c.captacao_divisao) ? c.captacao_divisao : [];
  const donoC = divC.find(d => d.tipo !== 'externo' && d.id === c.captacao_dono_edicao);
  if (donoC && donoC.nome) return donoC.nome;
  return c.corretor || '';
}

const CORES = ['#1e40af','#1d4ed8','#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe','#dbeafe','#16a34a'];

export default function VendasTab({ data, onOpenModal, onDelete, onDevolverCaptacao }) {
  const [search, setSearch] = useState('');
  const [filterEtapa, setFilterEtapa] = useState('');
  const [filterCorretor, setFilterCorretor] = useState('');
  // Sincronização CRM → Estoque (reconciliação): fecha o furo de captados que não
  // aparecem no Estoque. Sempre roda em preview primeiro; depois aplica.
  const [sync, setSync] = useState({ estado: 'idle', preview: null, resultado: null, erro: '' });

  async function rodarSync(dry) {
    setSync(s => ({ ...s, estado: dry ? 'previewing' : 'aplicando', erro: '' }));
    try {
      const r = await fetch(BACKEND + '/captacao/reconciliar-estoque' + (dry ? '?dry=1' : ''), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const j = await r.json();
      if (!j.ok) { setSync({ estado: 'idle', preview: null, resultado: null, erro: j.error || 'Erro desconhecido' }); return; }
      if (dry) setSync({ estado: 'preview', preview: j.resumo, resultado: null, erro: '' });
      else setSync({ estado: 'feito', preview: null, resultado: j.resumo, erro: '' });
    } catch (e) {
      setSync({ estado: 'idle', preview: null, resultado: null, erro: e.message });
    }
  }

  // Vendas em andamento: ativas e ainda não captadas (a captação encerra a tratativa com sucesso).
  const vendas = useMemo(() => data.filter(c => ehCaptacao(c.modalidade) && c.ativo === 'S' && !c.captado), [data]);
  // Captados: vendas concluídas por captação (entram no contador, fora da lista principal).
  const captados = useMemo(() => data.filter(c => ehCaptacao(c.modalidade) && c.captado), [data]);
  const corretoresUnicos = useMemo(() => [...new Set(vendas.map(c => corretorDaEstrela(c)).filter(Boolean))].sort(), [vendas]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return vendas.filter(c =>
      (!q || c.nome.toLowerCase().includes(q) || (c.localizacao || '').toLowerCase().includes(q)) &&
      (!filterEtapa || getEtapaAtual(c) === filterEtapa) &&
      (!filterCorretor || corretorDaEstrela(c) === filterCorretor)
    );
  }, [vendas, search, filterEtapa, filterCorretor]);

  // Botões de ação por linha: Ver (todos), ↩ Captação (só origem OLX) e Excluir.
  const Acoes = ({ c, comDevolver }) => (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', whiteSpace: 'nowrap', flexWrap: 'wrap' }}>
      {onOpenModal && <button onClick={() => onOpenModal(c)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>Ver</button>}
      {comDevolver && onDevolverCaptacao && String(c.origem_tratativa || '').toUpperCase() === 'OLX' && (
        <button onClick={() => onDevolverCaptacao(c)} title="Devolve este lead pra Captação como fora do perfil e remove esta tratativa" style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #fcd34d', background: '#fffbeb', color: '#b45309', fontSize: 12, cursor: 'pointer' }}>↩ Captação</button>
      )}
      {onDelete && <button onClick={() => { if (window.confirm('Excluir esta tratativa? Não dá pra desfazer.')) onDelete(c.id); }} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>Excluir</button>}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['🏠 Total', vendas.length, '#2563eb'],['✍️ Contratos', vendas.filter(c => c.contrato).length, '#7c3aed'],['💰 Recebidos', vendas.filter(c => c.recebido).length, '#059669'],['✅ Captados', captados.length, '#0891b2']].map(([l, v, cor]) => (
          <div key={l} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 18px', fontSize: 12 }}>
            <span style={{ color: '#9ca3af' }}>{l} </span>
            <span style={{ fontWeight: 700, color: cor, fontSize: 18 }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0891b2' }}>🔄 Sincronizar captações → Estoque</div>
            <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 2 }}>Corrige o corretor dos imóveis vindos do CRM (inclui os transferidos). Não cria nada e não toca nos cadastrados direto no Estoque.</div>
          </div>
          {sync.estado === 'idle' && (
            <button onClick={() => rodarSync(true)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0891b2', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Conferir (prévia)</button>
          )}
          {sync.estado === 'previewing' && <span style={{ fontSize: 12, color: '#6b7280' }}>⏳ conferindo…</span>}
          {sync.estado === 'aplicando' && <span style={{ fontSize: 12, color: '#6b7280' }}>⏳ aplicando…</span>}
        </div>

        {sync.erro && <div style={{ marginTop: 10, fontSize: 12, color: '#dc2626' }}>{sync.erro}</div>}

        {sync.estado === 'preview' && sync.preview && (
          <div style={{ marginTop: 12, background: '#ecfeff', border: '1px solid #cffafe', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 12.5, color: '#155e75', fontWeight: 600, marginBottom: 6 }}>Prévia (nada foi alterado ainda):</div>
            <div style={{ fontSize: 12, color: '#0e7490', lineHeight: 1.7 }}>
              {sync.preview.total} captado(s) conferido(s) · dono a corrigir: <b>{sync.preview.dono_corrigido}</b> · já corretos: <b>{sync.preview.ja_correto}</b>
              {sync.preview.religados ? <> · religados: <b>{sync.preview.religados}</b></> : null}
              {sync.preview.sem_vinculo ? <> · sem vínculo com o Estoque (não mexe): <b>{sync.preview.sem_vinculo}</b></> : null}
              {sync.preview.vinculo_quebrado ? <> · vínculo quebrado (verificar): <b>{sync.preview.vinculo_quebrado}</b></> : null}
              {sync.preview.sem_dono ? <> · sem dono (verificar): <b>{sync.preview.sem_dono}</b></> : null}
              {sync.preview.erros ? <> · erros: <b style={{ color: '#dc2626' }}>{sync.preview.erros}</b></> : null}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button onClick={() => rodarSync(false)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Aplicar agora</button>
              <button onClick={() => setSync({ estado: 'idle', preview: null, resultado: null, erro: '' })} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        )}

        {sync.estado === 'feito' && sync.resultado && (
          <div style={{ marginTop: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: 12.5, color: '#166534', fontWeight: 700, marginBottom: 4 }}>✓ Sincronização concluída</div>
            <div style={{ fontSize: 12, color: '#15803d', lineHeight: 1.7 }}>
              Dono corrigido: <b>{sync.resultado.dono_corrigido}</b> · já corretos: <b>{sync.resultado.ja_correto}</b>
              {sync.resultado.religados ? <> · religados: <b>{sync.resultado.religados}</b></> : null}
              {sync.resultado.sem_vinculo ? <> · sem vínculo (não mexido): <b>{sync.resultado.sem_vinculo}</b></> : null}
              {sync.resultado.vinculo_quebrado ? <> · vínculo quebrado: <b>{sync.resultado.vinculo_quebrado}</b></> : null}
              {sync.resultado.sem_dono ? <> · sem dono: <b>{sync.resultado.sem_dono}</b></> : null}
              {sync.resultado.erros ? <> · erros: <b style={{ color: '#dc2626' }}>{sync.resultado.erros}</b></> : null}
            </div>
            <button onClick={() => setSync({ estado: 'idle', preview: null, resultado: null, erro: '' })} style={{ marginTop: 10, padding: '6px 14px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Ok</button>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
        <select value={filterEtapa} onChange={e => setFilterEtapa(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }}>
          <option value="">Todas etapas</option>
          {ETAPAS_FUNIL_COMPLETO.map(e => <option key={e} value={e}>{ETAPAS_LABEL[e]}</option>)}
        </select>
        <select value={filterCorretor} onChange={e => setFilterCorretor(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }}>
          <option value="">Todos corretores</option>
          {corretoresUnicos.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="table-wrapper">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Nome','Imóvel','Valor','Localização','Etapa','Corretor','Próxima Ação',''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Nenhuma captação encontrada.</td></tr>}
            {filtered.map((c) => {
              const etapa = getEtapaAtual(c);
              const etapaIdx = etapa ? ETAPAS_FUNIL_COMPLETO.indexOf(etapa) : -1;
              const cor = etapaIdx >= 0 ? CORES[etapaIdx] : '#e5e7eb';
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }} onClick={() => onOpenModal && onOpenModal(c)}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{c.nome}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.imovel || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#059669', fontWeight: 600 }}>{c.valor ? `R$ ${Number(c.valor).toLocaleString('pt-BR')}` : '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.localizacao || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {etapa ? <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: cor + '22', color: cor, border: `1px solid ${cor}44` }}>{ETAPAS_LABEL[etapa]}</span> : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>{corretorDaEstrela(c) || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: 12 }}>{c.proxima_acao || '—'}</td>
                  <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                    <Acoes c={c} comDevolver />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {captados.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0891b2', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            ✅ Captados <span style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af' }}>({captados.length})</span>
          </h3>
          <div className="table-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#ecfeff', borderBottom: '1px solid #cffafe' }}>
                  {['Nome','Imóvel','Valor','Localização','Corretor',''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {captados.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }} onClick={() => onOpenModal && onOpenModal(c)}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{c.nome}</td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.imovel || '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#059669', fontWeight: 600 }}>{c.valor ? `R$ ${Number(c.valor).toLocaleString('pt-BR')}` : '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.localizacao || '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>{corretorDaEstrela(c) || '—'}</td>
                    <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                      <Acoes c={c} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
