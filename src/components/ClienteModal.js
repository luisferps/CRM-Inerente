import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import BotaoFecharContrato from './BotaoFecharContrato';
import { ETAPAS_FUNIL_COMPLETO, ETAPAS_LABEL, normModalidade, ehCaptacao, ehLocacao } from '../constants';

const hoje = new Date().toISOString().slice(0, 10);
const BACKEND = 'https://agentes-de-whatsapp-production.up.railway.app';

const emptyForm = {
  nome: '', telefone: '', telefone2: '', email: '', entrada: hoje,
  origem: '', is_corretor: false,
  ativo: 'S', motivo_desistencia: '',
  captado: false, estoque_id: null, ficha: null,
  corretor: '', corretor_id: null,
  tratativa_divisao: [], tratativa_dono_edicao: null,
  captacao_divisao: [], captacao_dono_edicao: null,
  fotos_tratativa: [],
  imovel: '', tipo_id: '', em_condominio: false, modalidade: '',
  origem_tratativa: '',
  valor: '', detalhes: '', detalhes_externos: '', localizacao: '',
  proxima_acao: '', imoveis_visitados: '',
  ultimo_contato: '', prox_contato: '', final_contato: '', prorrogacao: '',
  solicitar_parceria: false,
  tratativa: false, pesquisa: false, agendamento: false, visita: false,
  proposta: false, contrato: false, financiamento: false, recebimento: false, recebido: false,
};

function isIntl(value) { return (value || '').trim().startsWith('+'); }

// Monta a string de exibição do tipo a partir dos campos dimensionais (tipo_id + em_condominio).
function tipoDisplay(tipos, tipoId, emCondominio) {
  const t = (tipos || []).find(x => x.id === tipoId);
  if (!t) return '';
  return (emCondominio && t.permite_condominio) ? `${t.nome} em Condomínio` : t.nome;
}

function validarTel(value, intl) {
  if (!value?.trim()) return false;
  if (intl) return value.trim().length >= 8;
  let d = value.replace(/\D/g, '');
  // tolera o código do país: "55" + DDD + número (12-13 dígitos) -> tira o 55
  if (d.length >= 12 && d.length <= 13 && d.startsWith('55')) d = d.slice(2);
  // Celular brasileiro: 11 dígitos (DDD + 9 + 8 dígitos), 3º dígito = 9
  return d.length === 11 && d[2] === '9';
}

function SelectComAdd({ label, value, onChange, options, setOptions, chave, required, errStyle, isGerente, perfil, bloqueado }) {
  const [adding, setAdding] = useState(false);
  const [novo, setNovo] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    const v = novo.trim();
    if (!v) return;
    if (options.includes(v)) { onChange(v); setAdding(false); setNovo(''); return; }
    setSaving(true);
    if (isGerente) {
      const lista = [...options, v].sort((a,b) => a.localeCompare(b,'pt-BR'));
      const { error } = await supabase.from('configuracoes').upsert({ chave, valor: lista }, { onConflict: 'chave' });
      if (!error) { setOptions(lista); onChange(v); }
      else alert('Erro: ' + error.message);
    } else {
      const { error } = await supabase.from('sugestoes_lista').insert({ chave, valor: v, sugerido_por: perfil?.id, sugerido_por_nome: perfil?.nome, status: 'pendente' });
      if (!error) alert('Sugestão enviada para aprovação do gerente!');
      else alert('Erro: ' + error.message);
    }
    setSaving(false); setAdding(false); setNovo('');
  }

  if (bloqueado) return (
    <div>
      <label className="form-label">{label}{required ? ' *' : ''}</label>
      <input value={value} readOnly style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
      <span style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, display: 'block' }}>Preenchido automaticamente como Carteira</span>
    </div>
  );

  return (
    <div>
      <label className="form-label">{label}{required ? ' *' : ''}</label>
      {adding ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input autoFocus value={novo} onChange={e => setNovo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNovo(''); }}}
            placeholder={isGerente ? 'Nova opção...' : 'Sugerir opção...'} style={{ flex: 1 }} />
          <button type="button" onClick={handleAdd} disabled={saving}
            style={{ padding: '8px 14px', borderRadius: 7, border: 'none', background: isGerente ? '#2563eb' : '#f59e0b', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? '...' : isGerente ? '✓' : '💡'}
          </button>
          <button type="button" onClick={() => { setAdding(false); setNovo(''); }}
            style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>✕</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={value} onChange={e => onChange(e.target.value)} style={{ flex: 1, ...(errStyle || {}) }}>
            <option value="">Selecionar</option>
            {value && !options.includes(value) && <option value={value}>{value}</option>}
            {options.map(o => <option key={o}>{o}</option>)}
          </select>
          <button type="button" onClick={() => setAdding(true)} title={isGerente ? 'Adicionar' : 'Sugerir'}
            style={{ padding: '8px 12px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: isGerente ? '#2563eb' : '#f59e0b', fontSize: 16, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}>+</button>
        </div>
      )}
    </div>
  );
}

export default function ClienteModal({ modal, onSave, onClose, perfil, onDelete }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [pedidoPendente, setPedidoPendente] = useState(null); // pedido de divisão aguardando gerência
  const [origens, setOrigens] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [valorDisplay, setValorDisplay] = useState('');
  const [internacional, setInternacional] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [cadastrandoCli, setCadastrandoCli] = useState(false);
  const [modoCadastroCli, setModoCadastroCli] = useState(false);
  const [editandoCliente, setEditandoCliente] = useState(false); // ✏️ Editar cliente dentro do modal
  const [dividindoAtend, setDividindoAtend] = useState(false);
  const telOriginalRef = useRef('');        // telefone como estava salvo (tolera legado fora do padrão)
  const origemTratLockRef = useRef(false);  // origem da tratativa veio preenchida (ex.: OLX) → só leitura
  const [imagensIA, setImagensIA] = useState([]); // prints colados no campo da IA
  const [countdownSalvar, setCountdownSalvar] = useState(null);
  const countdownRef = useRef(null);
  const [origemBloqueada, setOrigemBloqueada] = useState(false);
  const [duplicatas, setDuplicatas] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [motivoAberto, setMotivoAberto] = useState(false);
  const [organizandoIA, setOrganizandoIA] = useState(false);
  const [conversaComprador, setConversaComprador] = useState('');
  const [organizandoComprador, setOrganizandoComprador] = useState(false);
  // Texto que o corretor ACRESCENTA às observações internas (além do trecho protegido do bot).
  const [detalhesAdicional, setDetalhesAdicional] = useState('');
  const jaCaptadoRef = useRef(false);
  // Guarda o texto que JÁ estava nas Observações Internas ao abrir a tratativa (ex.: o que o
  // bot/SDR gravou na captação). Esse trecho é PROTEGIDO: o corretor pode acrescentar, mas nunca apagar.
  const detalhesBloqueadoRef = useRef('');
  const [transfAberto, setTransfAberto] = useState(false);
  const [transfDestino, setTransfDestino] = useState('');
  const [transfObs, setTransfObs] = useState('');
  const [transfMsg, setTransfMsg] = useState('');
  const [transfEnviando, setTransfEnviando] = useState(false);
  const timerNome = useRef(null);
  const timer = useRef(null);
  const fundoMouseDown = useRef(false); // true só quando o clique começa no fundo escuro (não em texto selecionado)

  // Buscar motivos já usados no banco
  useEffect(() => {
    supabase.from('negociacoes').select('motivo_desistencia').neq('motivo_desistencia', '').not('motivo_desistencia', 'is', null)
      .then(({ data }) => {
        const unicos = [...new Set((data || []).map(d => d.motivo_desistencia).filter(Boolean))].sort();
        setMotivos(unicos);
      });
  }, []);

  // Lista de corretores: junta os do CRM (Supabase perfis) com os do Estoque (Firebase, via backend),
  // sem duplicar pelo nome. O dropdown trabalha por NOME (que é o que rankings/filtros usam).
  const [corretores, setCorretores] = useState([]);
  const [listaExternos, setListaExternos] = useState([]);
  const [mostrarNovoExternoCap, setMostrarNovoExternoCap] = useState(false);
  const [novoExternoCap, setNovoExternoCap] = useState({ nome: '', cpf: '', telefone: '' });
  const [salvandoExternoCap, setSalvandoExternoCap] = useState(false);
  // Carrega captadores externos (tabela do Supabase) para a divisão de captação.
  useEffect(() => {
    let vivo = true;
    supabase.from('captadores_externos').select('id, nome, cpf, telefone, criado_por').order('nome')
      .then(({ data }) => { if (vivo) setListaExternos(data || []); });
    return () => { vivo = false; };
  }, []);
  useEffect(() => {
    let vivo = true;
    const normNome = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    (async () => {
      const mapa = new Map();
      try {
        // A tabela perfis usa campos booleanos de papel (is_corretor, is_gerente, is_diretor),
        // não um campo "role" de texto. Listamos todos que atendem cliente (corretor/gerente/diretor).
        const { data } = await supabase
          .from('perfis')
          .select('id, nome, telefone, email, is_corretor, is_gerente, is_diretor, gerente_id, aprovado')
          .or('is_corretor.eq.true,is_gerente.eq.true,is_diretor.eq.true')
          .order('nome');
        (data || []).forEach(p => {
          if (!p.nome) return;
          if (p.aprovado === false) return; // não lista perfil não aprovado
          mapa.set(normNome(p.nome), { nome: p.nome, telefone: p.telefone || '', email: p.email || '', supabaseId: p.id, firebaseId: null, gerente_id: p.gerente_id || null, is_gerente: !!p.is_gerente, is_diretor: !!p.is_diretor });
        });
      } catch (e) { /* segue só com o Estoque */ }
      try {
        const r = await fetch(BACKEND + '/corretores');
        const j = await r.json();
        ((j && j.corretores) || []).forEach(c => {
          if (!c.nome) return;
          const k = normNome(c.nome);
          const ex = mapa.get(k);
          if (ex) { ex.firebaseId = c.id; if (!ex.telefone) ex.telefone = c.telefone || ''; }
          else mapa.set(k, { nome: c.nome, telefone: c.telefone || '', supabaseId: null, firebaseId: c.id });
        });
      } catch (e) { /* segue só com os do CRM */ }
      if (vivo) setCorretores(Array.from(mapa.values()).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')));
    })();
    return () => { vivo = false; };
  }, []);

  const isEdit = modal && modal.negociacao_id;
  const isNovaNeg = modal && modal.novaNegociacao;
  const isGerente = perfil?.is_gerente;
  // Eixo 1 — é captação? (Venda ou Locador → capta, vai pro Estoque)
  const isCaptacao = ehCaptacao(form.modalidade);
  // Eixo 2 — é locação? (Locador ou Locatário; inclui o "Locação" legado)
  const isLocacao = ehLocacao(form.modalidade);

  // ─── DIVISÃO DE COMISSÃO DA TRATATIVA (100% interno, sem externo) ───
  // Mesmo sistema da captação de imóveis: cada corretor dono da própria fatia,
  // trava sistêmica (só o dono ou diretor/gerente altera), estrela de dono da edição.
  const meuId = perfil?.id || null;
  const ehAlcadaSuperior = !!(perfil?.is_diretor || perfil?.is_gerente);
  const divisao = form.tratativa_divisao || [];
  const donoEdicaoId = form.tratativa_dono_edicao || null;
  const podeEditarFatiaTrat = (item) => ehAlcadaSuperior || (!!meuId && item.id === meuId);
  const souDonoEdicaoTrat = !!meuId && meuId === donoEdicaoId;
  const podeTransferirEdicaoTrat = souDonoEdicaoTrat || ehAlcadaSuperior;
  // Quem pode SALVAR a edição: alçada superior, quem tem estrela (tratativa OU captação),
  // OU o corretor responsável desde que ninguém tenha estrela ainda (legado sem divisão).
  const donoTratativaSouEu = !!meuId && form.corretor_id === meuId;
  const temEstrelaCap = !!meuId && meuId === (form.captacao_dono_edicao || null);
  const podeSalvarTratativa = !isEdit || ehAlcadaSuperior || souDonoEdicaoTrat || temEstrelaCap || (donoTratativaSouEu && !donoEdicaoId);
  const donoEdicaoNome = ((divisao.find(d => d.id === donoEdicaoId) || {}).nome) || '';
  const somaPctTrat = divisao.reduce((s, c) => s + (Number(c.pct) || 0), 0);

  // ─── PARTE 4: aprovação por gerência ao ceder para OUTRA equipe ───
  // gerente_id do usuário logado (quem cede). Diretor não tem gerente e tem passe livre.
  const meuGerenteId = perfil?.gerente_id || null;
  const infoCorretor = (cid) => corretores.find(x => (x.supabaseId || x.id) === cid) || null;
  // Dois corretores são da MESMA equipe se têm o mesmo gerente_id (ou um é gerente do outro).
  const mesmaEquipeQueEu = (cid) => {
    const c = infoCorretor(cid);
    if (!c) return true; // sem info, não trava
    const gDele = c.gerente_id || null;
    // mesma equipe: mesmo gerente; ou o corretor é o próprio gerente do usuário; ou o usuário é gerente dele
    if (meuGerenteId && gDele && meuGerenteId === gDele) return true;
    if (meuGerenteId && cid === meuGerenteId) return true;
    if (gDele && gDele === meuId) return true;
    if (!meuGerenteId && !gDele) return true; // ambos sem gerente (ex.: direto do diretor)
    return false;
  };
  // Quem aprova quando o usuário cede para fora da equipe: o gerente do usuário; se não tem, o diretor.
  const aprovadorId = () => meuGerenteId || null; // null => tratado como "diretor aprova" na aba de aprovações

  // Cria um pedido de divisão pendente (cede para outra equipe). A divisão vigente não muda.
  const criarPedidoDivisao = async (corretorNovo, idNovo) => {
    const clienteId = form.cliente_real_id || modal?.cliente?.id || null;
    const propostaBase = (divisao.length > 0 ? divisao : (meuId ? [{ id: meuId, nome: perfil?.nome || '', pct: 100 }] : []));
    // proposta: metade para o novo (a partir da fatia de quem cede)
    const proposta = [...propostaBase];
    const idxCede = proposta.findIndex(d => d.id === meuId);
    if (idxCede >= 0) {
      const metade = Math.round((proposta[idxCede].pct || 0) / 2);
      proposta[idxCede] = { ...proposta[idxCede], pct: (proposta[idxCede].pct || 0) - metade };
      proposta.push({ id: idNovo, nome: corretorNovo.nome, pct: metade });
    } else {
      proposta.push({ id: idNovo, nome: corretorNovo.nome, pct: 0 });
    }
    try {
      const registro = {
        cliente_id: clienteId,
        solicitante_id: meuId,
        aprovador_id: aprovadorId(),
        divisao_atual: divisao,
        divisao_proposta: proposta,
        status: 'pendente',
      };
      const { data, error } = await supabase.from('tratativa_divisao_pedidos').insert(registro).select().single();
      if (error) { alert('Não consegui registrar o pedido de divisão: ' + error.message); return; }
      setPedidoPendente(data);
      alert('Pedido de divisão enviado para aprovação do gerente. A tratativa segue como está até ser aprovada.');
    } catch (e) {
      alert('Falha ao registrar o pedido de divisão.');
    }
  };

  // Carrega pedido de divisão pendente desta tratativa (se houver).
  useEffect(() => {
    const clienteId = form.cliente_real_id || modal?.cliente?.id || null;
    if (!clienteId) { setPedidoPendente(null); return; }
    let vivo = true;
    supabase.from('tratativa_divisao_pedidos')
      .select('*').eq('cliente_id', clienteId).eq('status', 'pendente')
      .order('criado_em', { ascending: false }).limit(1)
      .then(({ data }) => { if (vivo) setPedidoPendente(data && data[0] ? data[0] : null); });
    return () => { vivo = false; };
  }, [form.cliente_real_id, modal]);

  const addCorretorDivisao = (cid) => {
    const c = corretores.find(x => (x.supabaseId || x.id) === cid);
    if (!c) return;
    const idReal = c.supabaseId || c.id;
    if (divisao.some(d => d.id === idReal)) return;
    // Alçada superior aplica direto (sem aprovação).
    if (!ehAlcadaSuperior && !mesmaEquipeQueEu(idReal)) {
      // Cede para outra equipe → cria pedido pendente; a divisão vigente NÃO muda.
      criarPedidoDivisao(c, idReal);
      return;
    }
    setForm(f => {
      let base = [...(f.tratativa_divisao || [])];
      // Fichas antigas: divisão vazia → o responsável entra primeiro, senão a lista some (precisa de 2+).
      if (base.length === 0) {
        const respId = f.corretor_id || meuId || null;
        const respNome = f.corretor || (perfil && perfil.nome) || 'Responsável';
        if (respId && respId !== idReal) base.push({ id: respId, nome: respNome, pct: 0 });
      }
      const det = [...base, { id: idReal, nome: c.nome, pct: 0 }];
      const eq = Math.floor(100 / det.length);
      det.forEach((d, i) => { d.pct = (i === 0) ? (100 - eq * (det.length - 1)) : eq; });
      const dono = f.tratativa_dono_edicao && det.some(d => d.id === f.tratativa_dono_edicao)
        ? f.tratativa_dono_edicao : det[0].id;
      return { ...f, tratativa_divisao: det, tratativa_dono_edicao: dono };
    });
  };
  const removerCorretorDivisao = (idx, item) => {
    if (!podeEditarFatiaTrat(item)) return;
    setForm(f => {
      const det = (f.tratativa_divisao || []).filter((_, i) => i !== idx);
      if (det.length > 0) {
        const eq = Math.floor(100 / det.length);
        det.forEach((d, i) => { d.pct = (i === 0) ? (100 - eq * (det.length - 1)) : eq; });
      }
      const dono = det.some(d => d.id === f.tratativa_dono_edicao) ? f.tratativa_dono_edicao : (det[0]?.id || null);
      return { ...f, tratativa_divisao: det, tratativa_dono_edicao: dono };
    });
  };
  const setPctDivisao = (idx, val) => {
    setForm(f => {
      const det = [...(f.tratativa_divisao || [])];
      det[idx] = { ...det[idx], pct: Number(val) || 0 };
      return { ...f, tratativa_divisao: det };
    });
  };
  const definirDonoEdicaoTrat = (item) => {
    if (!podeTransferirEdicaoTrat) return;
    setForm(f => ({ ...f, tratativa_dono_edicao: item.id }));
  };

  // ─── DIVISÃO DE CAPTAÇÃO (só tratativas de VENDA) — mesmas regras do Estoque ───
  // Interno (corretor com login, por perfil.id) ou externo (parceiro sem login).
  // Fatia por dono + trava sistêmica + estrela de dono da edição + soma 100%.
  // Viaja para o Estoque quando o imóvel é captado.
  const capDiv = form.captacao_divisao || [];
  const capDonoEdicao = form.captacao_dono_edicao || null;
  const meuEmailCap = (perfil?.email || '').toLowerCase();
  const podeEditarFatiaCap = (item) => {
    if (ehAlcadaSuperior) return true;
    if (item.tipo === 'externo') return !!meuEmailCap && String(item.representante || '').toLowerCase() === meuEmailCap;
    if (!meuId) return false;
    return item.id === meuId;
  };
  const souDonoEdicaoCap = !!meuId && meuId === capDonoEdicao;
  const podeTransferirEdicaoCap = souDonoEdicaoCap || ehAlcadaSuperior;
  const somaPctCap = capDiv.reduce((s, c) => s + (Number(c.pct) || 0), 0);
  const recalcCap = (det) => {
    const eq = Math.floor(100 / det.length);
    det.forEach((d, i) => { d.pct = (i === 0) ? (100 - eq * (det.length - 1)) : eq; });
    return det;
  };
  const addCaptadorInterno = (cid) => {
    const c = corretores.find(x => (x.supabaseId || x.id) === cid);
    if (!c) return;
    const idReal = c.supabaseId || c.id;
    if (capDiv.some(d => d.tipo === 'interno' && d.id === idReal)) return;
    setForm(f => {
      let base = [...(f.captacao_divisao || [])];
      if (base.length === 0) {
        const respId = f.corretor_id || meuId || null;
        const respNome = f.corretor || (perfil && perfil.nome) || 'Responsável';
        if (respId && respId !== idReal) base.push({ tipo: 'interno', id: respId, nome: respNome, pct: 0 });
      }
      const det = recalcCap([...base, { tipo: 'interno', id: idReal, nome: c.nome, pct: 0 }]);
      const internos = det.filter(d => d.tipo === 'interno');
      const donoOk = internos.some(d => d.id === f.captacao_dono_edicao);
      return { ...f, captacao_divisao: det, captacao_dono_edicao: donoOk ? f.captacao_dono_edicao : (internos[0]?.id || null) };
    });
  };
  const addCaptadorExterno = (extId) => {
    const ext = listaExternos.find(x => x.id === extId);
    if (!ext) return;
    if (capDiv.some(d => d.tipo === 'externo' && d.externo_id === extId)) return;
    setForm(f => {
      const det = recalcCap([...(f.captacao_divisao || []), { tipo: 'externo', externo_id: extId, nome: ext.nome, telefone: ext.telefone || '', representante: (perfil?.email || '').toLowerCase() || null, pct: 0 }]);
      return { ...f, captacao_divisao: det };
    });
  };
  const removerCaptador = (idx, item) => {
    if (!podeEditarFatiaCap(item)) return;
    setForm(f => {
      const det = (f.captacao_divisao || []).filter((_, i) => i !== idx);
      if (det.length > 0) recalcCap(det);
      const internos = det.filter(d => d.tipo === 'interno');
      const donoOk = internos.some(d => d.id === f.captacao_dono_edicao);
      return { ...f, captacao_divisao: det, captacao_dono_edicao: donoOk ? f.captacao_dono_edicao : (internos[0]?.id || null) };
    });
  };
  const setPctCap = (idx, val) => {
    setForm(f => {
      const det = [...(f.captacao_divisao || [])];
      det[idx] = { ...det[idx], pct: Number(val) || 0 };
      return { ...f, captacao_divisao: det };
    });
  };
  const definirDonoEdicaoCap = (item) => {
    if (!podeTransferirEdicaoCap) return;
    if (item.tipo !== 'interno') return;
    setForm(f => ({ ...f, captacao_dono_edicao: item.id }));
  };
  const salvarNovoExternoCap = async () => {
    const nome = (novoExternoCap.nome || '').trim();
    if (!nome) { alert('Informe o nome do captador externo.'); return; }
    setSalvandoExternoCap(true);
    try {
      const registro = { nome, cpf: (novoExternoCap.cpf || '').trim() || null, telefone: (novoExternoCap.telefone || '').trim() || null, criado_por: perfil?.email || perfil?.nome || null };
      const { data, error } = await supabase.from('captadores_externos').insert(registro).select().single();
      if (error || !data) { alert('Erro ao salvar externo: ' + (error?.message || '')); setSalvandoExternoCap(false); return; }
      setListaExternos(p => [...p, data].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')));
      setForm(f => {
        const det = recalcCap([...(f.captacao_divisao || []), { tipo: 'externo', externo_id: data.id, nome: data.nome, telefone: data.telefone || '', representante: (perfil?.email || '').toLowerCase() || null, pct: 0 }]);
        return { ...f, captacao_divisao: det };
      });
      setNovoExternoCap({ nome: '', cpf: '', telefone: '' });
      setMostrarNovoExternoCap(false);
    } catch { alert('Falha ao salvar externo.'); }
    setSalvandoExternoCap(false);
  };

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') { localStorage.removeItem('crm_rascunho'); onClose(); }
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    supabase.from('configuracoes').select('chave, valor').then(({ data }) => {
      if (data) data.forEach(row => {
        if (row.chave === 'origens') setOrigens(row.valor);
        if (row.chave === 'imoveis') {
          // Cadastro central no formato { tipos: [{id, nome, permite_condominio, ...}] }
          const v = row.valor;
          const lista = Array.isArray(v?.tipos) ? v.tipos
            : (Array.isArray(v) ? v.map(n => ({ id: String(n), nome: String(n), permite_condominio: false })) : []);
          setTipos(lista);
        }
      });
    });
  }, []);

  useEffect(() => {
    setClienteEncontrado(null);
    setOrigemBloqueada(false);
    setEditandoCliente(false);
    if (isEdit) {
      setForm({ ...emptyForm, ...modal, modalidade: normModalidade(modal.modalidade) });
      // Busca a versão FRESCA das divisões e fotos direto no banco (evita regravar estado velho)
      // e semeia o responsável na divisão quando ela veio vazia, para a lista sempre existir.
      supabase.from('negociacoes')
        .select('tratativa_divisao, tratativa_dono_edicao, captacao_divisao, captacao_dono_edicao, fotos_tratativa')
        .eq('id', modal.negociacao_id).single()
        .then(({ data: fresca }) => {
          if (!fresca) return;
          setForm(f => {
            let td = Array.isArray(fresca.tratativa_divisao) ? fresca.tratativa_divisao : [];
            let te = fresca.tratativa_dono_edicao || null;
            let cd = Array.isArray(fresca.captacao_divisao) ? fresca.captacao_divisao : [];
            let ce = fresca.captacao_dono_edicao || null;
            const respId = f.corretor_id || null;
            const respNome = f.corretor || 'Responsável';
            if (td.length === 0 && respId) { td = [{ id: respId, nome: respNome, pct: 100 }]; te = te || respId; }
            if (cd.length === 0 && respId) { cd = [{ tipo: 'interno', id: respId, nome: respNome, pct: 100 }]; ce = ce || respId; }
            return {
              ...f,
              tratativa_divisao: td, tratativa_dono_edicao: te,
              captacao_divisao: cd, captacao_dono_edicao: ce,
              fotos_tratativa: Array.isArray(fresca.fotos_tratativa) ? fresca.fotos_tratativa : (f.fotos_tratativa || []),
            };
          });
        });
      jaCaptadoRef.current = !!modal.captado;
      telOriginalRef.current = modal.telefone || '';
      origemTratLockRef.current = !!(modal.origem_tratativa && String(modal.origem_tratativa).trim());
      // Busca silenciosa: só descobre se o cliente existe na tabela (sem mexer no form).
      // Se não existe, os campos abrem editáveis na edição (tratativa legada sem cadastro).
      (async () => {
        try {
          const digits = String(modal.telefone || '').replace(/\D/g, '');
          if (digits.length >= 8) {
            const suf = digits.slice(-8);
            const { data: cs } = await supabase.from('clientes').select('*').or(`telefone.ilike.%${suf}%,telefone.eq.${digits}`).limit(1);
            setClienteEncontrado(cs && cs.length ? cs[0] : null);
          } else setClienteEncontrado(null);
        } catch (e) { /* silencioso */ }
      })();
      // o que já estava nas observações internas vira o trecho PROTEGIDO (não pode ser apagado)
      detalhesBloqueadoRef.current = (modal.detalhes || '').trim();
      setDetalhesAdicional('');
      setValorDisplay(modal.valor !== '' && modal.valor !== null && modal.valor !== undefined
        ? Number(modal.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '');
      setInternacional(isIntl(modal.telefone || ''));
      localStorage.removeItem('crm_rascunho');
    } else if (isNovaNeg) {
      const c = modal.cliente;
      const initial = { ...emptyForm, nome: c.nome, telefone: c.telefone, email: c.email, entrada: c.entrada, origem: (c.origem || 'Carteira'), origem_tratativa: 'Carteira', is_corretor: c.is_corretor || false, cliente_real_id: c.id };
      if (perfil) {
      initial.corretor = perfil.nome; initial.corretor_id = perfil.id;
      // Tratativa nasce 100% de quem registra; ele já é o dono da edição.
      if (perfil.id) {
        initial.tratativa_divisao = [{ id: perfil.id, nome: perfil.nome, pct: 100 }];
        initial.tratativa_dono_edicao = perfil.id;
        // Divisão de CAPTAÇÃO também nasce 100% do corretor (usada só em tratativas de venda).
        initial.captacao_divisao = [{ tipo: 'interno', id: perfil.id, nome: perfil.nome, pct: 100 }];
        initial.captacao_dono_edicao = perfil.id;
      }
    }
      setForm(initial);
      setOrigemBloqueada(true);
      setInternacional(isIntl(c.telefone || ''));
      setValorDisplay('');
    } else {
      const rascunho = localStorage.getItem('crm_rascunho');
      if (rascunho) {
        try {
          const r = JSON.parse(rascunho);
          setForm(r);
          setValorDisplay(r.valor !== '' && r.valor !== null ? Number(r.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '');
          setInternacional(isIntl(r.telefone || ''));
        } catch { resetForm(); }
      } else { resetForm(); }
    }
  }, [modal]);

  function resetForm() {
    const initial = { ...emptyForm };
    if (perfil) {
      initial.corretor = perfil.nome; initial.corretor_id = perfil.id;
      // Tratativa nasce 100% de quem registra; ele já é o dono da edição.
      if (perfil.id) {
        initial.tratativa_divisao = [{ id: perfil.id, nome: perfil.nome, pct: 100 }];
        initial.tratativa_dono_edicao = perfil.id;
        // Divisão de CAPTAÇÃO também nasce 100% do corretor (usada só em tratativas de venda).
        initial.captacao_divisao = [{ tipo: 'interno', id: perfil.id, nome: perfil.nome, pct: 100 }];
        initial.captacao_dono_edicao = perfil.id;
      }
    }
    setForm(initial);
    setValorDisplay('');
    setInternacional(false);
  }

  // Normaliza telefone igual ao App.js (só dígitos; tira o 55 do começo se vier 12-13 dígitos)
  function so11Modal(x) {
    let d = String(x == null ? '' : x).replace(/\D/g, '');
    if (d.length >= 12 && d.length <= 13 && d.slice(0, 2) === '55') d = d.slice(2);
    return d || '';
  }

  // Cadastra o cliente NOVO no banco na hora, sem fechar o modal. Depois disso, salvar a
  // tratativa só cria a negociação (não duplica o cliente, pois cliente_real_id já fica setado).
  async function cadastrarClienteNovo() {
    if (!validarTel(form.telefone, internacional)) { setErrors(e => ({ ...e, telefone: true })); alert('Informe um telefone válido antes de cadastrar o cliente.'); return; }
    if (!form.nome.trim()) { setErrors(e => ({ ...e, nome: true })); alert('Informe o nome do cliente.'); return; }
    setCadastrandoCli(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        telefone: internacional ? (form.telefone || '').trim() : so11Modal(form.telefone),
        telefone2: form.telefone2 ? so11Modal(form.telefone2) : null,
        email: form.email || null,
        entrada: form.entrada || hoje,
        origem: form.origem || null,
        is_corretor: form.is_corretor || false,
        // herda o dono para o RLS saber de quem é o cliente (igual ao App.js)
        corretor_id: form.corretor_id || perfil?.id || null,
      };
      const { data, error } = await supabase.from('clientes').insert(payload).select().single();
      if (error) { alert('Não consegui cadastrar o cliente:\n' + error.message); setCadastrandoCli(false); return; }
      setForm(f => ({ ...f, cliente_real_id: data.id }));
      setClienteEncontrado(data);
      setModoCadastroCli(false);
    } catch (e) { alert('Falha ao cadastrar o cliente:\n' + (e.message || e)); }
    setCadastrandoCli(false);
  }

  // Busca por telefone — debounce 700ms, usa últimos 8 dígitos
  async function buscarPorTelefone(tel) {
    const digits = tel.replace(/\D/g, '');
    if (digits.length < 8) { setClienteEncontrado(null); setOrigemBloqueada(false); return; }
    setBuscando(true);
    try {
      const sufixo = digits.slice(-8);
      // Busca tanto formatado quanto só números
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .or(`telefone.ilike.%${sufixo}%,telefone.eq.${digits}`)
        .limit(1);
      if (data && data.length > 0) {
        const c = data[0];
        setClienteEncontrado(c);
        setModoCadastroCli(false);
        const { data: negs } = await supabase.from('negociacoes').select('id').eq('cliente_id', c.id).limit(1);
        const temTratativas = negs && negs.length > 0;
        setForm(f => ({
          ...f,
          nome: c.nome,
          telefone2: c.telefone2 || f.telefone2,
          email: c.email || f.email,
          entrada: c.entrada || f.entrada,
          // Aquisição (origem do CLIENTE) é imutável: sempre preserva a original (ex.: OLX), nunca vira Carteira.
          origem: (c.origem || f.origem),
          // Origem da TRATATIVA: cliente reincidente → Carteira (padrão, editável); 1ª tratativa → herda a aquisição.
          origem_tratativa: temTratativas ? 'Carteira' : (c.origem || f.origem_tratativa),
          is_corretor: c.is_corretor || false,
          cliente_real_id: c.id,
        }));
        setOrigemBloqueada(temTratativas);
      } else {
        setClienteEncontrado(null);
        setOrigemBloqueada(false);
      }
    } catch (e) { console.error(e); }
    setBuscando(false);
  }

  function handleTelChange(e) {
    // Só dígitos (ou + para internacional)
    let val = internacional
      ? e.target.value.replace(/[^\d+]/g, '')
      : e.target.value.replace(/\D/g, '').slice(0, 11);
    set('telefone', val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => buscarPorTelefone(val), 700);
  }

  async function buscarDuplicatas(nome) {
    if (!nome || nome.trim().length < 3) { setDuplicatas([]); return; }
    const primeiros = nome.trim().split(' ').slice(0,2).join(' ');
    const { data } = await supabase.from('clientes').select('id, nome, telefone').ilike('nome', `%${primeiros}%`).limit(5);
    setDuplicatas((data || []).filter(c => c.id !== form.cliente_real_id));
  }

  function handleNomeChange(e) {
    set('nome', e.target.value);
    if (timerNome.current) clearTimeout(timerNome.current);
    timerNome.current = setTimeout(() => buscarDuplicatas(e.target.value), 600);
  }

  function set(key, val) {
    setForm(f => {
      const u = { ...f, [key]: val };
      if (!isEdit) localStorage.setItem('crm_rascunho', JSON.stringify(u));
      return u;
    });
    if (errors[key]) setErrors(e => ({ ...e, [key]: false }));
  }

  // Status (Ativo/Inativo) — inativar desmarca o Captado (não faz sentido junto)
  function setStatus(v) {
    setForm(f => {
      const u = { ...f, ativo: v, captado: v === 'N' ? false : f.captado };
      if (!isEdit) localStorage.setItem('crm_rascunho', JSON.stringify(u));
      return u;
    });
  }

  // Imóvel captado (só Venda) — captar ENCERRA a tratativa: o imóvel foi
  // conseguido e vai pra venda nos portais, não se faz mais nada com a tratativa.
  // Por isso vira inativo (ativo='N') marcado como sucesso (captado=true).
  // Aparece só no relatório de Captados, não na lista de Inativos.
  function toggleCaptado() {
    setForm(f => {
      const novo = !f.captado;
      // Captação é sempre uma tratativa EM ABERTO: tanto "Em captação" quanto "Captado"
      // mantêm ativo:'S'. O eixo Ativo/Inativo é só da PROCURA — se deixasse ativo:'N',
      // a tratativa escorregava pra aba Finalizadas indevidamente.
      const u = { ...f, captado: novo, ativo: 'S' };
      if (!isEdit) localStorage.setItem('crm_rascunho', JSON.stringify(u));
      return u;
    });
  }

  function handleValorChange(e) {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw === '') { setValorDisplay(''); set('valor', ''); return; }
    const n = parseInt(raw, 10) / 100;
    setValorDisplay(n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    set('valor', n);
  }

  function validate() {
    const errs = {};
    if (!form.nome.trim()) errs.nome = true;
    if (!validarTel(form.telefone, internacional)) {
      // Legado: na edição, se o telefone já estava salvo assim e não foi mexido, não trava o salvamento.
      const legadoOk = isEdit && telOriginalRef.current && form.telefone === telOriginalRef.current;
      if (!legadoOk) errs.telefone = true;
    }
    if (!form.modalidade) errs.modalidade = true;
    // Etapa inicial: lead recém-chegado (ex.: vindo do SDR / Canal Pro / Chaves na Mão) que ainda
    // está só em "Tratativa" e não avançou no funil. Nesse momento o corretor ainda nem conversou
    // com o lead, então não faz sentido exigir tipo de imóvel, localização e valor — esses campos
    // só passam a ser obrigatórios quando a tratativa avança para Pesquisa ou além.
    const etapasMarcadas = ETAPAS_FUNIL_COMPLETO.filter(e => form[e]);
    const soNaTratativa = etapasMarcadas.length === 0 || (etapasMarcadas.length === 1 && form.tratativa);
    if (!isCaptacao) {
      if (!soNaTratativa && !form.tipo_id) errs.tipo_id = true;
      if (!ETAPAS_FUNIL_COMPLETO.some(e => form[e])) errs.funil = true;
    }
    if (!soNaTratativa && !form.localizacao.trim()) errs.localizacao = true;
    if (!soNaTratativa && (form.valor === '' || form.valor === null || form.valor === undefined)) errs.valor = true;
    return errs;
  }

  // ─── Galeria "Fotos da tratativa" — upload por Ctrl+V ou botão, guarda no
  // Supabase Storage (bucket 'observacoes') e persiste as URLs em fotos_tratativa. ───
  const [subindoFoto, setSubindoFoto] = useState(false);
  const inputFotoRef = useRef(null);
  const fotos = Array.isArray(form.fotos_tratativa) ? form.fotos_tratativa : [];
  async function subirArquivosFoto(files) {
    if (!podeSalvarTratativa) { alert('Somente visualização: não é possível adicionar fotos.'); return; }
    setSubindoFoto(true);
    const novas = [];
    for (const f of files) {
      if (!f || !f.type || f.type.indexOf('image/') !== 0) continue;
      if (f.size > 8 * 1024 * 1024) { alert('Foto muito grande: ' + f.name + ' (máximo 8 MB).'); continue; }
      const ext = ((f.type || 'image/png').split('/')[1] || 'png').replace('jpeg', 'jpg');
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('observacoes').upload(path, f, { contentType: f.type || 'image/png' });
      if (error) { alert('Não consegui subir a foto: ' + error.message); continue; }
      const { data } = supabase.storage.from('observacoes').getPublicUrl(path);
      if (data && data.publicUrl) novas.push(data.publicUrl);
    }
    if (novas.length) setForm(f => ({ ...f, fotos_tratativa: [...(f.fotos_tratativa || []), ...novas] }));
    setSubindoFoto(false);
  }
  function handlePasteFotos(e) {
    const items = (e.clipboardData && e.clipboardData.items) || [];
    const files = [];
    for (const it of items) { if (it.type && it.type.indexOf('image/') === 0) { const f = it.getAsFile(); if (f) files.push(f); } }
    if (!files.length) return;
    e.preventDefault();
    subirArquivosFoto(files);
  }
  function removerFoto(url) {
    if (!podeSalvarTratativa) return;
    setForm(f => ({ ...f, fotos_tratativa: (f.fotos_tratativa || []).filter(u => u !== url) }));
  }
  const GaleriaFotos = () => (
    <div style={{ marginTop: 8 }}
      onDragOver={e => { e.preventDefault(); }}
      onDrop={e => { e.preventDefault(); if (e.dataTransfer.files && e.dataTransfer.files.length) subirArquivosFoto(Array.from(e.dataTransfer.files)); }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: 10, background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 8 }}>
        {fotos.map((u, i) => (
          <div key={u + i} style={{ position: 'relative' }}>
            <a href={u} target="_blank" rel="noreferrer">
              <img src={u} alt={'foto ' + (i + 1)} style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb', display: 'block' }} />
            </a>
            {podeSalvarTratativa && (
              <button type="button" onClick={() => removerFoto(u)} title="Remover foto"
                style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, lineHeight: 1, cursor: 'pointer' }}>×</button>
            )}
          </div>
        ))}
        {podeSalvarTratativa && (
          <button type="button" onClick={() => inputFotoRef.current && inputFotoRef.current.click()} disabled={subindoFoto}
            style={{ width: 84, height: 84, borderRadius: 8, border: '1px dashed #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12, cursor: subindoFoto ? 'wait' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>＋</span>
            {subindoFoto ? 'Enviando…' : 'Adicionar'}
          </button>
        )}
        {!fotos.length && !subindoFoto && (
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Nenhuma foto. Cole um print (Ctrl+V) no campo acima, arraste arquivos ou clique em Adicionar.</div>
        )}
        <input ref={inputFotoRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={e => { if (e.target.files && e.target.files.length) subirArquivosFoto(Array.from(e.target.files)); e.target.value = ''; }} />
      </div>
    </div>
  );

  function handlePasteIA(e) {
    const items = (e.clipboardData && e.clipboardData.items) || [];
    const files = [];
    for (const it of items) { if (it.type && it.type.indexOf('image/') === 0) { const f = it.getAsFile(); if (f) files.push(f); } }
    if (!files.length) return; // texto normal segue o fluxo padrão
    e.preventDefault();
    files.forEach(file => {
      const r = new FileReader();
      r.onload = () => {
        const res = String(r.result || '');
        const m = res.match(/^data:(.+);base64,(.*)$/);
        if (m) setImagensIA(prev => prev.length >= 4 ? prev : [...prev, { media_type: m[1], data: m[2], preview: res }]);
      };
      r.readAsDataURL(file);
    });
  }

  async function organizarIA() {
    const desc = ((conversaComprador || '') || (form.ficha && form.ficha._descricao) || '').trim();
    if (!desc.trim() && imagensIA.length === 0) { alert('Cole a conversa/anúncio (texto ou print) no campo antes de organizar com a IA.'); return; }
    setOrganizandoIA(true);
    try {
      const r = await fetch(BACKEND + '/captacao/organizar-ficha', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: desc, ficha: form.ficha || {}, imagens: imagensIA.map(i => ({ media_type: i.media_type, data: i.data })) })
      });
      const j = await r.json();
      if (j.ok && j.ficha) {
        const fi = Object.assign({}, j.ficha, { _descricao: desc });
        const norm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const tEnc = tipos.find(t => norm(t.nome) === norm(fi.tipo))
          || (norm(fi.tipo) ? tipos.find(t => norm(t.nome).startsWith(norm(fi.tipo)) || norm(fi.tipo).startsWith(norm(t.nome))) : null);
        const precoNum = Number(String(fi.preco == null ? '' : fi.preco).replace(/[^\d]/g, ''));
        const loc = [fi.bairro, fi.cidade, fi.estado].filter(Boolean).join(', ');
        setForm(f => Object.assign({}, f, {
          ficha: fi,
          valor: precoNum > 0 ? precoNum : f.valor,
          tipo_id: tEnc ? tEnc.id : f.tipo_id,
          localizacao: loc || f.localizacao
        }));
        if (precoNum > 0) setValorDisplay(precoNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
        setImagensIA([]);
        alert('✓ Campos preenchidos pela IA. Confira Tipo, Valor e Localização e ajuste o que precisar.');
      } else alert('Não consegui organizar: ' + (j.error || 'erro'));
    } catch (e) { alert('Erro ao chamar a IA: ' + e.message); }
    finally { setOrganizandoIA(false); }
  }

  // IA do COMPRADOR: lê a conversa colada do WhatsApp e preenche os campos da tratativa
  // (modalidade, tipo, valor/orçamento, localização desejada, quartos e observações).
  async function organizarConversaComprador() {
    const txt = (conversaComprador || '').trim();
    if (!txt && imagensIA.length === 0) { alert('Cole a conversa do WhatsApp (texto ou print) antes de organizar com a IA.'); return; }
    setOrganizandoComprador(true);
    try {
      const r = await fetch(BACKEND + '/crm/organizar-conversa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversa: txt, tipos: tipos || [], imagens: imagensIA.map(i => ({ media_type: i.media_type, data: i.data })) })
      });
      const j = await r.json();
      if (j.ok && j.dados) {
        const d = j.dados;
        const norm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const tEnc = d.tipo ? (tipos.find(t => norm(t.nome) === norm(d.tipo))
          || tipos.find(t => norm(t.nome).startsWith(norm(d.tipo)) || norm(d.tipo).startsWith(norm(t.nome)))) : null;
        const valorNum = Number(String(d.valor == null ? '' : d.valor).replace(/[^\d]/g, ''));
        // A conversa é de um comprador/locatário (lado da PROCURA): só aceitamos Compra ou Locatário.
        const mNorm = normModalidade(d.modalidade);
        const modValida = (mNorm === 'Compra' || mNorm === 'Locatário') ? mNorm : '';
        // Nome: a IA preenche se estiver vazio OU se o atual for claramente um placeholder
        // ("Lead 6299...", "Proprietário 12"). Se o atual já parece um nome real e a IA sugere
        // OUTRO diferente, pergunta antes de trocar (evita sobrescrever por engano).
        const nomeIA = (d.nome && String(d.nome).trim()) ? String(d.nome).trim() : '';
        const nomeAtual = (form.nome || '').trim();
        const ehPlaceholder = !nomeAtual || /^(lead|propriet[áa]rio|cliente|contato)\s*\d*$/i.test(nomeAtual);
        let nomeFinal = nomeAtual;
        if (nomeIA) {
          if (ehPlaceholder) {
            nomeFinal = nomeIA;
          } else if (norm(nomeIA) !== norm(nomeAtual)) {
            if (window.confirm('A IA identificou o nome "' + nomeIA + '", diferente do atual "' + nomeAtual + '".\n\nSubstituir pelo nome identificado na conversa?')) {
              nomeFinal = nomeIA;
            }
          }
        }
        setForm(f => Object.assign({}, f, {
          nome: nomeFinal,
          email: (d.email && String(d.email).trim() && !(f.email || '').trim()) ? String(d.email).trim() : f.email,
          telefone2: (d.telefone2 && String(d.telefone2).trim() && !(f.telefone2 || '').trim()) ? String(d.telefone2).trim() : f.telefone2,
          modalidade: modValida || f.modalidade,
          tipo_id: tEnc ? tEnc.id : f.tipo_id,
          em_condominio: typeof d.em_condominio === 'boolean' ? d.em_condominio : f.em_condominio,
          valor: valorNum > 0 ? valorNum : f.valor,
          localizacao: (d.localizacao && String(d.localizacao).trim()) ? d.localizacao : f.localizacao,
          proxima_acao: (d.proxima_acao && String(d.proxima_acao).trim() && !(f.proxima_acao || '').trim()) ? String(d.proxima_acao).trim() : f.proxima_acao,
        }));
        // a IA acrescenta nas observações ADICIONAIS (nunca toca no trecho protegido do bot)
        if (d.detalhes && String(d.detalhes).trim()) {
          setDetalhesAdicional(prev => prev ? (prev + '\n' + d.detalhes) : d.detalhes);
        }
        if (valorNum > 0) setValorDisplay(valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
        const quartosTxt = (d.quartos && String(d.quartos).trim()) ? ('\nQuartos desejados: ' + d.quartos) : '';
        setImagensIA([]);
        alert('✓ Campos preenchidos pela IA a partir da conversa. Confira e ajuste o que precisar.' + quartosTxt);
      } else alert('Não consegui organizar: ' + (j.error || 'erro'));
    } catch (e) { alert('Erro ao chamar a IA: ' + e.message); }
    finally { setOrganizandoComprador(false); }
  }

  // Devolve o lead para a Captação (OLX) como "fora do perfil" e remove a tratativa.
  // Usado quando o lead virou tratativa por engano (era pra ter ficado sem perfil).
  async function devolverParaCaptacao() {
    if (!window.confirm('Devolver este lead para a Captação como "fora do perfil" e remover esta tratativa?')) return;
    setSaving(true);
    try {
      const tail = String(form.telefone || '').replace(/\D/g, '').slice(-8);
      if (tail.length >= 8) {
        const { data } = await supabase.from('leads_captacao').select('id').ilike('telefone', '%' + tail + '%');
        const ids = (data || []).map(r => r.id);
        if (ids.length) {
          await supabase.from('leads_captacao').update({ campanha_status: 'descartado', virou_cliente: false }).in('id', ids);
        }
      }
      localStorage.removeItem('crm_rascunho');
      if (onDelete && modal && modal.id) await onDelete(modal.id);
      onClose();
    } catch (e) {
      alert('Erro ao devolver: ' + (e.message || e));
      setSaving(false);
    }
  }

  async function solicitarTransferencia() {
    setTransfMsg('');
    if (!transfDestino) { setTransfMsg('Escolha o corretor de destino.'); return; }
    if (!modal || !modal.negociacao_id) { setTransfMsg('Salve a tratativa antes de transferir.'); return; }
    setTransfEnviando(true);
    try {
      const cliente_id = modal.cliente_real_id || modal.cliente?.id || form.cliente_real_id || null;
      const { error } = await supabase.from('transferencias').insert({
        cliente_id,
        negociacao_id: modal.negociacao_id,
        de_corretor_id: form.corretor_id || perfil.id,
        para_corretor_id: transfDestino,
        status: 'pendente_origem',
        observacao: transfObs || null,
      });
      if (error) { setTransfMsg('Erro: ' + error.message); setTransfEnviando(false); return; }
      setTransfMsg('✅ Solicitação enviada! Aguarda aprovação do gerente de origem e do destino.');
      setTransfEnviando(false);
      setTransfDestino(''); setTransfObs('');
      setTimeout(() => { setTransfAberto(false); setTransfMsg(''); }, 2500);
    } catch (e) {
      setTransfMsg('Erro: ' + (e.message || e));
      setTransfEnviando(false);
    }
  }

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); alert('Preencha todos os campos obrigatórios.'); return; }
    // Trava da divisão de comissão: se há divisão definida, precisa fechar 100%.
    if ((form.tratativa_divisao || []).length > 0) {
      const soma = (form.tratativa_divisao || []).reduce((s, c) => s + (Number(c.pct) || 0), 0);
      if (soma !== 100) { alert(`A divisão de comissão da tratativa precisa somar 100%. Atualmente soma ${soma}%.`); return; }
    }
    // Trava da divisão de CAPTAÇÃO (só venda): também precisa fechar 100%.
    if (isCaptacao && (form.captacao_divisao || []).length > 0) {
      const somaCap = (form.captacao_divisao || []).reduce((s, c) => s + (Number(c.pct) || 0), 0);
      if (somaCap !== 100) { alert(`A divisão de captação precisa somar 100%. Atualmente soma ${somaCap}%.`); return; }
    }
    setSaving(true);

    // Bloqueio de duplicata: só para cliente NOVO (sem vínculo). Se o telefone já existe
    // em outro cliente, não deixa criar um cadastro repetido.
    const idVinculado = form.cliente_real_id || clienteEncontrado?.id || null;
    if (!isEdit && !idVinculado) {
      const digits = (form.telefone || '').replace(/\D/g, '');
      if (digits.length >= 8) {
        const sufixo = digits.slice(-8);
        const { data: jaExiste } = await supabase
          .from('clientes')
          .select('id, nome, telefone')
          .or(`telefone.ilike.%${sufixo}%,telefone.eq.${digits}`)
          .limit(1);
        if (jaExiste && jaExiste.length > 0) {
          const c = jaExiste[0];
          setSaving(false);
          setErrors(e => ({ ...e, telefone: true }));
          alert(`Já existe um cliente com este telefone: ${c.nome}.\n\nPara registrar uma nova tratativa para ele, feche e digite o telefone novamente — o sistema vai localizá-lo e vincular automaticamente.`);
          return;
        }
      }
    }

    // Cria o imóvel no Estoque quando a tratativa está Captada e ainda NÃO foi enviada.
    // Controle pela coluna estoque_id (não mais pelo "já estava captado") — assim
    // tratativas presas (captado=true mas nunca criadas) são reenviadas, e as que já
    // têm imóvel não duplicam.
    const captarAgora = form.captado && !form.estoque_id;
    if (captarAgora) {
      try {
        const fbase = form.ficha || {};
        // o corretor da tratativa vira o CAPTADOR no Estoque (casado pelo NOME)
        const _nc = x => String(x || '').toLowerCase().trim();
        const corretorObj = corretores.find(c => _nc(c.nome) === _nc(form.corretor));
        const capNome = form.corretor || (perfil && perfil.nome) || '';
        const capTel = (corretorObj && corretorObj.telefone)
          || (perfil && _nc(form.corretor) === _nc(perfil.nome) ? perfil.telefone : '') || '';
        // campos editados no modal do CRM têm prioridade e sobrescrevem a ficha
        const tipoNome = (tipos.find(x => String(x.id) === String(form.tipo_id)) || {}).nome || '';
        const partesLoc = String(form.localizacao || '').split(',').map(x => x.trim()).filter(Boolean);
        const locBairro = partesLoc[0] || '';
        const locCidade = partesLoc[1] || '';
        const locEstado = (partesLoc[2] && partesLoc[2].length <= 3) ? partesLoc[2].toUpperCase() : (partesLoc[2] || '');
        const nomePlaceholder = /^propriet[áa]rio\s*\d+$/i.test(String(form.nome || '').trim());
        const fichaEnvio = Object.assign({}, fbase, {
          // Estoque: venda usa 'preco'; LOCAÇÃO usa 'valorAluguel'. Mandar no campo certo.
          preco: isLocacao ? (fbase.preco || '') : ((form.valor !== '' && form.valor != null) ? form.valor : fbase.preco),
          valorAluguel: isLocacao ? ((form.valor !== '' && form.valor != null) ? form.valor : (fbase.valorAluguel || '')) : (fbase.valorAluguel || ''),
          tipo: tipoNome || fbase.tipo,
          transacao: isLocacao ? 'Locação' : 'Venda',
          condominio: !!form.em_condominio || !!fbase.condominio,
          bairro: fbase.bairro || locBairro,
          cidade: fbase.cidade || locCidade,
          estado: fbase.estado || locEstado,
          agio: !!fbase._agio,
          nomeProprietario: nomePlaceholder ? (fbase.nomeProprietario || form.nome) : (form.nome || fbase.nomeProprietario),
          telefoneProprietario: form.telefone || fbase.telefoneProprietario,
          nomeCaptador: fbase.nomeCaptador || capNome,
          telefoneCaptador: fbase.telefoneCaptador || capTel,
          // Divisão de captação definida no CRM viaja para o Estoque (herda no cadastro).
          captadores_detalhes: Array.isArray(form.captacao_divisao) ? form.captacao_divisao : [],
          captadores_ids: (Array.isArray(form.captacao_divisao) ? form.captacao_divisao : []).filter(d => d.tipo === 'interno').map(d => d.id),
          captadorEmail: (() => {
            const dono = (form.captacao_divisao || []).find(d => d.tipo === 'interno' && d.id === form.captacao_dono_edicao);
            const donoObj = dono && corretores.find(c => (c.supabaseId || c.id) === dono.id);
            return (donoObj && donoObj.email) ? String(donoObj.email).toLowerCase() : (perfil?.email || '').toLowerCase();
          })()
        });
        const rEst = await fetch(BACKEND + '/captacao/enviar-estoque', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ficha: fichaEnvio })
        });
        const jEst = await rEst.json();
        if (jEst.ok) { jaCaptadoRef.current = true; setImagensIA([]);
        form.estoque_id = jEst.id; setForm(f => ({ ...f, estoque_id: jEst.id }));
        alert('✓ Imóvel criado no Estoque (oculto). Vá ao Cadastro de Imóveis, adicione as fotos e publique.'); }
        else alert('A tratativa foi salva, mas não consegui criar no Estoque:\n' + (jEst.error || 'erro desconhecido') + '\n\nMe avise para verificar.');
      } catch (e) { alert('A tratativa foi salva, mas falhou o envio ao Estoque:\n' + e.message); }
    }

    const imovelStr = tipoDisplay(tipos, form.tipo_id, form.em_condominio);
    // Observações internas: o trecho PROTEGIDO (do bot/captação) sempre é preservado no topo;
    // o que o corretor acrescentou entra embaixo. Assim nada que o bot gravou se perde.
    const protegido = (detalhesBloqueadoRef.current || '').trim();
    const adicional = (detalhesAdicional || '').trim();
    let detalhesFinal;
    if (protegido) {
      detalhesFinal = adicional ? (protegido + '\n' + adicional) : protegido;
    } else {
      // tratativa sem trecho protegido (ex.: criada manualmente): usa o que estiver no campo + adicional
      const base = (form.detalhes || '').trim();
      detalhesFinal = [base, adicional].filter(Boolean).join('\n');
    }
    await onSave({ ...form, origem_tratativa: form.origem_tratativa || form.origem, detalhes: detalhesFinal, imovel: imovelStr, cliente_real_id: idVinculado });
    setSaving(false);
  }

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') { localStorage.removeItem('crm_rascunho'); onClose(); }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Salvar com contagem regressiva de 3s cancelável (evita clique errado)
  function iniciarSalvamento() {
    if (!podeSalvarTratativa) { alert('Somente visualização: a edição desta tratativa é de quem tem a estrela ⭐' + (donoEdicaoNome ? ' (' + donoEdicaoNome + ')' : '') + ' ou do corretor responsável.'); return; }
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); alert('Preencha todos os campos obrigatórios.'); return; }
    setCountdownSalvar(3);
    countdownRef.current = setInterval(() => {
      setCountdownSalvar(c => {
        if (c <= 1) { clearInterval(countdownRef.current); countdownRef.current = null; setTimeout(() => handleSave(), 0); return null; }
        return c - 1;
      });
    }, 1000);
  }
  function cancelarSalvamento() {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    setCountdownSalvar(null);
  }
  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);
  // Se a tratativa já nasce com divisão de mais de uma pessoa, o painel de divisão já vem aberto
  useEffect(() => {
    const nTrat = (modal?.tratativa_divisao || []).length;
    const nCap = (modal?.captacao_divisao || []).length;
    setDividindoAtend(nTrat > 1 || nCap > 1);
  }, [modal]);

  const errStyle = k => errors[k] ? { borderColor: '#dc2626', boxShadow: '0 0 0 3px #dc262618' } : {};
  const clienteLocked = (isNovaNeg || !!clienteEncontrado) && !isEdit;

  // ── Fase 3: campos do imóvel guardados em form.ficha (migram pro Estoque ao captar) ──
  const ficha = form.ficha || {};
  function setFicha(campo, valor) {
    setForm(f => {
      const nf = { ...(f.ficha || {}), [campo]: valor };
      const u = { ...f, ficha: nf };
      // mantém a Localização (texto) sincronizada, p/ validação e listagem no CRM
      if (campo === 'bairro' || campo === 'cidade') u.localizacao = [nf.bairro, nf.cidade].filter(Boolean).join(', ');
      if (!isEdit) localStorage.setItem('crm_rascunho', JSON.stringify(u));
      return u;
    });
  }
  const tipoNomeSel = (tipos.find(t => t.id === form.tipo_id) || {}).nome || '';
  const ehTerreno = /lote|terreno|[áa]rea|gleba|ch[áa]cara|s[íi]tio|fazenda/i.test(tipoNomeSel);
  const vazioVal = v => v === undefined || v === null || String(v).trim() === '';
  // Radar: TODOS os campos do imóvel (que o cliente passa) ainda vazios — só captação
  const radarFaltando = (() => {
    if (!isCaptacao) return [];
    const f = [];
    if (vazioVal(form.tipo_id)) f.push('Tipo de imóvel');
    if (vazioVal(form.valor)) f.push('Valor');
    if (vazioVal(ficha.endereco)) f.push('Endereço');
    if (vazioVal(ficha.bairro)) f.push('Bairro');
    if (vazioVal(ficha.cidade)) f.push('Cidade');
    if (vazioVal(ficha.estado)) f.push('Estado (UF)');
    if (ehTerreno) {
      if (vazioVal(ficha.metragemTotal)) f.push('Metragem do terreno');
      if (vazioVal(ficha.frente)) f.push('Frente');
      if (vazioVal(ficha.laterais)) f.push('Laterais / fundos');
      if (vazioVal(ficha.declive)) f.push('Declive');
    } else {
      if (vazioVal(ficha.quartos)) f.push('Quartos');
      if (vazioVal(ficha.suites)) f.push('Suítes');
      if (vazioVal(ficha.banheiros)) f.push('Banheiros');
      if (vazioVal(ficha.garagens)) f.push('Vagas de garagem');
      if (vazioVal(ficha.metragem)) f.push('Metragem construída');
      if (vazioVal(ficha.metragemTotal)) f.push('Metragem do terreno');
      if (vazioVal(ficha.estadoImovel)) f.push('Estado do imóvel');
    }
    if (form.em_condominio) {
      if (vazioVal(ficha.nomeCondominio)) f.push('Nome do condomínio');
      if (vazioVal(ficha.valorCondominio)) f.push('Valor do condomínio');
    }
    if (isLocacao && vazioVal(ficha.valorIPTU)) f.push('IPTU');
    if (!isLocacao && vazioVal(ficha.permuta)) f.push('Permuta');
    return f;
  })();
  // Campo que grava dentro da ficha, com ✓ verde quando preenchido
  const fichaInput = (label, campo, opts = {}) => {
    const ok = !vazioVal(ficha[campo]);
    return (
      <div className={opts.full ? 'col-2' : undefined}>
        <label className="form-label">{label} {ok && <span style={{ color: '#1D9E75' }}>✓</span>}</label>
        <input type={opts.type || 'text'} inputMode={opts.type === 'number' ? 'numeric' : undefined}
          value={ficha[campo] ?? ''} onChange={e => setFicha(campo, e.target.value)} placeholder={opts.ph || ''}
          style={ok ? {} : { borderColor: '#E59A94' }} />
      </div>
    );
  };

  const titulo = isNovaNeg ? `Nova Tratativa — ${modal.cliente?.nome}` : isEdit ? 'Editar Tratativa' : 'Nova Tratativa';
  const waDigits = (form.telefone || '').replace(/\D/g, '');
  const waHref = waDigits ? `https://wa.me/${internacional ? waDigits : (waDigits.startsWith('55') ? waDigits : '55' + waDigits)}` : null;

  return (
    <div className="modal-overlay"
      onMouseDown={e => { fundoMouseDown.current = e.target === e.currentTarget; }}
      onClick={e => { if (e.target === e.currentTarget && fundoMouseDown.current) { localStorage.removeItem('crm_rascunho'); onClose(); } }}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{titulo}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { localStorage.removeItem('crm_rascunho'); onClose(); }}>✕</button>
        </div>
        <div className="modal-body" style={{ display: 'block' }}>

          {isEdit && !podeSalvarTratativa && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
              👁 <b>Somente visualização.</b> A edição desta tratativa é de quem tem a estrela ⭐{donoEdicaoNome ? ` (${donoEdicaoNome})` : ''} ou do corretor responsável. Para editar, peça a transferência da estrela.
            </div>
          )}

          <div className="tsec">
          <div className="field-full">
            <label className="form-label">Estou tratando com *</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                ['Comprador','🛒','#059669','#dcfce7','#065f46'],
                ['Vendedor','🏷️','#2563eb','#dbeafe','#1d4ed8'],
                ['Locador','🔑','#d97706','#fef3c7','#92400e'],
                ['Locatário','🚪','#7c3aed','#ede9fe','#5b21b6'],
              ].map(([m, icon, border, bg, text]) => (
                <button key={m} type="button" onClick={() => set('modalidade', m)}
                  style={{ flex: '1 1 90px', minWidth: 90, padding: '8px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${form.modalidade === m ? border : '#d1d5db'}`,
                    background: form.modalidade === m ? bg : '#fff',
                    color: form.modalidade === m ? text : '#6b7280',
                    outline: errors.modalidade ? '2px solid #dc2626' : 'none' }}>
                  {icon} {m}
                </button>
              ))}
            </div>
          </div>
          </div>

          <div className="tsec">
          <textarea
            value={conversaComprador}
            onChange={e => setConversaComprador(e.target.value)}
            onPaste={handlePasteIA}
            placeholder="Cole aqui a conversa que você teve com o cliente (texto ou print/foto — Ctrl+V) ou o anúncio do imóvel. A IA lê e preenche os campos abaixo."
            style={{ width: '100%', minHeight: 84, fontSize: 13, padding: 10, borderRadius: 8, border: '1px solid #d2d2d7', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          {imagensIA.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {imagensIA.map((img, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={img.preview} alt={'print ' + (i + 1)} style={{ width: 74, height: 74, objectFit: 'cover', borderRadius: 8, border: '1px solid #d2d2d7' }} />
                  <button type="button" onClick={() => setImagensIA(prev => prev.filter((_, j) => j !== i))}
                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: '#C0392B', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button type="button" disabled={organizandoIA || organizandoComprador || !form.modalidade}
              onClick={() => (isCaptacao ? organizarIA() : organizarConversaComprador())}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: (!form.modalidade) ? '#e5e5e7' : (organizandoIA || organizandoComprador) ? '#dbeafe' : '#2563eb', color: (!form.modalidade) ? '#a1a1a6' : (organizandoIA || organizandoComprador) ? '#2563eb' : '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13.5, fontWeight: 600, cursor: (organizandoIA || organizandoComprador || !form.modalidade) ? 'default' : 'pointer' }}>
              {(organizandoIA || organizandoComprador) ? '🤖 organizando…' : '🤖 Organizar com IA'}
            </button>
            {!form.modalidade && <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 6 }}>Escolha primeiro "Estou tratando com" acima — a IA se adapta ao tipo.</div>}
          </div>
          </div>

          <div className="tsec">
          <div className="tsec-head">👤 Cliente</div>

          <div>
            <label className="form-label">
              Cole aqui o telefone do cliente *
              <label style={{ marginLeft: 12, fontSize: 11, fontWeight: 400, color: '#6b7280', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={internacional} onChange={() => { setInternacional(n => !n); set('telefone', ''); setClienteEncontrado(null); setModoCadastroCli(false); }} style={{ width: 'auto', margin: 0 }} disabled={isEdit} />
                Internacional
              </label>
            </label>
            <div style={{ position: 'relative' }}>
              <input value={form.telefone} onChange={handleTelChange} placeholder={internacional ? '+1 555 000 0000' : 'Ex: 62999999999'} style={errStyle('telefone')} disabled={isEdit && !isGerente} inputMode="numeric" />
              {buscando && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9ca3af' }}>🔍</span>}
            </div>
            {waHref && (
              <a href={waHref} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, background: '#25d366', color: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>💬 Abrir no WhatsApp</a>
            )}
            {errors.telefone && <span style={{ fontSize: 11, color: '#dc2626', marginTop: 3, display: 'block' }}>{internacional ? 'Informe um número válido.' : 'Informe um celular completo (11 dígitos: DDD + 9 + número).'}</span>}
          </div>

          {clienteEncontrado && !modoCadastroCli && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: editandoCliente ? '#eff6ff' : '#f0fdf4', border: `1px solid ${editandoCliente ? '#bfdbfe' : '#bbf7d0'}`, borderRadius: 8, fontSize: 12.5, color: editandoCliente ? '#1d4ed8' : '#065f46', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span>
                {editandoCliente
                  ? <>✏️ Editando o cadastro de <strong>{clienteEncontrado.nome}</strong> — os campos abaixo estão liberados. As alterações valem ao clicar em Salvar.</>
                  : <>✅ Cliente encontrado: <strong>{clienteEncontrado.nome}</strong>. Os dados abaixo vêm do cadastro.</>}
              </span>
              {isEdit && podeSalvarTratativa && (
                <button type="button" onClick={() => setEditandoCliente(v => !v)}
                  style={{ background: editandoCliente ? '#1d4ed8' : '#fff', color: editandoCliente ? '#fff' : '#065f46', border: `1px solid ${editandoCliente ? '#1d4ed8' : '#86efac'}`, borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {editandoCliente ? '✓ Concluir edição' : '✏️ Editar cliente'}
                </button>
              )}
            </div>
          )}

          {!clienteEncontrado && !modoCadastroCli && validarTel(form.telefone, internacional) && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, color: '#92400e' }}>Esse cliente ainda não está cadastrado.</span>
              <button type="button" onClick={() => setModoCadastroCli(true)} style={{ background: 'var(--ine-primary, #C0392B)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>＋ Cadastrar agora</button>
            </div>
          )}

          {(clienteEncontrado || modoCadastroCli || isEdit) && (() => {
            const leitura = !editandoCliente && !modoCadastroCli && !(isEdit && !clienteEncontrado);
            return (
            <div className="tgrid" style={{ marginTop: 12 }}>
              <div className="col-2">
                <label className="form-label">Nome{modoCadastroCli ? ' *' : ''}</label>
                <input value={form.nome} onChange={handleNomeChange} placeholder="Nome completo" style={errStyle('nome')} disabled={leitura} />
                {modoCadastroCli && duplicatas.length > 0 && (
                  <div style={{ marginTop: 6, padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 4 }}>⚠️ Clientes parecidos:</div>
                    {duplicatas.map(d => (<div key={d.id} style={{ color: '#78350f', display: 'flex', justifyContent: 'space-between' }}><span>{d.nome}</span><span style={{ color: '#9ca3af' }}>{d.telefone || '—'}</span></div>))}
                  </div>
                )}
              </div>
              <div>
                <label className="form-label">Telefone 2 <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>— reserva</span></label>
                <input value={form.telefone2 || ''} onChange={e => set('telefone2', e.target.value.replace(/\D/g,'').slice(0,11))} placeholder="62999999999" inputMode="numeric" disabled={leitura} />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" disabled={leitura} />
              </div>
              <div>
                <label className="form-label">Data de entrada</label>
                <input type="date" value={form.entrada || hoje} onChange={e => set('entrada', e.target.value)} disabled={leitura} />
              </div>
              <SelectComAdd label="De onde veio esse cliente?" value={form.origem} onChange={v => set('origem', v)}
                options={origens} setOptions={setOrigens} chave="origens" isGerente={isGerente} perfil={perfil} bloqueado={leitura} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
                <input type="checkbox" id="is_corretor" checked={form.is_corretor || false} onChange={e => set('is_corretor', e.target.checked)} style={{ width: 16, height: 16, cursor: leitura ? 'default' : 'pointer', margin: 0 }} disabled={leitura} />
                <label htmlFor="is_corretor" style={{ fontSize: 13, color: leitura ? '#9ca3af' : '#374151', cursor: leitura ? 'default' : 'pointer', fontWeight: 500 }}>Este cliente é corretor</label>
              </div>
              {modoCadastroCli && (
                <div className="col-2" style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" onClick={cadastrarClienteNovo} disabled={cadastrandoCli}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--ine-primary, #C0392B)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 600, cursor: cadastrandoCli ? 'default' : 'pointer' }}>
                    {cadastrandoCli ? 'Cadastrando…' : '✓ Salvar cliente'}
                  </button>
                  <button type="button" onClick={() => setModoCadastroCli(false)} style={{ background: 'none', border: '1px solid #d2d2d7', borderRadius: 8, padding: '9px 16px', fontSize: 13.5, color: '#6e6e73', cursor: 'pointer' }}>Cancelar</button>
                </div>
              )}
            </div>
            );
          })()}
          </div>

          <div className="tsec">
          {isCaptacao && radarFaltando.length > 0 && (
            <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#C0392B', borderRadius: 10, padding: '11px 13px', marginBottom: 14, boxShadow: '0 2px 8px rgba(192,57,43,0.3)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>📡</span> Ainda falta perguntar ({radarFaltando.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {radarFaltando.map(item => (
                  <span key={item} style={{ background: 'rgba(255,255,255,0.22)', color: '#fff', fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 20 }}>{item}</span>
                ))}
              </div>
            </div>
          )}
          {isCaptacao && form.modalidade && radarFaltando.length === 0 && (
            <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#eafaf1', border: '1px solid #9FE1CB', borderRadius: 10, padding: '11px 13px', marginBottom: 14, fontSize: 13, color: '#0F6E56', fontWeight: 700 }}>✓ Todas as informações do cliente foram coletadas.</div>
          )}
          <div className="tsec-head">{!form.modalidade ? '🏠 Imóvel / interesse' : isCaptacao ? '🏠 Imóvel' : '🔎 O que esse cliente está procurando'}</div>
          {isCaptacao && (
            <div className="field-full" style={{ background: '#eef4fb', border: '1px solid #b5d4f4', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#185FA5', marginBottom: 4 }}>
              🏠 Imóvel a ser captado para {isLocacao ? 'locação' : 'venda'} — migra pro Estoque ao captar. O que exige pesquisa (CEP, descrição, fotos) fica pro Estoque.
            </div>
          )}
          <div className="tgrid">
          {(() => {
            const tipoSel = tipos.find(t => t.id === form.tipo_id);
            const permiteCond = !!tipoSel?.permite_condominio;
            return (
              <div>
                <label className="form-label" style={errors.tipo_id ? { color: '#dc2626' } : {}}>
                  Tipo de Imóvel{!isCaptacao ? ' *' : ''}
                </label>
                <select
                  value={form.tipo_id}
                  onChange={e => {
                    const novoId = e.target.value;
                    const t = tipos.find(x => x.id === novoId);
                    set('tipo_id', novoId);
                    if (!t || !t.permite_condominio) set('em_condominio', false);
                    if (errors.tipo_id) setErrors(er => ({ ...er, tipo_id: false }));
                  }}
                  style={!isCaptacao ? errStyle('tipo_id') : {}}
                >
                  <option value="">Selecionar</option>
                  {[...tipos].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' })).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
                {permiteCond && (
                  <label style={{ marginTop: 6, fontSize: 13, color: '#374151', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!form.em_condominio}
                      onChange={e => set('em_condominio', e.target.checked)}
                      style={{ width: 'auto', margin: 0 }}
                    />
                    Em condomínio
                  </label>
                )}
              </div>
            );
          })()}
          <div>
            <label className="form-label" style={errors.valor ? { color: '#dc2626' } : {}}>{isLocacao && isCaptacao ? 'Valor do aluguel (R$)' : 'Valor (R$)'} *</label>
            <input value={valorDisplay} onChange={handleValorChange} placeholder="R$ 0,00" style={errStyle('valor')} />
          </div>
          {isCaptacao ? (<>
            {fichaInput('Endereço', 'endereco', { full: true, ph: 'Rua, número, complemento' })}
            {fichaInput('Bairro / setor', 'bairro')}
            {fichaInput('Cidade', 'cidade')}
            {fichaInput('Estado (UF)', 'estado', { ph: 'GO' })}
            {!ehTerreno ? (<>
              {fichaInput('Quartos', 'quartos', { type: 'number' })}
              {fichaInput('Suítes', 'suites', { type: 'number' })}
              {fichaInput('Banheiros', 'banheiros', { type: 'number' })}
              {fichaInput('Vagas de garagem', 'garagens', { type: 'number' })}
              {fichaInput('Metragem construída (m²)', 'metragem', { type: 'number' })}
              {fichaInput('Metragem do terreno (m²)', 'metragemTotal', { type: 'number' })}
              <div>
                <label className="form-label">Estado do imóvel {!vazioVal(ficha.estadoImovel) && <span style={{ color: '#1D9E75' }}>✓</span>}</label>
                <select value={ficha.estadoImovel ?? ''} onChange={e => setFicha('estadoImovel', e.target.value)}>
                  <option value="">Selecionar</option>
                  <option>Imóvel Novo</option><option>Seminovo</option><option>Usado</option><option>Em construção</option><option>Na planta</option>
                </select>
              </div>
            </>) : (<>
              {fichaInput('Metragem do terreno (m²)', 'metragemTotal', { type: 'number' })}
              {fichaInput('Frente (m)', 'frente', { type: 'number' })}
              {fichaInput('Laterais / fundos', 'laterais')}
              <div>
                <label className="form-label">Declive {!vazioVal(ficha.declive) && <span style={{ color: '#1D9E75' }}>✓</span>}</label>
                <select value={ficha.declive ?? ''} onChange={e => setFicha('declive', e.target.value)}>
                  <option value="">Selecionar</option><option>Plano</option><option>Aclive</option><option>Declive</option>
                </select>
              </div>
              <div className="col-2" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', paddingTop: 4 }}>
                {[['Muro','muro'],['Esquina','esquina'],['Asfalto','asfalto'],['Água','agua'],['Esgoto','esgoto']].map(([lbl, ck]) => (
                  <label key={ck} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!ficha[ck]} onChange={e => setFicha(ck, e.target.checked)} style={{ width: 'auto', margin: 0 }} /> {lbl}
                  </label>
                ))}
              </div>
            </>)}
            {form.em_condominio && (<>
              {fichaInput('Nome do condomínio', 'nomeCondominio', { full: true })}
              {fichaInput('Valor do condomínio (R$)', 'valorCondominio', { type: 'number' })}
            </>)}
            {isLocacao && fichaInput('IPTU (R$)', 'valorIPTU', { type: 'number' })}
            {!isLocacao && (
            <div>
              <label className="form-label">Aceita permuta? {!vazioVal(ficha.permuta) && <span style={{ color: '#1D9E75' }}>✓</span>}</label>
              <select value={ficha.permuta ?? ''} onChange={e => setFicha('permuta', e.target.value)}>
                <option value="">Não informado</option><option>Sim</option><option>Não</option>
              </select>
            </div>
            )}
          </>) : (<>
            <div>
              <label className="form-label">Localização *</label>
              <input value={form.localizacao} onChange={e => set('localizacao', e.target.value)} placeholder="Região, bairro..." style={errStyle('localizacao')} />
            </div>
            <div>
              <label className="form-label">Imóveis Visitados</label>
              <input value={form.imoveis_visitados} onChange={e => set('imoveis_visitados', e.target.value)} />
            </div>
          </>)}
          </div>
          {isCaptacao && !isLocacao && (
            <div className="field-full" style={{ marginTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1d1d1f', cursor: 'pointer', fontWeight: 500 }}>
                <input type="checkbox" checked={!!ficha._agio} onChange={e => setFicha('_agio', e.target.checked)} style={{ width: 16, height: 16, margin: 0 }} />
                Imóvel de ágio (assumir financiamento)
              </label>
              {ficha._agio && (
                <div className="tgrid" style={{ marginTop: 10, gridTemplateColumns: '1fr 1fr 1fr' }}>
                  {fichaInput('Parcela (R$)', 'agioParcela', { type: 'number' })}
                  {fichaInput('Prazo (meses)', 'agioPrazo', { type: 'number' })}
                  {fichaInput('Saldo devedor (R$)', 'agioSaldoDevedor', { type: 'number' })}
                  <div className="col-2" style={{ fontSize: 11.5, color: '#922B21' }}>
                    Valor total (ágio + saldo): {((Number(form.valor) || 0) + (Number(ficha.agioSaldoDevedor) || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>

          {!isCaptacao && (
          <div className="tsec">
          <div className="tsec-head">🧭 Fase do atendimento</div>
          <div className="field-full">
            <label className="form-label" style={errors.funil ? { color: '#dc2626' } : {}}>
              Em que etapa o atendimento está * {errors.funil && <span style={{ fontSize: 11 }}>— selecione pelo menos uma</span>}
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4, padding: errors.funil ? '8px' : '0', borderRadius: 7, border: errors.funil ? '1px solid #dc2626' : 'none' }}>
              {ETAPAS_FUNIL_COMPLETO.map(e => (
                <button key={e} type="button" onClick={() => set(e, !form[e])}
                  style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${form[e] ? '#059669' : '#d1d5db'}`,
                    background: form[e] ? '#d1fae5' : '#fff',
                    color: form[e] ? '#065f46' : '#6b7280' }}>
                  {ETAPAS_LABEL[e]}
                </button>
              ))}
            </div>
          </div>
          </div>
          )}

          <div className="tsec">
          <div className="tsec-head">📝 Observações</div>
          <div className="field-full">
            <label className="form-label">
              Observações Internas <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>— visível só para a equipe</span>
            </label>
            {detalhesBloqueadoRef.current ? (
              <>
                <div style={{ position: 'relative', marginBottom: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#92400e', background: '#fef3c7', display: 'inline-block', padding: '2px 7px', borderRadius: '6px 6px 0 0', border: '1px solid #fde68a', borderBottom: 'none' }}>
                    🔒 Registrado na captação — não pode ser apagado
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#374151', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0 6px 6px 6px', padding: '8px 10px', maxHeight: 140, overflowY: 'auto' }}>
                    {detalhesBloqueadoRef.current}
                  </div>
                </div>
                <label className="form-label" style={{ marginTop: 8, display: 'block' }}>➕ Mais observações e fotos</label>
                <textarea rows={2} value={detalhesAdicional} onChange={e => setDetalhesAdicional(e.target.value)}
                  onPaste={handlePasteFotos}
                  placeholder="Acrescentar mais observações internas... (cole prints com Ctrl+V — viram fotos abaixo)"
                  style={{ background: '#fffbeb', borderColor: '#fde68a' }} />
                <GaleriaFotos />
              </>
            ) : (
              <>
                <textarea rows={2} value={form.detalhes} onChange={e => set('detalhes', e.target.value)}
                  onPaste={handlePasteFotos}
                  placeholder="Anotações internas, perfil do cliente... (cole prints com Ctrl+V — viram fotos abaixo)"
                  style={{ background: '#fffbeb', borderColor: '#fde68a' }} />
                <GaleriaFotos />
              </>
            )}
          </div>
          <div className="field-full">
            <label className="form-label">
              Observações Externas <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>— pode ser compartilhado</span>
            </label>
            <textarea rows={2} value={form.detalhes_externos || ''} onChange={e => set('detalhes_externos', e.target.value)}
              placeholder="Informações para enviar a parceiros ou clientes..."
              style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }} />
          </div>
          </div>

          <div className="tsec">
          <div className="tsec-head">👥 Equipe e parceria</div>
          {!isCaptacao && (
            <div className="field-full" style={{ marginBottom: 10 }}>
              <button type="button" onClick={() => set('solicitar_parceria', !form.solicitar_parceria)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, cursor: 'pointer', width: '100%',
                  border: `2px solid ${form.solicitar_parceria ? '#7c3aed' : '#d1d5db'}`,
                  background: form.solicitar_parceria ? '#f5f3ff' : '#fff' }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${form.solicitar_parceria ? '#7c3aed' : '#d1d5db'}`, background: form.solicitar_parceria ? '#7c3aed' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {form.solicitar_parceria && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: form.solicitar_parceria ? '#7c3aed' : '#374151' }}>🤝 Quero verificar se algum corretor tem um imóvel que atenda esse cliente</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Aparece na aba Demandas pros corretores</div>
                </div>
              </button>
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#1d1d1f', cursor: 'pointer', fontWeight: 500, padding: '6px 0' }}>
            <input type="checkbox" checked={dividindoAtend} onChange={e => setDividindoAtend(e.target.checked)} style={{ width: 16, height: 16, margin: 0 }} />
            Estou dividindo o atendimento desse cliente
          </label>
          {dividindoAtend && !isCaptacao && (
          <div className="field-full" style={{ marginTop: 4 }}>
            <label className="form-label">Adicionar corretor</label>
            <select value="" onChange={e => { if (e.target.value) { addCorretorDivisao(e.target.value); e.target.value = ''; } }} style={{ width: '100%', marginBottom: 8 }}>
              <option value="">+ Adicionar corretor à divisão...</option>
              {corretores
                .filter(c => (c.supabaseId || c.id) && !divisao.some(d => d.id === (c.supabaseId || c.id)))
                .map(c => <option key={c.supabaseId || c.id} value={c.supabaseId || c.id}>{c.nome}</option>)}
            </select>

            {divisao.length >= 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {divisao.map((item, idx) => {
                  const posso = podeEditarFatiaTrat(item);
                  const ehDono = item.id === donoEdicaoId;
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 10, padding: '8px 12px', border: '1px solid #e5e7eb' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            onClick={() => definirDonoEdicaoTrat(item)}
                            title={ehDono ? 'Dono da edição (comanda a tratativa)' : (podeTransferirEdicaoTrat ? 'Passar o dono da edição para este corretor' : 'Só o dono atual ou diretor/gerente transfere')}
                            style={{ fontSize: 15, lineHeight: 1, cursor: (podeTransferirEdicaoTrat && !ehDono) ? 'pointer' : 'default', opacity: ehDono ? 1 : (podeTransferirEdicaoTrat ? 0.35 : 0.2), userSelect: 'none' }}>
                            {ehDono ? '⭐' : '☆'}
                          </span>
                          {item.nome}
                          {!posso && <span style={{ fontSize: 10.5, color: '#9ca3af', fontWeight: 500 }}>🔒</span>}
                        </div>
                      </div>
                      {divisao.length > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="number" min="0" max="100" step="1" value={item.pct} disabled={!posso}
                            onChange={e => setPctDivisao(idx, e.target.value)}
                            style={{ width: 60, textAlign: 'center', padding: '4px 6px', borderRadius: 6, border: '1px solid #d1d5db', opacity: posso ? 1 : 0.55, cursor: posso ? 'auto' : 'not-allowed', background: posso ? '#fff' : '#f3f4f6' }} />
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>%</span>
                        </div>
                      )}
                      <button type="button" disabled={!posso} title={posso ? 'Remover' : 'Só o dono ou diretor/gerente remove'}
                        onClick={() => removerCorretorDivisao(idx, item)}
                        style={{ background: 'none', border: 'none', color: posso ? '#9ca3af' : '#e5e7eb', cursor: posso ? 'pointer' : 'not-allowed', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
                    </div>
                  );
                })}
                {divisao.length > 1 && (
                  <div style={{ fontSize: 11, color: '#9ca3af', paddingLeft: 4 }}>
                    Total: {somaPctTrat}%
                    {somaPctTrat !== 100 && <span style={{ color: '#dc2626', marginLeft: 6 }}>⚠ deve somar 100%</span>}
                  </div>
                )}
                <div style={{ fontSize: 10.5, color: '#9ca3af', paddingLeft: 4 }}>
                  ⭐ = dono da edição. {podeTransferirEdicaoTrat ? 'Clique na ☆ para passar a posse.' : 'Só o dono atual ou diretor/gerente transfere.'}
                </div>
              </div>
            )}
            {pedidoPendente && (
              <div style={{ marginTop: 8, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>⏳ Divisão pendente de aprovação</div>
                <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                  Há uma divisão aguardando o aval do gerente (cede comissão para outra equipe). Até ser aprovada, vale a divisão atual.
                  <div style={{ marginTop: 4 }}>
                    Proposta: {(pedidoPendente.divisao_proposta || []).map(d => `${d.nome} ${d.pct}%`).join(' · ')}
                  </div>
                </div>
              </div>
            )}
          </div>
          )}
          {dividindoAtend && isCaptacao && (
          <div className="field-full" style={{ marginTop: 4, paddingTop: 10, borderTop: '1px dashed #e5e7eb' }}>
            <label className="form-label">Divisão de captação (vai para o Estoque)</label>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>Quem captou este imóvel. Ao marcar como captado, esta divisão segue para o cadastro no Estoque.</div>

            <select value="" onChange={e => { if (e.target.value) { addCaptadorInterno(e.target.value); e.target.value = ''; } }} style={{ width: '100%', marginBottom: 8 }}>
              <option value="">+ Adicionar captador interno...</option>
              {corretores.filter(c => (c.supabaseId || c.id) && !capDiv.some(d => d.tipo === 'interno' && d.id === (c.supabaseId || c.id)))
                .map(c => <option key={c.supabaseId || c.id} value={c.supabaseId || c.id}>{c.nome}</option>)}
            </select>

            <select value="" onChange={e => { const v = e.target.value; if (v === '__novo__') { setMostrarNovoExternoCap(true); } else if (v) { addCaptadorExterno(v); } e.target.value = ''; }} style={{ width: '100%', marginBottom: 8 }}>
              <option value="">+ Adicionar captador externo...</option>
              <option value="__novo__">➕ Cadastrar novo externo</option>
              {listaExternos.filter(x => !capDiv.some(d => d.tipo === 'externo' && d.externo_id === x.id))
                .map(x => <option key={x.id} value={x.id}>{x.nome}{x.cpf ? ` — CPF ${x.cpf}` : ''}</option>)}
            </select>

            {mostrarNovoExternoCap && (
              <div style={{ padding: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Novo captador externo</div>
                <input placeholder="Nome *" value={novoExternoCap.nome} onChange={e => setNovoExternoCap(p => ({ ...p, nome: e.target.value }))} style={{ width: '100%', marginBottom: 6, padding: '7px 9px', borderRadius: 7, border: '1px solid #d1d5db' }} />
                <input placeholder="CPF" value={novoExternoCap.cpf} onChange={e => setNovoExternoCap(p => ({ ...p, cpf: e.target.value }))} style={{ width: '100%', marginBottom: 6, padding: '7px 9px', borderRadius: 7, border: '1px solid #d1d5db' }} />
                <input placeholder="Telefone" value={novoExternoCap.telefone} onChange={e => setNovoExternoCap(p => ({ ...p, telefone: e.target.value }))} style={{ width: '100%', marginBottom: 8, padding: '7px 9px', borderRadius: 7, border: '1px solid #d1d5db' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" disabled={salvandoExternoCap} onClick={salvarNovoExternoCap} style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{salvandoExternoCap ? 'Salvando...' : 'Salvar externo'}</button>
                  <button type="button" onClick={() => { setMostrarNovoExternoCap(false); setNovoExternoCap({ nome: '', cpf: '', telefone: '' }); }} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                </div>
              </div>
            )}

            {capDiv.length >= 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {capDiv.map((item, idx) => {
                  const posso = podeEditarFatiaCap(item);
                  const ehDono = item.tipo === 'interno' && item.id === capDonoEdicao;
                  const chave = item.tipo === 'externo' ? `ext-${item.externo_id}` : `int-${item.id}`;
                  return (
                    <div key={chave} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 10, padding: '8px 12px', border: '1px solid #e5e7eb' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {item.tipo === 'interno' && (
                            <span onClick={() => definirDonoEdicaoCap(item)}
                              title={ehDono ? 'Dono da edição da captação' : (podeTransferirEdicaoCap ? 'Passar o dono da edição para este captador' : 'Só o dono atual ou diretor/gerente transfere')}
                              style={{ fontSize: 15, lineHeight: 1, cursor: (podeTransferirEdicaoCap && !ehDono) ? 'pointer' : 'default', opacity: ehDono ? 1 : (podeTransferirEdicaoCap ? 0.35 : 0.2), userSelect: 'none' }}>
                              {ehDono ? '⭐' : '☆'}
                            </span>
                          )}
                          {item.nome}
                          {item.tipo === 'externo' && <span style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', marginLeft: 4 }}>(externo)</span>}
                          {!posso && <span style={{ fontSize: 10.5, color: '#9ca3af', fontWeight: 500 }}>🔒</span>}
                        </div>
                      </div>
                      {capDiv.length > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="number" min="0" max="100" step="1" value={item.pct} disabled={!posso}
                            onChange={e => setPctCap(idx, e.target.value)}
                            style={{ width: 60, textAlign: 'center', padding: '4px 6px', borderRadius: 6, border: '1px solid #d1d5db', opacity: posso ? 1 : 0.55, cursor: posso ? 'auto' : 'not-allowed', background: posso ? '#fff' : '#f3f4f6' }} />
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>%</span>
                        </div>
                      )}
                      <button type="button" disabled={!posso} title={posso ? 'Remover' : 'Só o dono ou diretor/gerente remove'}
                        onClick={() => removerCaptador(idx, item)}
                        style={{ background: 'none', border: 'none', color: posso ? '#9ca3af' : '#e5e7eb', cursor: posso ? 'pointer' : 'not-allowed', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
                    </div>
                  );
                })}
                {capDiv.length > 1 && (
                  <div style={{ fontSize: 11, color: '#9ca3af', paddingLeft: 4 }}>
                    Total: {somaPctCap}%
                    {somaPctCap !== 100 && <span style={{ color: '#dc2626', marginLeft: 6 }}>⚠ deve somar 100%</span>}
                  </div>
                )}
                <div style={{ fontSize: 10.5, color: '#9ca3af', paddingLeft: 4 }}>
                  ⭐ = dono da edição da captação. {podeTransferirEdicaoCap ? 'Clique na ☆ para passar a posse.' : 'Só o dono atual ou diretor/gerente transfere.'}
                </div>
              </div>
            )}
          </div>
          )}
          </div>

          <div className="tsec">
          <div className="tsec-head">📋 Acompanhamento da tratativa</div>
          <div className="tgrid">
          <SelectComAdd label="De onde veio essa tratativa?" value={form.origem_tratativa || ''} onChange={v => set('origem_tratativa', v)} bloqueado={origemTratLockRef.current}
            options={origens} setOptions={setOrigens} chave="origens"
            isGerente={isGerente} perfil={perfil} />
          <div>
            <label className="form-label">Qual será o próximo passo</label>
            <input value={form.proxima_acao} onChange={e => set('proxima_acao', e.target.value)} placeholder="O que fazer?" />
          </div>
          <div>
            <label className="form-label">Último Contato</label>
            <input type="date" value={form.ultimo_contato || ''} onChange={e => set('ultimo_contato', e.target.value)} />
            <button type="button" onClick={() => set('ultimo_contato', hoje)}
              style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 7, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, padding: '9px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
              📌 Registrar contato hoje
            </button>
          </div>
          <div>
            <label className="form-label">Próx. Contato</label>
            <input type="date" value={form.prox_contato || ''} onChange={e => set('prox_contato', e.target.value)} />
          </div>
          </div>
          </div>

        </div>
        <div className="modal-footer" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
          <div className="tstatus-bar">
            <label className="form-label" style={{ marginBottom: 2 }}>Qual é a situação desse cliente hoje?</label>
            {isCaptacao ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => { if (form.captado) toggleCaptado(); }}
                  style={{ flex: 1, padding: '8px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${!form.captado ? '#d97706' : '#d1d5db'}`,
                    background: !form.captado ? '#fef3c7' : '#fff',
                    color: !form.captado ? '#92400e' : '#6b7280' }}>
                  🔄 Em captação
                </button>
                <button type="button" onClick={() => { if (!form.captado) toggleCaptado(); }}
                  title="Marca a captação como concluída: o imóvel foi captado e vai pro Estoque"
                  style={{ flex: 1, padding: '8px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${form.captado ? '#059669' : '#d1d5db'}`,
                    background: form.captado ? '#d1fae5' : '#fff',
                    color: form.captado ? '#065f46' : '#6b7280' }}>
                  🏠 Captado
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                {['S','N'].map(v => (
                  <button key={v} type="button" onClick={() => setStatus(v)}
                    style={{ flex: 1, padding: '8px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${form.ativo === v ? (v === 'S' ? '#059669' : '#dc2626') : '#d1d5db'}`,
                      background: form.ativo === v ? (v === 'S' ? '#d1fae5' : '#fee2e2') : '#fff',
                      color: form.ativo === v ? (v === 'S' ? '#065f46' : '#991b1b') : '#6b7280' }}>
                    {v === 'S' ? '✓ Ativo' : '✕ Inativo'}
                  </button>
                ))}
              </div>
            )}
            {isCaptacao && form.captado && (
              <span style={{ fontSize: 11, color: '#059669', marginTop: 4, display: 'block' }}>
                Imóvel captado — vai pro Estoque ao salvar.
              </span>
            )}
            {!isCaptacao && form.ativo === 'N' && (
              <SelectComAdd label="Motivo da desistência" value={form.motivo_desistencia || ''} onChange={v => set('motivo_desistencia', v)}
                options={motivos} setOptions={setMotivos} chave="motivos" isGerente={isGerente} perfil={perfil} />
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      {onDelete && modal && modal.id && !modal.novaNegociacao && (
            <div style={{ marginRight: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" style={{ color: '#dc2626' }} onClick={async () => {
                if (!window.confirm('Excluir esta tratativa? Esta ação não pode ser desfeita.')) return;
                localStorage.removeItem('crm_rascunho');
                await onDelete(modal.id);
                onClose();
              }}>🗑️ Excluir</button>
              {String(form.origem_tratativa || '').toUpperCase() === 'OLX' && (
                <button className="btn btn-ghost" style={{ color: '#b45309' }} onClick={devolverParaCaptacao} disabled={saving}>↩ Devolver pra Captação</button>
              )}
            </div>
          )}
          {modal && modal.id && (
            <BotaoFecharContrato
              neg={{ id: modal.id, nome: form.nome, telefone: form.telefone, email: form.email, imovel: form.imovel, valor: form.valor, modalidade: form.modalidade, corretor: form.corretor, contrato: form.contrato }}
              podeContrato={!!(perfil?.is_diretor || perfil?.is_gerente)}
              variant="modal" />
          )}
          <button className="btn btn-ghost" onClick={() => { localStorage.removeItem('crm_rascunho'); onClose(); }}>Cancelar</button>
          {!podeSalvarTratativa ? (
            <button className="btn btn-primary" disabled style={{ opacity: 0.55, cursor: 'not-allowed' }}
              title={'Somente visualização — a edição é de quem tem a estrela ⭐' + (donoEdicaoNome ? ' (' + donoEdicaoNome + ')' : '')}>
              🔒 Somente visualização
            </button>
          ) : countdownSalvar != null ? (
            <button className="btn btn-primary" onClick={cancelarSalvamento} style={{ background: '#d97706' }}>
              Salvando em {countdownSalvar}… toque para cancelar
            </button>
          ) : (
            <button className="btn btn-primary" onClick={iniciarSalvamento} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
          )}
          </div>
        </div>
      </div>
      {transfAberto && (
        <div onClick={() => setTransfAberto(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, width: 'min(440px, 92vw)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>🔄 Transferir cliente</h3>
            <p style={{ fontSize: 12.5, color: '#6b7280', margin: '0 0 16px' }}>
              A transferência precisa de dupla aprovação: o gerente de origem libera a saída e o destino (ou o gerente dele) aceita.
            </p>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Transferir para</label>
            <select value={transfDestino} onChange={e => setTransfDestino(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, marginBottom: 14, background: '#fff' }}>
              <option value="">— selecione o corretor —</option>
              {corretores.filter(c => c.supabaseId && c.supabaseId !== (form.corretor_id || perfil?.id)).map(c => (
                <option key={c.supabaseId} value={c.supabaseId}>{c.nome}</option>
              ))}
            </select>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Observação (opcional)</label>
            <textarea value={transfObs} onChange={e => setTransfObs(e.target.value)} rows={2}
              placeholder="Motivo da transferência…"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, marginBottom: 14, resize: 'vertical', boxSizing: 'border-box' }} />
            {transfMsg && <div style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, marginBottom: 12, background: transfMsg.startsWith('✅') ? '#d1fae5' : '#fee2e2', color: transfMsg.startsWith('✅') ? '#059669' : '#dc2626' }}>{transfMsg}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setTransfAberto(false); setTransfMsg(''); }} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={solicitarTransferencia} disabled={transfEnviando} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{transfEnviando ? 'Enviando…' : 'Solicitar transferência'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
