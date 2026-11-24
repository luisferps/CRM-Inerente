import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const NOME_CAMPO = { modalidade: 'Modalidade', origem_tratativa: 'Origem da demanda', imovel: 'Tipo de imóvel', localizacao: 'Localização', valor: 'Valor', detalhes: 'Detalhes', proxima_acao: 'Próxima ação' };

// Caderno de aprendizado da IA que acompanha os atendimentos pelo WhatsApp.
export default function RegrasIA({ perfil }) {
  const [regras, setRegras] = useState([]);
  const [correcoes, setCorrecoes] = useState([]);
  const [nova, setNova] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const { data: r } = await supabase.from('crm_ia_regras').select('id,texto,criado_em,origem').eq('ativo', true).order('id', { ascending: true });
    setRegras(r || []);
    const { data: c } = await supabase.from('crm_ia_correcoes').select('id,campo,valor_ia,valor_luis,criado_em').order('id', { ascending: false }).limit(30);
    setCorrecoes(c || []);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function adicionar() {
    const t = nova.trim();
    if (t.length < 5) { alert('Escreva a regra.'); return; }
    setOcupado(true);
    const { error } = await supabase.from('crm_ia_regras').insert({ texto: t.slice(0, 1000), origem: 'crm', criado_por: perfil?.nome || null });
    setOcupado(false);
    if (error) { alert('Não consegui salvar a regra:\n' + error.message); return; }
    setNova('');
    carregar();
  }

  async function retirar(id) {
    setOcupado(true);
    const { error } = await supabase.from('crm_ia_regras').update({ ativo: false }).eq('id', id);
    setOcupado(false);
    if (error) { alert('Não consegui retirar a regra:\n' + error.message); return; }
    carregar();
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, flex: '1 1 520px', minWidth: 320 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🤖 Caderno de aprendizado da IA</div>
      <div style={{ fontSize: 12.5, color: '#6b7280', marginBottom: 12 }}>
        Regras gerais que a IA do acompanhamento pelo WhatsApp segue sempre, em todos os clientes. Também dá pra mandar no seu WhatsApp: <b>crm regra: …</b>
      </div>
      {regras.length === 0 && <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>Nenhuma regra ainda.</div>}
      {regras.map(r => (
        <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
          <span style={{ fontSize: 12, color: '#9ca3af', minWidth: 34 }}>nº {r.id}</span>
          <span style={{ fontSize: 13.5, flex: 1 }}>{r.texto}</span>
          <button type="button" disabled={ocupado} onClick={() => retirar(r.id)}
            style={{ border: 'none', background: '#fee2e2', color: '#b91c1c', borderRadius: 6, padding: '3px 9px', fontSize: 12, cursor: 'pointer' }}>Retirar</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input value={nova} onChange={e => setNova(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }}
          placeholder="Nova regra geral (ex.: quando o cliente não disser o valor, deixar o valor em branco)" style={{ flex: 1 }} />
        <button type="button" disabled={ocupado} onClick={adicionar}
          style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Adicionar</button>
      </div>
      <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 18, marginBottom: 6 }}>Correções que a IA aprendeu com vocês</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Quando alguém corrige no CRM um campo que a IA preencheu, ela anota aqui e passa a seguir o padrão. O campo corrigido nunca mais é mexido por ela.</div>
      {correcoes.length === 0 && <div style={{ fontSize: 13, color: '#9ca3af' }}>Nenhuma correção ainda.</div>}
      {correcoes.map(c => (
        <div key={c.id} style={{ fontSize: 12.5, padding: '4px 0' }}>
          <b>{NOME_CAMPO[c.campo] || c.campo}:</b> <span style={{ color: '#b91c1c', textDecoration: 'line-through' }}>{c.valor_ia}</span> → <span style={{ color: '#059669' }}>{c.valor_luis}</span>
        </div>
      ))}
    </div>
  );
}
