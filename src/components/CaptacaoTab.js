import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

// ───────────────────────────────────────────────────────────────────────────
// Aba "📍 Captação" — leads brutos vindos do script OLX (tabela leads_captacao).
// Colunas separadas, ordenação por cabeçalho (estilo Excel) e filtro por coluna.
// REGRA DE OURO: nada vira cliente/negociação automaticamente. Só quando você
// clicar em "→ Virar cliente/demanda" naquele lead.
// ───────────────────────────────────────────────────────────────────────────

const STATUS = ['novo', 'contatado', 'interessado', 'descartado', 'virou_cliente'];
const STATUS_COR = {
  novo: '#2563eb', contatado: '#d97706', interessado: '#059669',
  descartado: '#6b7280', virou_cliente: '#7c3aed',
};

// definição das colunas ordenáveis/filtráveis
// kind: 'texto' (busca), 'sel' (seletor), 'num' (faixa mín–máx), 'status'
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
  { key: 'cidade', label: 'Cidade', kind: 'sel' },
  { key: 'setor', label: 'Setor', kind: 'texto' },
  { key: 'status', label: 'Status', kind: 'status' },
];

function parseNum(v) {
  if (v == null) return null;
  const s = String(v).replace(/\D/g, '');
  if (s === '') return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

export default function CaptacaoTab({ perfil }) {
  const [leads, setLeads] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [promovendo, setPromovendo] = useState(null);

  // filtros por coluna
  const [texto, setTexto] = useState({});
  const [sel, setSel] = useState({});
  const [faixa, setFaixa] = useState({});

  // ordenação
  const [sortCol, setSortCol] = useState('data_captura');
  const [sortDir, setSortDir] = useState('desc');

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

  const opcoes = useMemo(() => {
    const o = {};
    ['tipo', 'subtipo', 'transacao', 'estado', 'regiao', 'subregiao', 'cidade'].forEach(k => {
      o[k] = [...new Set(leads.map(l => l[k]).filter(Boolean))].sort();
    });
    return o;
  }, [leads]);

  const filtrados = useMemo(() => {
    return leads.filter(l => {
      for (const k of ['telefone', 'nome', 'setor']) {
        const q = (texto[k] || '').trim().toLowerCase();
        if (q && !String(l[k] || '').toLowerCase().includes(q)) return false;
      }
      for (const k of ['tipo', 'subtipo', 'transacao', 'estado', 'regiao', 'subregiao', 'cidade', 'status']) {
        if (sel[k] && (l[k] || '') !== sel[k]) return false;
      }
      for (const k of ['preco', 'quartos', 'vagas', 'area']) {
        const min = faixa[k + 'Min'], max = faixa[k + 'Max'];
        const n = parseNum(l[k]);
        if (min !== '' && min != null && min !== undefined) {
          if (n == null || n < Number(min)) return false;
        }
        if (max !== '' && max != null && max !== undefined) {
          if (n == null || n > Number(max)) return false;
        }
      }
      return true;
    });
  }, [leads, texto, sel, faixa]);

  const numericas = ['preco', 'quartos', 'vagas', 'area'];
  const ordenados = useMemo(() => {
    const arr = [...filtrados];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (numericas.includes(sortCol)) {
        const na = parseNum(a[sortCol]), nb = parseNum(b[sortCol]);
        const va = na == null ? -Infinity : na;
        const vb = nb == null ? -Infinity : nb;
        return (va - vb) * dir;
      }
      const sa = String(a[sortCol] || '');
      const sb = String(b[sortCol] || '');
      return sa.localeCompare(sb, 'pt-BR', { numeric: true }) * dir;
    });
    return arr;
  }, [filtrados, sortCol, sortDir]);

  function clicarCabecalho(key) {
    if (sortCol === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(key); setSortDir('asc'); }
  }
  function setaSort(key) {
    if (sortCol !== key) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  function limparFiltros() { setTexto({}); setSel({}); setFaixa({}); }
  const temFiltro = Object.values(texto).some(v => v) || Object.values(sel).some(v => v) || Object.values(faixa).some(v => v);

  async function mudarStatus(lead, novo) {
    const { error } = await supabase.from('leads_captacao').update({ status: novo }).eq('id', lead.id);
    if (error) { alert('Erro ao salvar status: ' + error.message); return; }
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, status: novo } : l));
  }

  async function salvarObs(lead, txt) {
    const { error } = await supabase.from('leads_captacao').update({ observacoes: txt }).eq('id', lead.id);
    if (error) { alert('Erro ao salvar observação: ' + error.message); return; }
    setLeads(ls => ls.map(l => l.id === lead.id ? { ...l, observacoes: txt } : l));
  }

  async function excluir(lead) {
    if (!window.confirm('Excluir este lead da captação? (não mexe em clientes)')) return;
    const { error } = await supabase.from('leads_captacao').delete().eq('id', lead.id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    setLeads(ls => ls.filter(l => l.id !== lead.id));
  }

  function mapModalidade(transacao) {
    const t = (transacao || '').toLowerCase();
    if (t.indexOf('aluguel') >= 0 || t.indexOf('temporada') >= 0 || t.indexOf('loca') >= 0) return 'Locação';
    return 'Venda';
  }
  function valorNumerico(preco) {
    if (!preco) return null;
    const n = Number(String(preco).replace(/\D/g, ''));
    return isNaN(n) || n === 0 ? null : n;
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

  async function virarCliente(lead) {
    if (lead.virou_cliente) { alert('Este lead já virou cliente.'); return; }
    if (!window.confirm('Promover este lead a cliente + demanda no CRM?\n\n' + (lead.nome || '(sem nome)') + ' · ' + lead.telefone)) return;
    setPromovendo(lead.id);
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const resumo = montarResumoImovel(lead);

      const { data: existentes, error: eBusca } = await supabase
        .from('clientes').select('id').eq('telefone', lead.telefone).limit(1);
      if (eBusca) throw eBusca;

      let clienteId;
      if (existentes && existentes.length) {
        clienteId = existentes[0].id;
      } else {
        const { data: cli, error: e1 } = await supabase
          .from('clientes')
          .insert([{ nome: lead.nome || 'Proprietário OLX', telefone: lead.telefone, entrada: hoje, origem: 'Olx', is_corretor: false }])
          .select().single();
        if (e1) throw e1;
        clienteId = cli.id;
      }

      const negociacao = {
        cliente_id: clienteId,
        modalidade: mapModalidade(lead.transacao),
        imovel: [lead.subtipo || lead.tipo, lead.transacao].filter(Boolean).join(' - ') || 'Imóvel OLX',
        localizacao: [lead.setor, lead.cidade, lead.estado].filter(Boolean).join(', ') || null,
        detalhes: resumo,
        valor: valorNumerico(lead.preco),
        ativo: 'S',
        captado: false,
      };
      if (perfil && perfil.id) {
        negociacao.corretor_id = perfil.id;
        negociacao.corretor = perfil.nome;
        negociacao.corretor_original_id = perfil.id;
        negociacao.corretor_original = perfil.nome;
      }
      const { error: e2 } = await supabase.from('negociacoes').insert([negociacao]);
      if (e2) throw e2;

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

  function exportarCSV() {
    if (!ordenados.length) { alert('Nada pra exportar.'); return; }
    const cols = ['telefone', 'nome', 'tipo', 'subtipo', 'transacao', 'preco', 'quartos', 'vagas', 'banheiros', 'area', 'estado', 'regiao', 'subregiao', 'cidade', 'setor', 'codigo', 'status', 'observacoes', 'url', 'data_captura'];
    const linhas = [cols];
    ordenados.forEach(l => linhas.push(cols.map(c => l[c] == null ? '' : String(l[c]))));
    const csv = linhas.map(l => l.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'captacao-olx.csv';
    a.click();
  }

  const S = {
    wrap: { padding: 16 },
    barra: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 },
    btn: { padding: '7px 12px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    th: { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', background: '#f9fafb', fontWeight: 700 },
    thFiltro: { padding: '4px 8px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', verticalAlign: 'top' },
    td: { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid #f1f1f1', verticalAlign: 'top', whiteSpace: 'nowrap' },
    inp: { padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12, width: '100%', boxSizing: 'border-box' },
    inpNum: { padding: '3px 4px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 11, width: 48, boxSizing: 'border-box', textAlign: 'right' },
    selF: { padding: '4px 4px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 11, width: '100%', background: '#fff', boxSizing: 'border-box' },
    fix: { position: 'sticky', left: 0, zIndex: 2 },
    fixHead: { position: 'sticky', left: 0, zIndex: 3 },
  };

  const setTextoK = (k, v) => setTexto(o => ({ ...o, [k]: v }));
  const setSelK = (k, v) => setSel(o => ({ ...o, [k]: v }));
  const setFaixaK = (k, v) => setFaixa(o => ({ ...o, [k]: v }));

  function celulaFiltro(col) {
    if (col.kind === 'texto') {
      return <input style={S.inp} placeholder="buscar" value={texto[col.key] || ''} onChange={e => setTextoK(col.key, e.target.value)} />;
    }
    if (col.kind === 'status') {
      return (
        <select style={S.selF} value={sel.status || ''} onChange={e => setSelK('status', e.target.value)}>
          <option value="">todos</option>
          {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      );
    }
    if (col.kind === 'sel') {
      return (
        <select style={S.selF} value={sel[col.key] || ''} onChange={e => setSelK(col.key, e.target.value)}>
          <option value="">todos</option>
          {(opcoes[col.key] || []).map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      );
    }
    if (col.kind === 'num') {
      return (
        <div style={{ display: 'flex', gap: 3 }}>
          <input style={S.inpNum} placeholder="mín" value={faixa[col.key + 'Min'] || ''} onChange={e => setFaixaK(col.key + 'Min', e.target.value)} />
          <input style={S.inpNum} placeholder="máx" value={faixa[col.key + 'Max'] || ''} onChange={e => setFaixaK(col.key + 'Max', e.target.value)} />
        </div>
      );
    }
    return null;
  }

  return (
    <div style={S.wrap}>
      <div style={S.barra}>
        <strong style={{ fontSize: 16 }}>📍 Captação OLX</strong>
        <span style={{ color: '#6b7280', fontSize: 13 }}>{ordenados.length} de {leads.length} leads</span>
        <button style={{ ...S.btn, background: '#f3f4f6', color: '#1a1a2e' }} onClick={carregar}>🔄 Atualizar</button>
        <button style={{ ...S.btn, background: '#059669', color: '#fff' }} onClick={exportarCSV}>⬇ CSV</button>
        {temFiltro && <button style={{ ...S.btn, background: '#f3f4f6', color: '#1a1a2e' }} onClick={limparFiltros}>limpar filtros</button>}
        <span style={{ color: '#9ca3af', fontSize: 12 }}>clique no cabeçalho pra ordenar</span>
      </div>

      {erro && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 7, marginBottom: 12, fontSize: 13 }}>Erro: {erro}</div>}
      {carregando && <div style={{ color: '#6b7280' }}>Carregando...</div>}

      {!carregando && (
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <table style={{ borderCollapse: 'collapse', background: '#fff', minWidth: 1400 }}>
            <thead>
              <tr>
                {COLS.map((col, i) => (
                  <th key={col.key} style={{ ...S.th, ...(i === 0 ? S.fixHead : {}) }} onClick={() => clicarCabecalho(col.key)}>
                    {col.label}{setaSort(col.key)}
                  </th>
                ))}
                <th style={S.th}>Obs.</th>
                <th style={S.th}>Ações</th>
              </tr>
              <tr>
                {COLS.map((col, i) => (
                  <th key={col.key} style={{ ...S.thFiltro, ...(i === 0 ? S.fixHead : {}) }}>{celulaFiltro(col)}</th>
                ))}
                <th style={S.thFiltro}></th>
                <th style={S.thFiltro}></th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map(l => (
                <tr key={l.id}>
                  <td style={{ ...S.td, ...S.fix, background: '#fff' }}>
                    <strong style={{ color: '#C0392B' }}>{l.telefone}</strong>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{(l.data_captura || '').slice(0, 10)}</div>
                    {l.url && <a href={l.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#2563eb' }}>ver anúncio ↗</a>}
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
                  <td style={S.td}>
                    <select
                      value={l.status || 'novo'}
                      onChange={e => mudarStatus(l, e.target.value)}
                      style={{ ...S.selF, color: STATUS_COR[l.status] || '#1a1a2e', fontWeight: 600, width: 'auto' }}
                      disabled={l.virou_cliente}
                    >
                      {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={S.td}>
                    <input
                      style={{ ...S.inp, width: 130 }}
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
              {!ordenados.length && (
                <tr><td colSpan={COLS.length + 2} style={{ ...S.td, textAlign: 'center', color: '#9ca3af', padding: 24 }}>Nenhum lead encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
