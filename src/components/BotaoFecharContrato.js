import { useState } from 'react';
import { supabase } from '../supabaseClient';

const BACKEND = 'https://agentes-de-whatsapp-production.up.railway.app';
const PORTAL = 'https://portalinerente.netlify.app';

// Botão "Fazer contrato → Secretaria".
// Aparece para diretor/gerente, quando a tratativa está na etapa Contrato.
// Ao confirmar: cria a venda na Secretaria (cliente + imóvel) e abre o Portal
// direto na pasta daquela venda (onde fica o gerador de contrato).
//
// props:
//   neg          -> item da tratativa (nome, telefone, email, imovel, valor, modalidade, corretor, contrato)
//   podeContrato -> boolean (diretor ou gerente)
//   variant      -> 'card' | 'row' | 'modal'  (só muda o estilo do botão)
export default function BotaoFecharContrato({ neg, podeContrato, variant = 'row' }) {
  const [aberto, setAberto] = useState(false);
  const [imovelTexto, setImovelTexto] = useState('');
  const [ofertas, setOfertas] = useState(null);
  const [carregandoEstoque, setCarregandoEstoque] = useState(false);
  const [busca, setBusca] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');

  if (!podeContrato) return null;
  if (!neg || !neg.contrato) return null;

  function abrir(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setImovelTexto(neg.imovel || '');
    setOfertas(null);
    setBusca('');
    setErro('');
    setAberto(true);
  }

  function fechar(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (criando) return;
    setAberto(false);
  }

  async function carregarEstoque(e) {
    if (e) e.stopPropagation();
    setCarregandoEstoque(true);
    try {
      const r = await fetch(BACKEND + '/grupos/estoque-ofertas');
      const j = await r.json();
      setOfertas(Array.isArray(j.ofertas) ? j.ofertas : []);
    } catch (err) {
      setOfertas([]);
    }
    setCarregandoEstoque(false);
  }

  function rotuloOferta(o) {
    const local = [o.condominio, o.bairro, o.cidade].filter(Boolean).join(', ');
    const preco = o.preco ? ' — R$ ' + Number(o.preco).toLocaleString('pt-BR') : '';
    return [o.titulo, local].filter(Boolean).join(' · ') + preco;
  }

  async function confirmar(e) {
    if (e) e.stopPropagation();
    const imovel = (imovelTexto || '').trim();
    if (!imovel) { setErro('Escolha ou digite o imóvel antes de continuar.'); return; }
    setCriando(true);
    setErro('');
    try {
      const ehLocacao = neg.modalidade === 'Locação';
      const payloadVenda = {
        data: new Date().toISOString().slice(0, 10),
        tipo: ehLocacao ? 'Locação' : 'Venda',
        cliente: neg.nome || '',
        imovel: imovel,
        vgv: ehLocacao ? 0 : (neg.valor != null && neg.valor !== '' ? Number(neg.valor) : 0),
        comissao: 0,
        corretor: neg.corretor || '',
        observacao: 'Criado pelo CRM a partir da tratativa de ' + (neg.nome || 'cliente') + '.',
      };
      const { data: venda, error } = await supabase.from('vendas').insert(payloadVenda).select().single();
      if (error) throw error;

      const participantes = [
        { venda_id: venda.id, papel: 'comprador', nome: neg.nome || '', telefone: neg.telefone || '', email: neg.email || '', interno: false, ordem: 0 },
        { venda_id: venda.id, papel: 'imovel', nome: imovel, interno: false, ordem: 0 },
      ];
      // os participantes são um conforto inicial; se a tabela ainda não existir, a venda já foi criada
      try { await supabase.from('venda_participantes').insert(participantes); } catch (e2) {}

      window.open(PORTAL + '/?abrirVenda=' + venda.id, '_blank');
      setCriando(false);
      setAberto(false);
    } catch (err) {
      setCriando(false);
      setErro('Não consegui criar a venda: ' + (err.message || err));
    }
  }

  // ---- estilos do botão por variante ----
  let btnStyle;
  if (variant === 'card') {
    btnStyle = { width: '100%', marginTop: 6, padding: '5px 8px', borderRadius: 6, border: 'none', background: '#065f46', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer' };
  } else if (variant === 'modal') {
    btnStyle = { padding: '9px 16px', borderRadius: 8, border: 'none', background: '#065f46', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
  } else {
    btnStyle = { padding: '4px 10px', borderRadius: 6, border: 'none', background: '#065f46', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' };
  }

  const ofertasFiltradas = (ofertas || []).filter(o => {
    if (!busca.trim()) return true;
    return rotuloOferta(o).toLowerCase().includes(busca.trim().toLowerCase());
  });

  return (
    <>
      <button type="button" onClick={abrir} style={btnStyle} title="Criar a venda e abrir o contrato na Secretaria">
        ✍️ Fazer contrato
      </button>

      {aberto && (
        <div
          onClick={fechar}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, padding: 22, width: '100%', maxWidth: 460, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4, color: '#1a1a2e' }}>✍️ Fazer contrato</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              Cliente: <b>{neg.nome || '—'}</b>{neg.valor ? <> · Valor: <b>R$ {Number(neg.valor).toLocaleString('pt-BR')}</b></> : null}
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Imóvel deste contrato</label>
            <input value={imovelTexto} onChange={e => setImovelTexto(e.target.value)}
              placeholder="Ex.: Apartamento 302, Ed. Aurora — Setor Bueno"
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, marginBottom: 10 }} />

            {ofertas === null ? (
              <button type="button" onClick={carregarEstoque} disabled={carregandoEstoque}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12 }}>
                {carregandoEstoque ? 'Carregando o Estoque…' : '🔎 Escolher da lista do Estoque'}
              </button>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Filtrar imóveis do Estoque…"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, marginBottom: 6 }} />
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  {ofertasFiltradas.length === 0 && <div style={{ padding: 10, fontSize: 12, color: '#9ca3af' }}>Nenhum imóvel encontrado.</div>}
                  {ofertasFiltradas.map(o => (
                    <div key={o.id} onClick={() => setImovelTexto(rotuloOferta(o))}
                      style={{ padding: '8px 10px', fontSize: 12, borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      {rotuloOferta(o)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {erro && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{erro}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button type="button" onClick={fechar} disabled={criando}
                style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button type="button" onClick={confirmar} disabled={criando}
                style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#065f46', color: '#fff', fontSize: 13, fontWeight: 700, cursor: criando ? 'default' : 'pointer', opacity: criando ? 0.7 : 1 }}>
                {criando ? 'Criando…' : 'Criar venda e abrir contrato'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
