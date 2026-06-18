import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';

const BRL = (n) => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const vazio = { data: new Date().toISOString().slice(0, 10), tipo: 'Venda', cliente: '', imovel: '', vgv: '', comissao: '', p_corretor: '', p_captador: '', p_gerente: '', p_imobiliaria: '', observacao: '' };

export default function SecretariaTab() {
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [fTipo, setFTipo] = useState('Todos');
  const [fAno, setFAno] = useState('todos');
  const [fMes, setFMes] = useState('todos');
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  async function carregar() {
    setLoading(true); setErro('');
    const { data, error } = await supabase.from('vendas').select('*').order('data', { ascending: false });
    if (error) setErro(error.message); else setVendas(data || []);
    setLoading(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, []);

  const anos = useMemo(() => [...new Set(vendas.map(v => String(v.data).slice(0, 4)))].sort().reverse(), [vendas]);

  const base = useMemo(() => vendas.filter(v => {
    if (fAno !== 'todos' && String(v.data).slice(0, 4) !== fAno) return false;
    if (fMes !== 'todos' && String(v.data).slice(5, 7) !== fMes) return false;
    return true;
  }), [vendas, fAno, fMes]);

  const filtradas = useMemo(() => base.filter(v => fTipo === 'Todos' || v.tipo === fTipo), [base, fTipo]);

  const soma = (arr, k) => arr.reduce((s, v) => s + (Number(v[k]) || 0), 0);
  const vgv = soma(filtradas, 'vgv');
  const comissao = soma(filtradas, 'comissao');
  const ticket = filtradas.length ? vgv / filtradas.length : 0;

  const vendasArr = base.filter(v => v.tipo === 'Venda');
  const locArr = base.filter(v => v.tipo === 'Locação');

  const papeis = [
    ['Corretor', soma(filtradas, 'p_corretor'), '#2563eb'],
    ['Captador', soma(filtradas, 'p_captador'), '#0891b2'],
    ['Gerente', soma(filtradas, 'p_gerente'), '#7c3aed'],
    ['Imobiliária', soma(filtradas, 'p_imobiliaria'), '#059669'],
  ];

  const anoGraf = fAno !== 'todos' ? fAno : (anos[0] || String(new Date().getFullYear()));
  const porMes = useMemo(() => {
    const arr = Array(12).fill(0);
    vendas.filter(v => (fTipo === 'Todos' || v.tipo === fTipo) && String(v.data).slice(0, 4) === anoGraf)
      .forEach(v => { arr[Number(String(v.data).slice(5, 7)) - 1] += Number(v.vgv) || 0; });
    return arr;
  }, [vendas, fTipo, anoGraf]);
  const maxMes = Math.max(1, ...porMes);

  async function salvar() {
    setSaving(true);
    const v = edit;
    const payload = {
      data: v.data, tipo: v.tipo, cliente: v.cliente || null, imovel: v.imovel || null,
      vgv: Number(v.vgv) || 0, comissao: Number(v.comissao) || 0,
      p_corretor: Number(v.p_corretor) || 0, p_captador: Number(v.p_captador) || 0,
      p_gerente: Number(v.p_gerente) || 0, p_imobiliaria: Number(v.p_imobiliaria) || 0,
      observacao: v.observacao || null,
    };
    let error;
    if (v.id) ({ error } = await supabase.from('vendas').update(payload).eq('id', v.id));
    else ({ error } = await supabase.from('vendas').insert(payload));
    setSaving(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    setEdit(null); carregar();
  }

  async function excluir(v) {
    if (!window.confirm('Excluir este lançamento? Não dá pra desfazer.')) return;
    const { error } = await supabase.from('vendas').delete().eq('id', v.id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    carregar();
  }

  const sel = { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif' };
  const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 18px' };
  const inp = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', marginTop: 4 };
  const lab = { fontSize: 12, color: '#6b7280', display: 'block' };
  const btn = (bg, fg) => ({ padding: '8px 16px', borderRadius: 7, border: 'none', background: bg, color: fg || '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' });
  const RIGHT = ['VGV', 'Comissão', 'Corretor', 'Captador', 'Gerente', 'Imob.'];

  if (loading) return <div style={{ padding: 40, color: '#9ca3af' }}>Carregando vendas...</div>;

  return (
    <div>
      {erro && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>Erro: {erro}. A tabela <code>vendas</code> já foi criada no Supabase?</div>}

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={fTipo} onChange={e => setFTipo(e.target.value)} style={sel}>
          <option value="Todos">Vendas + Locações</option>
          <option value="Venda">Só Vendas</option>
          <option value="Locação">Só Locações</option>
        </select>
        <select value={fAno} onChange={e => setFAno(e.target.value)} style={sel}>
          <option value="todos">Todos os anos</option>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={fMes} onChange={e => setFMes(e.target.value)} style={sel}>
          <option value="todos">Todos os meses</option>
          {MESES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => setEdit({ ...vazio })} style={btn('#2563eb')}>+ Novo lançamento</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 18 }}>
        {[['VGV', BRL(vgv), '#2563eb'], ['Lançamentos', String(filtradas.length), '#0891b2'], ['Comissão total', BRL(comissao), '#059669'], ['Ticket médio', BRL(ticket), '#7c3aed']].map(([l, v, c]) => (
          <div key={l} style={card}>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>🏠 Vendas no período</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginTop: 4 }}>{vendasArr.length} · {BRL(soma(vendasArr, 'vgv'))}</div>
        </div>
        <div style={{ ...card, flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>🔑 Locações no período</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginTop: 4 }}>{locArr.length} · {BRL(soma(locArr, 'vgv'))}</div>
        </div>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Divisão da comissão</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 28 }}>
        {papeis.map(([l, v, c]) => (
          <div key={l} style={card}>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{BRL(v)}</div>
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 12 }}>VGV por mês · {anoGraf}</h3>
      <div style={{ ...card, display: 'flex', alignItems: 'flex-end', gap: 8, height: 170, marginBottom: 28 }}>
        {porMes.map((v, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <div title={BRL(v)} style={{ width: '100%', maxWidth: 32, background: v ? 'linear-gradient(180deg,#3b82f6,#2563eb)' : '#eef2f7', height: Math.max(2, Math.round(v / maxMes * 120)), borderRadius: 5 }} />
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6 }}>{MESES[i]}</div>
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Lançamentos</h3>
      <div className="table-wrapper">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Data', 'Tipo', 'Cliente', 'Imóvel', 'VGV', 'Comissão', 'Corretor', 'Captador', 'Gerente', 'Imob.', ''].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: RIGHT.includes(h) ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Nenhum lançamento no filtro.</td></tr>}
            {filtradas.map(v => (
              <tr key={v.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{String(v.data).slice(8, 10) + '/' + String(v.data).slice(5, 7)}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: v.tipo === 'Locação' ? '#fef3c7' : '#dbeafe', color: v.tipo === 'Locação' ? '#b45309' : '#1d4ed8' }}>{v.tipo}</span>
                </td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{v.cliente || '—'}</td>
                <td style={{ padding: '10px 12px', color: '#6b7280' }}>{v.imovel || '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#2563eb', fontWeight: 600 }}>{BRL(v.vgv)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{BRL(v.comissao)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>{BRL(v.p_corretor)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>{BRL(v.p_captador)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>{BRL(v.p_gerente)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>{BRL(v.p_imobiliaria)}</td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                  <button onClick={() => setEdit({ ...v })} style={{ padding: '4px 9px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer', marginRight: 6 }}>Editar</button>
                  <button onClick={() => excluir(v)} style={{ padding: '4px 9px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <div onClick={() => !saving && setEdit(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', zIndex: 1000, overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 560, fontFamily: 'Inter, sans-serif' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>{edit.id ? 'Editar lançamento' : 'Novo lançamento'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={lab}>Data<input type="date" value={edit.data} onChange={e => setEdit({ ...edit, data: e.target.value })} style={inp} /></label>
              <label style={lab}>Tipo<select value={edit.tipo} onChange={e => setEdit({ ...edit, tipo: e.target.value })} style={inp}><option>Venda</option><option>Locação</option></select></label>
              <label style={{ ...lab, gridColumn: '1 / 3' }}>Cliente<input value={edit.cliente || ''} onChange={e => setEdit({ ...edit, cliente: e.target.value })} style={inp} /></label>
              <label style={{ ...lab, gridColumn: '1 / 3' }}>Imóvel<input value={edit.imovel || ''} onChange={e => setEdit({ ...edit, imovel: e.target.value })} style={inp} /></label>
              <label style={lab}>VGV (R$)<input type="number" value={edit.vgv} onChange={e => setEdit({ ...edit, vgv: e.target.value })} style={inp} /></label>
              <label style={lab}>Comissão (R$)<input type="number" value={edit.comissao} onChange={e => setEdit({ ...edit, comissao: e.target.value })} style={inp} /></label>
              <label style={lab}>Corretor (R$)<input type="number" value={edit.p_corretor} onChange={e => setEdit({ ...edit, p_corretor: e.target.value })} style={inp} /></label>
              <label style={lab}>Captador (R$)<input type="number" value={edit.p_captador} onChange={e => setEdit({ ...edit, p_captador: e.target.value })} style={inp} /></label>
              <label style={lab}>Gerente (R$)<input type="number" value={edit.p_gerente} onChange={e => setEdit({ ...edit, p_gerente: e.target.value })} style={inp} /></label>
              <label style={lab}>Imobiliária (R$)<input type="number" value={edit.p_imobiliaria} onChange={e => setEdit({ ...edit, p_imobiliaria: e.target.value })} style={inp} /></label>
              <label style={{ ...lab, gridColumn: '1 / 3' }}>Observação<input value={edit.observacao || ''} onChange={e => setEdit({ ...edit, observacao: e.target.value })} style={inp} /></label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setEdit(null)} disabled={saving} style={btn('#e5e7eb', '#374151')}>Cancelar</button>
              <button onClick={salvar} disabled={saving} style={btn('#2563eb')}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
