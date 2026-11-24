import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

// Telefone igual ao backend: só dígitos, sem 55, celular com 11 dígitos.
function tel11(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length >= 12 && d.length <= 13 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 10 && /[6-9]/.test(d[2])) d = d.slice(0, 2) + '9' + d.slice(2);
  return d;
}
const dataBR = d => String(d || '').slice(0, 10).split('-').reverse().join('/');
const horaBR = t => { try { return new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };

export default function AcompanhamentoWhats({ telefone, clienteId, negociacaoId }) {
  const tel = tel11(telefone);
  const [row, setRow] = useState(null);
  const [regs, setRegs] = useState([]);
  const [recado, setRecado] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [verDias, setVerDias] = useState(false);

  const carregar = useCallback(async () => {
    if (tel.length < 10) return;
    const { data } = await supabase.from('crm_acompanhamento').select('*').eq('telefone_norm', tel).limit(1);
    setRow((data && data[0]) || null);
    const { data: r } = await supabase.from('crm_acomp_registros').select('dia,resumo').eq('telefone_norm', tel).order('dia', { ascending: false }).limit(30);
    setRegs(r || []);
  }, [tel]);

  useEffect(() => { carregar(); }, [carregar]);

  if (tel.length < 10) return null;
  const ativo = !!(row && row.ativo);

  async function ligar(liga) {
    setOcupado(true);
    try {
      const agora = new Date().toISOString();
      const dados = liga
        ? { telefone_norm: tel, ativo: true, parado_em: null, atualizado_em: agora, ...(ativo ? {} : { historico_importado: false, origem_marcacao: 'crm' }), ...(clienteId ? { cliente_id: String(clienteId) } : {}), ...(negociacaoId ? { negociacao_id: String(negociacaoId) } : {}) }
        : { telefone_norm: tel, ativo: false, parado_em: agora, atualizado_em: agora };
      const { error } = await supabase.from('crm_acompanhamento').upsert(dados, { onConflict: 'telefone_norm' });
      if (error) alert('Não consegui ' + (liga ? 'ligar' : 'desligar') + ' o acompanhamento:\n' + error.message);
      await carregar();
    } finally { setOcupado(false); }
  }

  async function mandarRecado() {
    const t = recado.trim(); if (!t) return;
    setOcupado(true);
    try {
      if (!ativo) await ligar(true);
      const { error } = await supabase.from('crm_whats_msgs').insert({ id: 'recado-crm-' + Date.now(), telefone_norm: tel, ts: Math.floor(Date.now() / 1000), eu: true, tipo: 'recado', texto: t.slice(0, 4000) });
      if (error) { alert('Não consegui anotar o recado:\n' + error.message); return; }
      await supabase.from('crm_acompanhamento').update({ pendente_desde: new Date().toISOString() }).eq('telefone_norm', tel);
      setRecado('');
      alert('Recado anotado. Em alguns minutos a IA atualiza o CRM.');
      await carregar();
    } finally { setOcupado(false); }
  }

  const avisos = (row && Array.isArray(row.ia_avisos) ? row.ia_avisos : []).filter(a => !negociacaoId || String(a.negociacao_id) === String(negociacaoId));

  return (
    <div className="tsec" style={{ border: `1px solid ${ativo ? '#86efac' : '#e5e7eb'}`, background: ativo ? '#f0fdf4' : '#fafafa', borderRadius: 10, padding: 12, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>🤖 Acompanhamento pelo WhatsApp {ativo ? <span style={{ color: '#059669' }}>· ligado</span> : <span style={{ color: '#9ca3af' }}>· desligado</span>}</div>
        <button type="button" disabled={ocupado} onClick={() => ligar(!ativo)}
          style={{ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: ativo ? '#fee2e2' : '#059669', color: ativo ? '#b91c1c' : '#fff' }}>
          {ativo ? 'Parar de acompanhar' : 'Acompanhar pelo WhatsApp'}
        </button>
      </div>
      {!ativo && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>Ligado, a IA lê a conversa com este cliente no seu WhatsApp (inclusive áudios) e vai preenchendo o cadastro, as demandas e as etapas sozinha.</div>}
      {row && row.ia_situacao && <div style={{ fontSize: 13, marginTop: 8 }}><b>Situação:</b> {row.ia_situacao}{row.ia_em ? <span style={{ color: '#9ca3af', fontSize: 11 }}> · atualizado {horaBR(row.ia_em)}</span> : null}</div>}
      {ativo && row && !row.ia_em && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>Lendo a conversa… em alguns minutos aparece aqui.</div>}
      {row && row.ia_erro && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 6 }}>Última tentativa da IA falhou: {row.ia_erro}</div>}
      {avisos.map((a, i) => (
        <div key={i} style={{ marginTop: 8, fontSize: 12.5, background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 8, padding: '7px 10px' }}>
          ⚠️ A IA acha que esta demanda terminou: {a.motivo}. Se concordar, marque como inativa.
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input value={recado} onChange={e => setRecado(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); mandarRecado(); } }}
          placeholder="Recado para a IA (o que conversaram fora do WhatsApp: ligação, visita, proposta…)" style={{ flex: 1 }} />
        <button type="button" disabled={ocupado || !recado.trim()} onClick={mandarRecado}
          style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Anotar</button>
      </div>
      {regs.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button type="button" onClick={() => setVerDias(v => !v)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 12.5, padding: 0 }}>
            {verDias ? '▾' : '▸'} Histórico da conversa ({regs.length} {regs.length === 1 ? 'dia' : 'dias'})
          </button>
          {verDias && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {regs.map(r => <div key={r.dia} style={{ fontSize: 12.5 }}><b>{dataBR(r.dia)}</b> — {r.resumo}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
