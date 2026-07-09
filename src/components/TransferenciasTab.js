import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const BACKEND = 'https://agentes-de-whatsapp-production.up.railway.app';

// Aba de Transferências de cliente — fluxo de DUPLA aprovação:
//   pendente_origem  -> gerente do corretor de origem (ou diretor) libera a saída
//   pendente_destino -> o corretor destino, o gerente dele, ou o diretor aceita a entrada
//   aceita           -> move corretor_id do cliente e da negociação para o destino
export default function TransferenciasTab({ perfil }) {
  const [lista, setLista] = useState([]);
  const [perfis, setPerfis] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const nomePerfil = useCallback((id) => (perfis.find(p => p.id === id) || {}).nome || '—', [perfis]);
  const nomeCliente = useCallback((id) => (clientes.find(c => c.id === id) || {}).nome || '—', [clientes]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: transf }, { data: perfisData }, { data: clientesData }] = await Promise.all([
      supabase.from('transferencias').select('*').order('criado_em', { ascending: false }),
      supabase.from('perfis').select('id, nome, is_gerente, is_diretor, gerente_id'),
      supabase.from('clientes').select('id, nome'),
    ]);
    setLista(transf || []);
    setPerfis(perfisData || []);
    setClientes(clientesData || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Pode o usuário logado aprovar a etapa de ORIGEM desta transferência?
  // (é gerente do corretor de origem, ou diretor)
  function podeAprovarOrigem(t) {
    if (perfil.is_diretor) return true;
    const origem = perfis.find(p => p.id === t.de_corretor_id);
    return !!(perfil.is_gerente && origem && origem.gerente_id === perfil.id);
  }

  // Pode aprovar a etapa de DESTINO? (é o próprio destino, gerente do destino, ou diretor)
  function podeAprovarDestino(t) {
    if (perfil.is_diretor) return true;
    if (t.para_corretor_id === perfil.id) return true;
    const destino = perfis.find(p => p.id === t.para_corretor_id);
    return !!(perfil.is_gerente && destino && destino.gerente_id === perfil.id);
  }

  async function aprovarOrigem(t) {
    setMsg('');
    const { error } = await supabase.from('transferencias').update({
      status: 'pendente_destino',
      aprovado_origem_por: perfil.id,
      aprovado_origem_em: new Date().toISOString(),
    }).eq('id', t.id);
    if (error) setMsg('Erro: ' + error.message); else load();
  }

  async function aprovarDestino(t) {
    setMsg('');
    // A efetivação roda no BANCO (função aceitar_transferencia, SECURITY DEFINER):
    // valida quem aceita e move cliente+negociação sem esbarrar no RLS.
    // (Antes o update rodava como o destino e o RLS barrava em silêncio — 0 linhas.)
    const { data, error } = await supabase.rpc('aceitar_transferencia', { t_id: String(t.id) });
    if (error) { setMsg('Erro: ' + error.message + ' — se aparecer "function not found", rode o SQL da função aceitar_transferencia no Supabase.'); return; }
    if (data !== 'ok') { setMsg('Não foi possível aceitar: ' + data); return; }
    // Propaga o novo dono pro Estoque (Firestore). Sem isso, um imóvel captado e
    // transferido continua invisível pra quem recebeu (fica com o e-mail do dono antigo).
    await sincronizarEstoqueDono(t);
    load();
  }

  // Escreve o captador do imóvel no Estoque com o corretor de DESTINO. Só age se a
  // negociação já tem imóvel (estoque_id); se ainda não tem, o botão "Sincronizar
  // captações → Estoque" (aba Captações) cria depois. Nunca bloqueia a transferência.
  async function sincronizarEstoqueDono(t) {
    try {
      if (!t.negociacao_id) return;
      const { data: neg } = await supabase.from('negociacoes')
        .select('captado, estoque_id').eq('id', t.negociacao_id).single();
      if (!neg || !neg.captado || !neg.estoque_id) return;
      const { data: destino } = await supabase.from('perfis')
        .select('nome, email, telefone').eq('id', t.para_corretor_id).single();
      if (!destino) return;
      await fetch(BACKEND + '/captacao/atualizar-dono-estoque', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: neg.estoque_id,
          ficha: {
            captadorEmail: destino.email ? String(destino.email).toLowerCase() : null,
            nomeCaptador: destino.nome || '',
            telefoneCaptador: destino.telefone || '',
          },
        }),
      });
    } catch (e) { /* silencioso: a reconciliação cobre qualquer falha depois */ }
  }

  async function recusar(t) {
    setMsg('');
    const { error } = await supabase.from('transferencias').update({ status: 'recusada' }).eq('id', t.id);
    if (error) setMsg('Erro: ' + error.message); else load();
  }

  async function cancelar(t) {
    setMsg('');
    const { error } = await supabase.from('transferencias').update({ status: 'cancelada' }).eq('id', t.id);
    if (error) setMsg('Erro: ' + error.message); else load();
  }

  const STATUS_LABEL = {
    pendente_origem: { txt: 'Aguardando gerente de origem', cor: '#b45309', bg: '#fef3c7' },
    pendente_destino: { txt: 'Aguardando destino aceitar', cor: '#7c3aed', bg: '#f5f3ff' },
    aceita: { txt: 'Aceita', cor: '#059669', bg: '#d1fae5' },
    recusada: { txt: 'Recusada', cor: '#dc2626', bg: '#fee2e2' },
    cancelada: { txt: 'Cancelada', cor: '#6b7280', bg: '#f3f4f6' },
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Carregando transferências…</div>;

  const pendentes = lista.filter(t => t.status === 'pendente_origem' || t.status === 'pendente_destino');
  const historico = lista.filter(t => t.status === 'aceita' || t.status === 'recusada' || t.status === 'cancelada');

  const Card = ({ t }) => {
    const st = STATUS_LABEL[t.status] || STATUS_LABEL.cancelada;
    const souSolicitante = t.de_corretor_id === perfil.id;
    const mostraAprovarOrigem = t.status === 'pendente_origem' && podeAprovarOrigem(t);
    const mostraAprovarDestino = t.status === 'pendente_destino' && podeAprovarDestino(t);
    const mostraRecusar = (t.status === 'pendente_origem' && podeAprovarOrigem(t)) || (t.status === 'pendente_destino' && podeAprovarDestino(t));
    const mostraCancelar = souSolicitante && (t.status === 'pendente_origem' || t.status === 'pendente_destino');
    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 12, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{nomeCliente(t.cliente_id)}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
              De <b>{nomePerfil(t.de_corretor_id)}</b> → para <b>{nomePerfil(t.para_corretor_id)}</b>
            </div>
            {t.observacao && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{t.observacao}</div>}
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: st.cor, background: st.bg, padding: '4px 10px', borderRadius: 20 }}>{st.txt}</span>
        </div>
        {(mostraAprovarOrigem || mostraAprovarDestino || mostraRecusar || mostraCancelar) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {mostraAprovarOrigem && <button onClick={() => aprovarOrigem(t)} style={btn('#7c3aed')}>Liberar saída</button>}
            {mostraAprovarDestino && <button onClick={() => aprovarDestino(t)} style={btn('#059669')}>Aceitar cliente</button>}
            {mostraRecusar && <button onClick={() => recusar(t)} style={btn('#dc2626', true)}>Recusar</button>}
            {mostraCancelar && <button onClick={() => cancelar(t)} style={btn('#6b7280', true)}>Cancelar</button>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>🔄 Transferências de Cliente</h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 18 }}>
        Solicitação de transferência precisa de dupla aprovação: o gerente de origem libera a saída, e o destino (ou o gerente dele) aceita a entrada.
      </p>
      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>{msg}</div>}

      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: '8px 0 10px' }}>Pendentes ({pendentes.length})</h3>
      {pendentes.length === 0
        ? <div style={{ color: '#9ca3af', fontSize: 13, padding: '12px 0' }}>Nenhuma transferência pendente.</div>
        : pendentes.map(t => <Card key={t.id} t={t} />)}

      {historico.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: '24px 0 10px' }}>Histórico</h3>
          {historico.map(t => <Card key={t.id} t={t} />)}
        </>
      )}
    </div>
  );
}

function btn(cor, outline) {
  return {
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: outline ? `1px solid ${cor}` : 'none',
    background: outline ? '#fff' : cor,
    color: outline ? cor : '#fff',
  };
}
