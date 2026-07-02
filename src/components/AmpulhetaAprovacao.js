import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// Ampulheta de aprovação de divisão de comissão (parte 4).
// Mostra ⏳ quando há um pedido de divisão PENDENTE que o usuário logado deve aprovar.
// - Gerente: vê os pedidos onde é o aprovador (aprovador_id = seu id).
// - Diretor: vê todos os pendentes (aprovador_id null ou qualquer).
// Ao clicar, abre um mini-painel para aprovar (aplica a divisão) ou recusar.
//
// Props:
//   clienteId  -> id do cliente/tratativa
//   perfil     -> { id, is_diretor, is_gerente }
//   onAplicado -> callback opcional após aprovar/recusar (para recarregar a lista)
export default function AmpulhetaAprovacao({ clienteId, perfil, onAplicado }) {
  const [pedido, setPedido] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [processando, setProcessando] = useState(false);

  const ehDiretor = !!perfil?.is_diretor;
  const ehGerente = !!perfil?.is_gerente;

  useEffect(() => {
    if (!clienteId || !perfil) return;
    if (!ehDiretor && !ehGerente) return; // corretor comum não aprova nada
    let vivo = true;
    supabase.from('tratativa_divisao_pedidos')
      .select('*').eq('cliente_id', clienteId).eq('status', 'pendente')
      .order('criado_em', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (!vivo) return;
        const p = data && data[0] ? data[0] : null;
        if (!p) { setPedido(null); return; }
        // Diretor vê todos; gerente só os que ele deve aprovar.
        if (ehDiretor) { setPedido(p); return; }
        if (ehGerente && p.aprovador_id === perfil.id) { setPedido(p); return; }
        // Gerente que não é o aprovador não vê.
        setPedido(null);
      });
    return () => { vivo = false; };
  }, [clienteId, perfil, ehDiretor, ehGerente]);

  if (!pedido) return null;

  async function decidir(novoStatus) {
    setProcessando(true);
    try {
      // 1) marca o pedido como aprovado/recusado
      const { error } = await supabase.from('tratativa_divisao_pedidos')
        .update({ status: novoStatus, decidido_em: new Date().toISOString(), decidido_por: perfil.id })
        .eq('id', pedido.id);
      if (error) { alert('Não consegui registrar a decisão: ' + error.message); setProcessando(false); return; }

      // 2) se aprovado, aplica a divisão proposta na tratativa (todas as negociações do cliente)
      if (novoStatus === 'aprovada') {
        const proposta = pedido.divisao_proposta || [];
        const donoEd = proposta[0]?.id || null;
        await supabase.from('negociacoes')
          .update({ tratativa_divisao: proposta, tratativa_dono_edicao: donoEd })
          .eq('cliente_id', pedido.cliente_id);
      }

      setPedido(null);
      setAberto(false);
      if (onAplicado) onAplicado();
    } catch (e) {
      alert('Falha ao aplicar a decisão.');
    }
    setProcessando(false);
  }

  const propostaTxt = (pedido.divisao_proposta || []).map(d => `${d.nome} ${d.pct}%`).join(' · ');

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span
        onClick={(e) => { e.stopPropagation(); setAberto(v => !v); }}
        title="Divisão de comissão aguardando sua aprovação"
        style={{ cursor: 'pointer', fontSize: 15, marginLeft: 6, userSelect: 'none' }}>
        ⏳
      </span>

      {aberto && (
        <>
          <div onClick={(e) => { e.stopPropagation(); setAberto(false); }}
            style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
          <div onClick={(e) => e.stopPropagation()}
            style={{ position: 'absolute', top: 22, left: 0, zIndex: 1001, width: 260, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', padding: 14, fontFamily: 'Inter, sans-serif', textAlign: 'left' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>⏳ Aprovar divisão de comissão</div>
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, marginBottom: 4 }}>
              Um corretor pediu para dividir a comissão com alguém de outra equipe. Você é o responsável por aprovar.
            </div>
            <div style={{ fontSize: 12, color: '#111827', background: '#f9fafb', borderRadius: 8, padding: '6px 8px', marginBottom: 10 }}>
              <b>Proposta:</b> {propostaTxt}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={processando} onClick={() => decidir('aprovada')}
                style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                {processando ? '...' : '✓ Aprovar'}
              </button>
              <button type="button" disabled={processando} onClick={() => decidir('recusada')}
                style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                ✕ Recusar
              </button>
            </div>
          </div>
        </>
      )}
    </span>
  );
}
