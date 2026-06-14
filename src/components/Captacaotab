import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

// ───────────────────────────────────────────────────────────────────────────
// Aba "📍 Captação" — leads brutos vindos do script OLX (tabela leads_captacao).
// REGRA DE OURO: nada vira cliente/negociação automaticamente. Só quando você
// clicar em "→ Virar cliente/demanda" naquele lead.
// ───────────────────────────────────────────────────────────────────────────

const STATUS = ['novo', 'contatado', 'interessado', 'descartado', 'virou_cliente'];
const STATUS_COR = {
  novo: '#2563eb', contatado: '#d97706', interessado: '#059669',
  descartado: '#6b7280', virou_cliente: '#7c3aed',
};

export default function CaptacaoTab({ perfil }) {
  const [leads, setLeads] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [fCidade, setFCidade] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fTransacao, setFTransacao] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [promovendo, setPromovendo] = useState(null); // id do lead em promoção

  async function carregar() {
    setCarregando(true);
    setErro('');
    const { data, error } = await supabase
      .from('leads_captacao')
      .select('*')
      .order('data_captura', { ascending: false });
    if (error) setErro(error.message);
    else setLeads(data || []);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  // opções únicas pros filtros
  const cidades = useMemo(() => [...new Set(leads.map(l => l.cidade).filter(Boolean))].sort(), [leads]);
  const tipos = useMemo(() => [...new Set(leads.map(l => l.tipo).filter(Boolean))].sort(), [leads]);
  const transacoes = useMemo(() => [...new Set(leads.map(l => l.transacao).filter(Boolean))].sort(), [leads]);

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return leads.filter(l => {
      if (fCidade && l.cidade !== fCidade) return false;
      if (fTipo && l.tipo !== fTipo) return false;
      if (fTransacao && l.transacao !== fTransacao) return false;
      if (fStatus && l.status !== fStatus) return false;
      if (b) {
        const alvo = [l.telefone, l.nome, l.cidade, l.setor, l.codigo, l.regiao].join(' ').toLowerCase();
        if (!alvo.includes(b)) return false;
      }
      return true;
    });
  }, [leads, busca, fCidade, fTipo, fTransacao, fStatus]);

  async function mudarStatus(lead, novo) {
    const { error } = await supabase
      .from('leads_captacao')
      .update({ status: novo })
      .eq('id', lead.id);
    if (error) { alert('Erro ao salvar status: ' + error.message); return; }
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, status: novo } : l));
  }

  async function salvarObs(lead, texto) {
    const { error } = await supabase
      .from('leads_captacao')
      .update({ observacoes: texto })
      .eq('id', lead.id);
    if (error) { alert('Erro ao salvar observação: ' + error.message); return; }
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, observacoes: texto } : l));
  }

  async function excluir(lead) {
    if (!window.confirm('Excluir este lead da captação? (não mexe em clientes)')) return;
    const { error } = await supabase.from('leads_captacao').delete().eq('id', lead.id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    setLeads(ls => ls.filter(l => l.id !== lead.id));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIRAR CLIENTE/DEMANDA — só sob clique (regra de ouro).
  // Campos batem com o splitForm do App.js:
  //   clientes:   nome, telefone, entrada, origem, is_corretor
  //   negociacoes: modalidade, imovel, localizacao, detalhes, valor, ativo,
  //                captado, corretor_id, corretor, cliente_id
  // Se já existir cliente com o mesmo telefone, anexa a negociação a ele
  // (em vez de criar cliente duplicado), igual ao fluxo do CRM.
  // ─────────────────────────────────────────────────────────────────────────
  function mapModalidade(transacao) {
    const t = (transacao || '').toLowerCase();
    if (t.indexOf('aluguel') >= 0 || t.indexOf('temporada') >= 0 || t.indexOf('loca') >= 0) return 'Locação';
    return 'Venda'; // captação ativa: proprietário quer vender pela Inerente
  }
  function valorNumerico(preco) {
    if (!preco) return null;
    const n = Number(String(preco).replace(/\D/g, ''));
    return isNaN(n) || n === 0 ? null : n;
  }

  async function virarCliente(lead) {
    if (lead.virou_cliente) { alert('Este lead já virou cliente.'); return; }
    if (!window.confirm('Promover este lead a cliente + demanda no CRM?\n\n' + (lead.nome || '(sem nome)') + ' · ' + lead.telefone)) return;
    setPromovendo(lead.id);
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const resumo = montarResumoImovel(lead);

      // 1) cliente existente? (anti-duplicado por telefone)
      const { data: existentes, error: eBusca } = await supabase
        .from('clientes').select('id').eq('telefone', lead.telefone).limit(1);
      if (eBusca) throw eBusca;

      let clienteId;
      if (existentes && existentes.length) {
        clienteId = existentes[0].id;
      } else {
        const { data: cli, error: e1 } = await supabase
          .from('clientes')
          .insert([{
            nome: lead.nome || 'Proprietário OLX',
            telefone: lead.telefone,
            entrada: hoje,
            origem: 'Olx',
            is_corretor: false,
          }])
          .select().single();
        if (e1) throw e1;
        clienteId = cli.id;
      }

      // 2) negociação ligada ao cliente, marcada como captação
      const negociacao = {
        cliente_id: clienteId,
        modalidade: mapModalidade(lead.transacao),
        imovel: [lead.subtipo || lead.tipo, lead.transacao].filter(Boolean).join(' - ') || 'Imóvel OLX',
        localizacao: [lead.setor, lead.cidade, lead.estado].filter(Boolean).join(', ') || null,
        detalhes: resumo,
        valor: valorNumerico(lead.preco),
        ativo: 'S',
        captado: false, // aparece nas Tratativas/Funil pra você trabalhar
      };
      if (perfil && perfil.id) {
        negociacao.corretor_id = perfil.id;
        negociacao.corretor = perfil.nome;
        negociacao.corretor_original_id = perfil.id;
        negociacao.corretor_original = perfil.nome;
      }
      const { error: e2 } = await supabase.from('negociacoes').insert([negociacao]);
      if (e2) throw e2;

      // 3) marca o lead como promovido
      const { error: e3 } = await supabase
        .from('leads_captacao')
        .update({ status: 'virou_cliente', virou_cliente: true })
        .eq('id', lead.id);
      if (e3) throw e3;

      setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, status: 'virou_cliente', virou_cliente: true } : l));
      alert('✓ Cliente e demanda criados. Já aparece nas Tratativas/Funil (origem Olx).');
    } catch (err) {
      alert('Não consegui promover.\n\nDetalhe técnico: ' + err.message);
    } finally {
      setPromovendo(null);
    }
  }

  function montarResumoImovel(l) {
    const p = [];
    if (l.subtipo || l.tipo) p.push(l.subtipo || l.tipo);
    if (l.transacao) p.push(l.transacao);
    if (l.preco) p.push(l.preco);
    if (l.quartos) p.push(l.quartos + ' qto');
    if (l.vagas) p.push(l.vagas + ' vaga');
    if (l.area) p.push(l.area);
    const loc = [l.setor, l.cidade, l.estado].filter(Boolean).join(', ');
    let s = '[Captado OLX] ' + p.join(' · ');
    if (loc) s += ' — ' + loc;
    if (l.url) s += '\n' + l.url;
    return s;
  }

  function exportarCSV() {
    if (!filtrados.length) { alert('Nada pra exportar.'); return; }
    const cols = ['telefone', 'nome', 'tipo', 'subtipo', 'transacao', 'preco', 'quartos', 'vagas', 'banheiros', 'area', 'estado', 'regiao', 'subregiao', 'cidade', 'setor', 'codigo', 'status', 'observacoes', 'url', 'data_captura'];
    const linhas = [cols];
    filtrados.forEach(l => linhas.push(cols.map(c => l[c] == null ? '' : String(l[c]))));
    const csv = linhas.map(l => l.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'captacao-olx.csv';
    a.click();
  }

  // ─── estilos inline (no padrão das outras abas) ───
  const S = {
    wrap: { padding: 16 },
    barra: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 },
    input: { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 },
    sel: { padding: '7px 8px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, background: '#fff' },
    btn: { padding: '7px 12px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    th: { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' },
    td: { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid #f1f1f1', verticalAlign: 'top' },
  };

  return (
    <div style={S.wrap}>
      <div style={S.barra}>
        <strong style={{ fontSize: 16 }}>📍 Captação OLX</strong>
        <span style={{ color: '#6b7280', fontSize: 13 }}>{filtrados.length} de {leads.length} leads</span>
        <button style={{ ...S.btn, background: '#f3f4f6', color: '#1a1a2e' }} onClick={carregar}>🔄 Atualizar</button>
        <button style={{ ...S.btn, background: '#059669', color: '#fff' }} onClick={exportarCSV}>⬇ CSV</button>
      </div>

      <div style={S.barra}>
        <input style={{ ...S.input, minWidth: 220 }} placeholder="Buscar telefone, nome, setor, código..." value={busca} onChange={e => setBusca(e.target.value)} />
        <select style={S.sel} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">Status (todos)</option>
          {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={S.sel} value={fTransacao} onChange={e => setFTransacao(e.target.value)}>
          <option value="">Transação (todas)</option>
          {transacoes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select style={S.sel} value={fTipo} onChange={e => setFTipo(e.target.value)}>
          <option value="">Tipo (todos)</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select style={S.sel} value={fCidade} onChange={e => setFCidade(e.target.value)}>
          <option value="">Cidade (todas)</option>
          {cidades.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(busca || fCidade || fTipo || fTransacao || fStatus) &&
          <button style={{ ...S.btn, background: '#f3f4f6', color: '#1a1a2e' }}
            onClick={() => { setBusca(''); setFCidade(''); setFTipo(''); setFTransacao(''); setFStatus(''); }}>
            limpar filtros
          </button>}
      </div>

      {erro && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 7, marginBottom: 12, fontSize: 13 }}>Erro: {erro}</div>}
      {carregando && <div style={{ color: '#6b7280' }}>Carregando...</div>}

      {!carregando && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8 }}>
            <thead>
              <tr>
                <th style={S.th}>Telefone</th>
                <th style={S.th}>Nome</th>
                <th style={S.th}>Imóvel</th>
                <th style={S.th}>Local</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Obs.</th>
                <th style={S.th}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(l => (
                <tr key={l.id}>
                  <td style={S.td}>
                    <strong style={{ color: '#C0392B' }}>{l.telefone}</strong>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{(l.data_captura || '').slice(0, 10)}</div>
                  </td>
                  <td style={S.td}>{l.nome || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                  <td style={S.td}>
                    <div>{[l.subtipo || l.tipo, l.transacao, l.preco].filter(Boolean).join(' · ') || '—'}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{[l.quartos && l.quartos + ' qto', l.vagas && l.vagas + ' vaga', l.area].filter(Boolean).join(' · ')}</div>
                    {l.url && <a href={l.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#2563eb' }}>ver anúncio ↗</a>}
                  </td>
                  <td style={S.td}>{[l.setor, l.cidade, l.estado].filter(Boolean).join(', ') || '—'}</td>
                  <td style={S.td}>
                    <select
                      value={l.status || 'novo'}
                      onChange={e => mudarStatus(l, e.target.value)}
                      style={{ ...S.sel, color: STATUS_COR[l.status] || '#1a1a2e', fontWeight: 600, padding: '4px 6px' }}
                      disabled={l.virou_cliente}
                    >
                      {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={S.td}>
                    <input
                      style={{ ...S.input, width: 140, padding: '4px 6px', fontSize: 12 }}
                      defaultValue={l.observacoes || ''}
                      placeholder="anotar..."
                      onBlur={e => { if (e.target.value !== (l.observacoes || '')) salvarObs(l, e.target.value); }}
                    />
                  </td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <button
                        style={{ ...S.btn, background: l.virou_cliente ? '#e5e7eb' : '#7c3aed', color: l.virou_cliente ? '#9ca3af' : '#fff', fontSize: 12, padding: '5px 8px' }}
                        disabled={l.virou_cliente || promovendo === l.id}
                        onClick={() => virarCliente(l)}
                      >
                        {l.virou_cliente ? '✓ já é cliente' : (promovendo === l.id ? '...' : '→ Virar cliente/demanda')}
                      </button>
                      <button style={{ ...S.btn, background: '#fef2f2', color: '#b91c1c', fontSize: 12, padding: '5px 8px' }} onClick={() => excluir(l)}>🗑 excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtrados.length && (
                <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#9ca3af', padding: 24 }}>Nenhum lead encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
