import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { obterOuCriarCliente } from '../lib/clientes';

const TIPOS = ['Casa', 'Apartamento', 'Lote', 'Área', 'Comercial'];

export default function TriagemFacebookTab({ perfil }) {
  const [leads, setLeads] = useState([]);
  const [statusAtual, setStatusAtual] = useState('novo');
  const [canalAtivo, setCanalAtivo] = useState(true);
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(null);
  const [aberto, setAberto] = useState({});
  const [f, setF] = useState({ tipo: '', trans: '', agio: '', min: '', max: '', busca: '' });

  const flash = useCallback((t) => { setMsg(t); setTimeout(() => setMsg(''), 2800); }, []);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('captacao_facebook').select('*').order('data_captura', { ascending: false }).limit(1000);
    if (error) { flash('Erro ao carregar: ' + error.message); return; }
    setLeads(data || []);
  }, [flash]);

  const carregarCanal = useCallback(async () => {
    const { data } = await supabase.from('captacao_facebook_cfg').select('ativo').eq('id', 'singleton').single();
    setCanalAtivo(data ? data.ativo !== false : true);
  }, []);

  useEffect(() => {
    carregar(); carregarCanal();
    const iv = setInterval(() => { carregar(); carregarCanal(); }, 60000);
    return () => clearInterval(iv);
  }, [carregar, carregarCanal]);

  function filtrar() {
    const min = parseInt(f.min, 10) || 0, max = parseInt(f.max, 10) || Infinity;
    const q = (f.busca || '').toLowerCase();
    return leads.filter(l => {
      if ((l.status || 'novo') !== statusAtual) return false;
      if (f.tipo === '_outro') { if (TIPOS.indexOf(l.tipo) >= 0) return false; }
      else if (f.tipo && l.tipo !== f.tipo) return false;
      if (f.trans && l.transacao !== f.trans) return false;
      if (f.agio === 'sim' && !l.agio) return false;
      if (f.agio === 'nao' && l.agio) return false;
      const v = l.valor_num || 0;
      if (v && (v < min || v > max)) return false;
      if (!v && (min > 0 || max < Infinity)) return false;
      if (q) { const alvo = ((l.titulo || '') + ' ' + (l.local || '') + ' ' + (l.telefone || '') + ' ' + (l.anunciante || '') + ' ' + (l.descricao || '')).toLowerCase(); if (alvo.indexOf(q) < 0) return false; }
      return true;
    });
  }

  async function setStatus(id, st, extra) {
    const body = { status: st, ...(extra || {}) };
    const { error } = await supabase.from('captacao_facebook').update(body).eq('id', id);
    if (error) { flash('Erro: ' + error.message); return; }
    setLeads(ls => ls.map(l => l.id === id ? { ...l, ...body } : l));
  }

  async function enviarCRM(l) {
    if (!canalAtivo) { flash('⛔ Canal desligado pelo diretor — envio bloqueado.'); return; }
    setEnviando(l.id);
    try {
      const tel = String(l.telefone || '').replace(/\D/g, '');
      const modalidade = (l.transacao === 'Aluguel') ? 'Locação' : 'Venda';
      const imovelChave = [l.tipo || 'Imóvel', l.transacao || ''].filter(Boolean).join(' - ') || 'Imóvel Facebook';

      const { cliente } = await obterOuCriarCliente({
        nome: (l.anunciante && l.anunciante.trim()) || ('Proprietário ' + tel),
        telefone: tel,
        origem: 'Facebook',
        corretor_id: perfil?.id || null,
      });
      const clienteId = cliente.id;

      const { data: dups } = await supabase.from('negociacoes')
        .select('id,imovel').eq('cliente_id', clienteId).eq('origem_tratativa', 'Facebook').eq('ativo', 'S').limit(50);
      if (dups && dups.some(d => String(d.imovel || '').trim() === imovelChave)) {
        flash('Já existia tratativa Facebook deste cliente — não dupliquei.');
        await setStatus(l.id, 'enviado', { enviado_em: new Date().toISOString() });
        setEnviando(null); return;
      }

      const resumo = '[Captado Facebook] ' + [l.tipo, l.transacao, l.preco].filter(Boolean).join(' · ') +
        (l.local ? ' — ' + l.local : '') + (l.url ? '\n' + l.url : '') +
        (l.descricao ? '\n\n📋 Anúncio do proprietário:\n' + l.descricao : '');
      const novaNego = {
        cliente_id: clienteId, tratativa: true, ativo: 'S', captado: false,
        modalidade, origem_tratativa: 'Facebook', imovel: imovelChave, localizacao: l.local || null,
        valor: l.valor_num || null,
        ficha: { _descricao: l.descricao || '', _origem: 'Facebook', _url: l.url || '', _agio: !!l.agio, telefoneProprietario: tel },
        detalhes: resumo.slice(0, 3900), ultimo_contato: new Date().toISOString().slice(0, 10),
        corretor_id: perfil?.id || null, corretor: perfil?.nome || null
      };
      const { error: en } = await supabase.from('negociacoes').insert(novaNego);
      if (en) throw new Error('criar tratativa: ' + en.message);

      flash('✅ Enviado! Está na aba de Captações.');
      await setStatus(l.id, 'enviado', { enviado_em: new Date().toISOString() });
    } catch (e) {
      flash('Erro: ' + e.message);
    }
    setEnviando(null);
  }

  const arr = filtrar();
  const tot = { novo: 0, contactado: 0, enviado: 0, descartado: 0 };
  leads.forEach(l => { const s = l.status || 'novo'; if (tot[s] !== undefined) tot[s]++; });
  const badge = { fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#f3f4f6', color: '#374151', marginRight: 5 };
  const btn = (bg, cor) => ({ border: 'none', borderRadius: 8, padding: '7px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: bg, color: cor, marginRight: 6 });

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>📞 Triagem — Captação Facebook</h2>
        <p style={{ fontSize: 13, color: '#6b7280' }}>Leads capturados no Marketplace. Envie pro CRM só os que valem a captação.</p>
      </div>

      {!canalAtivo && (
        <div style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          🔴 Canal desligado pelo diretor — o envio pro CRM está bloqueado. (Ligue em ⚙️ Config.)
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}>
          <option value="">Tipo: todos</option>{TIPOS.map(t => <option key={t}>{t}</option>)}<option value="_outro">Outro/indefinido</option>
        </select>
        <select value={f.trans} onChange={e => setF({ ...f, trans: e.target.value })}><option value="">Venda e Aluguel</option><option>Venda</option><option>Aluguel</option></select>
        <select value={f.agio} onChange={e => setF({ ...f, agio: e.target.value })}><option value="">Ágio: todos</option><option value="sim">Só com ágio</option><option value="nao">Sem ágio</option></select>
        <input type="number" placeholder="Preço mín" value={f.min} onChange={e => setF({ ...f, min: e.target.value })} style={{ width: 100 }} />
        <input type="number" placeholder="Preço máx" value={f.max} onChange={e => setF({ ...f, max: e.target.value })} style={{ width: 100 }} />
        <input type="text" placeholder="Buscar (título, bairro, telefone...)" value={f.busca} onChange={e => setF({ ...f, busca: e.target.value })} style={{ flex: 1, minWidth: 140 }} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['novo', '📋 A triar', tot.novo], ['contactado', '📞 Contactados', tot.contactado], ['enviado', '✅ Enviados', tot.enviado], ['descartado', '🗑 Descartados', tot.descartado]].map(([st, lab, n]) => (
          <button key={st} onClick={() => setStatusAtual(st)}
            style={{ border: 'none', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: statusAtual === st ? '#C0392B' : '#e5e7eb', color: statusAtual === st ? '#fff' : '#374151' }}>
            {lab} ({n})
          </button>
        ))}
      </div>

      {arr.length === 0 && <div style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>Nada aqui com esses filtros.</div>}

      {arr.map(l => {
        const wa = 'https://wa.me/55' + l.telefone;
        return (
          <div key={l.id} style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, display: 'flex', gap: 12, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            {l.foto ? <img src={l.foto} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} /> : <div style={{ width: 80, height: 80, background: '#eee', borderRadius: 10, flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{l.titulo || '(sem título)'}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{l.local || ''}{l.anunciante ? ' · ' + l.anunciante : ''} · capt. {String(l.data_captura || '').slice(0, 10)}</div>
              <div style={{ color: '#C0392B', fontWeight: 700, fontSize: 15 }}>{l.telefone}</div>
              <div style={{ margin: '4px 0' }}>
                {l.tipo && <span style={badge}>{l.tipo}</span>}
                {l.transacao && <span style={badge}>{l.transacao}</span>}
                {l.agio && <span style={{ ...badge, background: '#fef3c7', color: '#92400e' }}>ÁGIO</span>}
                {l.preco && <span style={badge}>{l.preco}</span>}
              </div>
              {l.descricao && (
                <>
                  <button onClick={() => setAberto(a => ({ ...a, [l.id]: !a[l.id] }))} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 11, cursor: 'pointer', padding: 0 }}>ver descrição</button>
                  {aberto[l.id] && <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4, whiteSpace: 'pre-wrap' }}>{l.descricao}</div>}
                </>
              )}
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <a href={wa} target="_blank" rel="noreferrer" style={{ ...btn('#dcfce7', '#166534'), textDecoration: 'none' }}>WhatsApp</a>
                <a href={l.url} target="_blank" rel="noreferrer" style={{ ...btn('#dbeafe', '#1e40af'), textDecoration: 'none' }}>Anúncio</a>
                {(statusAtual === 'novo' || statusAtual === 'contactado') && (
                  <button onClick={() => enviarCRM(l)} disabled={!canalAtivo || enviando === l.id} style={{ ...btn('#C0392B', '#fff'), opacity: (!canalAtivo || enviando === l.id) ? 0.5 : 1 }}>
                    {enviando === l.id ? 'Enviando...' : '✅ Enviar pro CRM'}
                  </button>
                )}
                {statusAtual === 'novo' && <button onClick={() => setStatus(l.id, 'contactado', { contactado_em: new Date().toISOString() })} style={btn('#f3f4f6', '#374151')}>📞 Contactado (não deu)</button>}
                {statusAtual === 'contactado' && <button onClick={() => setStatus(l.id, 'novo')} style={btn('#e5e7eb', '#374151')}>↩ Voltar pra triar</button>}
                {(statusAtual === 'novo' || statusAtual === 'contactado') && <button onClick={() => { if (window.confirm('Descartar este lead?')) setStatus(l.id, 'descartado'); }} style={btn('#fee2e2', '#991b1b')}>🗑 Descartar</button>}
                {statusAtual === 'descartado' && <button onClick={() => setStatus(l.id, 'novo')} style={btn('#e5e7eb', '#374151')}>↩ Restaurar</button>}
              </div>
            </div>
          </div>
        );
      })}

      {msg && <div style={{ position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', background: '#1a1a2e', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, zIndex: 9999 }}>{msg}</div>}
    </div>
  );
}
