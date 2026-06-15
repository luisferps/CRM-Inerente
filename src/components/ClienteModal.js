import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { ETAPAS_FUNIL_COMPLETO, ETAPAS_LABEL } from '../constants';

const hoje = new Date().toISOString().slice(0, 10);
const BACKEND = 'https://agentes-de-whatsapp-production.up.railway.app';

const emptyForm = {
  nome: '', telefone: '', telefone2: '', email: '', entrada: hoje,
  origem: '', is_corretor: false,
  ativo: 'S', motivo_desistencia: '',
  captado: false, ficha: null,
  corretor: '', corretor_id: null,
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
  const [origens, setOrigens] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [valorDisplay, setValorDisplay] = useState('');
  const [internacional, setInternacional] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [origemBloqueada, setOrigemBloqueada] = useState(false);
  const [duplicatas, setDuplicatas] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [motivoAberto, setMotivoAberto] = useState(false);
  const [organizandoIA, setOrganizandoIA] = useState(false);
  const jaCaptadoRef = useRef(false);
  const timerNome = useRef(null);
  const timer = useRef(null);

  // Buscar motivos já usados no banco
  useEffect(() => {
    supabase.from('negociacoes').select('motivo_desistencia').neq('motivo_desistencia', '').not('motivo_desistencia', 'is', null)
      .then(({ data }) => {
        const unicos = [...new Set((data || []).map(d => d.motivo_desistencia).filter(Boolean))].sort();
        setMotivos(unicos);
      });
  }, []);

  // Lista de corretores (para o gerente poder (re)atribuir a tratativa)
  const [corretores, setCorretores] = useState([]);
  useEffect(() => {
    supabase.from('perfis').select('id, nome, telefone').eq('role', 'corretor').order('nome')
      .then(({ data }) => setCorretores(data || []));
  }, []);

  const isEdit = modal && modal.negociacao_id;
  const isNovaNeg = modal && modal.novaNegociacao;
  const isGerente = perfil?.is_gerente;
  const isVenda = form.modalidade === 'Venda';

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
    if (isEdit) {
      setForm({ ...emptyForm, ...modal });
      jaCaptadoRef.current = !!modal.captado;
      setValorDisplay(modal.valor !== '' && modal.valor !== null && modal.valor !== undefined
        ? Number(modal.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '');
      setInternacional(isIntl(modal.telefone || ''));
      localStorage.removeItem('crm_rascunho');
    } else if (isNovaNeg) {
      const c = modal.cliente;
      const initial = { ...emptyForm, nome: c.nome, telefone: c.telefone, email: c.email, entrada: c.entrada, origem: 'Carteira', is_corretor: c.is_corretor || false, cliente_real_id: c.id };
      if (perfil) { initial.corretor = perfil.nome; initial.corretor_id = perfil.id; }
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
    if (perfil) { initial.corretor = perfil.nome; initial.corretor_id = perfil.id; }
    setForm(initial);
    setValorDisplay('');
    setInternacional(false);
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
        const { data: negs } = await supabase.from('negociacoes').select('id').eq('cliente_id', c.id).limit(1);
        const temTratativas = negs && negs.length > 0;
        setForm(f => ({
          ...f,
          nome: c.nome,
          email: c.email || f.email,
          origem: temTratativas ? 'Carteira' : (c.origem || f.origem),
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
      const u = { ...f, captado: novo, ativo: novo ? 'N' : f.ativo };
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
    if (!validarTel(form.telefone, internacional)) errs.telefone = true;
    if (!form.modalidade) errs.modalidade = true;
    if (!isVenda) {
      if (!form.tipo_id) errs.tipo_id = true;
      if (!ETAPAS_FUNIL_COMPLETO.some(e => form[e])) errs.funil = true;
    }
    if (!form.localizacao.trim()) errs.localizacao = true;
    if (form.valor === '' || form.valor === null || form.valor === undefined) errs.valor = true;
    return errs;
  }

  async function organizarIA() {
    const desc = (form.ficha && form.ficha._descricao) || '';
    if (!desc.trim()) { alert('Cole a descrição do imóvel no campo abaixo antes de organizar com a IA.'); return; }
    setOrganizandoIA(true);
    try {
      const r = await fetch(BACKEND + '/captacao/organizar-ficha', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: desc, ficha: form.ficha || {} })
      });
      const j = await r.json();
      if (j.ok && j.ficha) { set('ficha', Object.assign({}, j.ficha, { _descricao: desc })); alert('✓ Ficha organizada pela IA. Confira o resumo.'); }
      else alert('Não consegui organizar: ' + (j.error || 'erro'));
    } catch (e) { alert('Erro ao chamar a IA: ' + e.message); }
    finally { setOrganizandoIA(false); }
  }

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); alert('Preencha todos os campos obrigatórios.'); return; }
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

    // Captado AGORA (acabou de marcar nesta edição) -> cria o imóvel no Estoque (oculto)
    const captarAgora = form.captado && !jaCaptadoRef.current;
    if (captarAgora) {
      try {
        const fbase = form.ficha || {};
        // o corretor da tratativa vira o CAPTADOR no Estoque
        const corretorObj = corretores.find(c => String(c.id) === String(form.corretor_id));
        const capNome = form.corretor || (perfil && perfil.nome) || '';
        const capTel = (corretorObj && corretorObj.telefone)
          || (perfil && String(form.corretor_id) === String(perfil.id) ? perfil.telefone : '') || '';
        // campos editados no modal do CRM têm prioridade e sobrescrevem a ficha
        const tipoNome = (tipos.find(x => String(x.id) === String(form.tipo_id)) || {}).nome || '';
        const partesLoc = String(form.localizacao || '').split(',').map(x => x.trim()).filter(Boolean);
        const locBairro = partesLoc[0] || '';
        const locCidade = partesLoc[1] || '';
        const locEstado = (partesLoc[2] && partesLoc[2].length <= 3) ? partesLoc[2].toUpperCase() : (partesLoc[2] || '');
        const nomePlaceholder = /^propriet[áa]rio\s*\d+$/i.test(String(form.nome || '').trim());
        const fichaEnvio = Object.assign({}, fbase, {
          preco: (form.valor !== '' && form.valor != null) ? form.valor : fbase.preco,
          tipo: tipoNome || fbase.tipo,
          transacao: 'Venda',
          condominio: !!form.em_condominio || !!fbase.condominio,
          bairro: locBairro || fbase.bairro,
          cidade: locCidade || fbase.cidade,
          estado: locEstado || fbase.estado,
          nomeProprietario: nomePlaceholder ? (fbase.nomeProprietario || form.nome) : (form.nome || fbase.nomeProprietario),
          telefoneProprietario: form.telefone || fbase.telefoneProprietario,
          nomeCaptador: fbase.nomeCaptador || capNome,
          telefoneCaptador: fbase.telefoneCaptador || capTel
        });
        const rEst = await fetch(BACKEND + '/captacao/enviar-estoque', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ficha: fichaEnvio })
        });
        const jEst = await rEst.json();
        if (jEst.ok) { jaCaptadoRef.current = true; alert('✓ Imóvel criado no Estoque (oculto). Vá ao Cadastro de Imóveis, adicione as fotos e publique.'); }
        else alert('A tratativa foi salva, mas não consegui criar no Estoque:\n' + (jEst.error || 'erro desconhecido') + '\n\nMe avise para verificar.');
      } catch (e) { alert('A tratativa foi salva, mas falhou o envio ao Estoque:\n' + e.message); }
    }

    const imovelStr = tipoDisplay(tipos, form.tipo_id, form.em_condominio);
    await onSave({ ...form, imovel: imovelStr, cliente_real_id: idVinculado });
    setSaving(false);
  }

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') { localStorage.removeItem('crm_rascunho'); onClose(); }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const errStyle = k => errors[k] ? { borderColor: '#dc2626', boxShadow: '0 0 0 3px #dc262618' } : {};
  const clienteLocked = (isNovaNeg || !!clienteEncontrado) && !isEdit;
  const titulo = isNovaNeg ? `Nova Tratativa — ${modal.cliente?.nome}` : isEdit ? 'Editar Tratativa' : 'Nova Tratativa';
  const waDigits = (form.telefone || '').replace(/\D/g, '');
  const waHref = waDigits ? `https://wa.me/${internacional ? waDigits : (waDigits.startsWith('55') ? waDigits : '55' + waDigits)}` : null;

  return (
    <div className="modal-overlay" onClick={() => { localStorage.removeItem('crm_rascunho'); onClose(); }}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{titulo}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { localStorage.removeItem('crm_rascunho'); onClose(); }}>✕</button>
        </div>
        <div className="modal-body">

          {/* DADOS DO CLIENTE */}
          <div className="field-full" style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dados do Cliente</span>
          </div>

          <div>
            <label className="form-label">
              Telefone *
              <label style={{ marginLeft: 12, fontSize: 11, fontWeight: 400, color: '#6b7280', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={internacional} onChange={() => { setInternacional(n => !n); set('telefone', ''); setClienteEncontrado(null); }} style={{ width: 'auto', margin: 0 }} disabled={isEdit} />
                Internacional
              </label>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                value={form.telefone}
                onChange={handleTelChange}
                placeholder={internacional ? '+1 555 000 0000' : '62999999999'}
                style={errStyle('telefone')}
                disabled={isEdit && !isGerente}
                inputMode="numeric"
              />
              {buscando && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9ca3af' }}>🔍</span>}
            </div>
            {waHref && (
              <a href={waHref} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, background: '#25d366', color: '#fff', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                💬 Abrir no WhatsApp
              </a>
            )}
            {errors.telefone && <span style={{ fontSize: 11, color: '#dc2626', marginTop: 3, display: 'block' }}>{internacional ? 'Informe um número válido.' : 'Informe um celular completo (11 dígitos: DDD + 9 + número).'}</span>}
            {clienteEncontrado && (
              <div style={{ marginTop: 6, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 12, color: '#065f46' }}>
                ✅ Cliente encontrado: <strong>{clienteEncontrado.nome}</strong>
              </div>
            )}
          </div>

          <div>
            <label className="form-label">Telefone 2 <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>— reserva</span></label>
            <input
              value={form.telefone2 || ''}
              onChange={e => set('telefone2', e.target.value.replace(/\D/g,'').slice(0,11))}
              placeholder="62999999999"
              inputMode="numeric"
              disabled={clienteLocked}
            />
          </div>

          <div>
            <label className="form-label">Nome *</label>
            <input value={form.nome} onChange={handleNomeChange} placeholder="Nome completo" style={errStyle('nome')} disabled={clienteLocked} />
            {!clienteLocked && duplicatas.length > 0 && (
              <div style={{ marginTop: 6, padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 4 }}>⚠️ Clientes parecidos encontrados:</div>
                {duplicatas.map(d => (
                  <div key={d.id} style={{ color: '#78350f', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{d.nome}</span>
                    <span style={{ color: '#9ca3af' }}>{d.telefone || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="form-label">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" disabled={clienteLocked} />
          </div>

          <div>
            <label className="form-label">Data de Entrada</label>
            <input type="date" value={form.entrada || hoje} onChange={e => set('entrada', e.target.value)} />
          </div>

          <SelectComAdd label="Aquisição" value={form.origem} onChange={v => set('origem', v)}
            options={origens} setOptions={setOrigens} chave="origens"
            isGerente={isGerente} perfil={perfil} bloqueado={origemBloqueada && !isEdit} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
            <input type="checkbox" id="is_corretor" checked={form.is_corretor || false} onChange={e => set('is_corretor', e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer', margin: 0 }} disabled={clienteLocked} />
            <label htmlFor="is_corretor" style={{ fontSize: 13, color: '#374151', cursor: 'pointer', fontWeight: 500 }}>Este cliente é corretor</label>
          </div>

          {/* TRATATIVA */}
          <div className="field-full" style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 10, marginTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tratativa</span>
          </div>

          <div>
            <label className="form-label">Corretor</label>
            {isGerente ? (
              <select value={form.corretor_id || ''} onChange={e => {
                const id = e.target.value;
                const c = corretores.find(x => String(x.id) === String(id));
                setForm(f => ({ ...f, corretor_id: id || null, corretor: c ? c.nome : '' }));
              }} style={{ width: '100%' }}>
                <option value="">— selecione —</option>
                {form.corretor && !corretores.some(c => String(c.id) === String(form.corretor_id)) && (
                  <option value={form.corretor_id || ''}>{form.corretor} (atual)</option>
                )}
                {corretores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            ) : (
              <input value={form.corretor || ''} readOnly style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
            )}
          </div>

          <SelectComAdd label="Origem da Tratativa" value={form.origem_tratativa || ''} onChange={v => set('origem_tratativa', v)}
            options={origens} setOptions={setOrigens} chave="origens"
            isGerente={isGerente} perfil={perfil} />

          <div>
            <label className="form-label">Status</label>
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
              {isVenda && (
                <button type="button" onClick={toggleCaptado}
                  title="Marca a tratativa de venda como encerrada com sucesso: o imóvel foi captado"
                  style={{ flex: 1, padding: '8px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${form.captado ? '#2563eb' : '#d1d5db'}`,
                    background: form.captado ? '#dbeafe' : '#fff',
                    color: form.captado ? '#1d4ed8' : '#6b7280' }}>
                  🏠 Captado
                </button>
              )}
            </div>
            {isVenda && form.captado && (
              <span style={{ fontSize: 11, color: '#2563eb', marginTop: 4, display: 'block' }}>
                Imóvel captado — tratativa encerrada com sucesso.
              </span>
            )}
            {isVenda && (
              <div style={{ marginTop: 12, padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>🏠 Ficha do imóvel (Estoque)</span>
                  <button type="button" onClick={organizarIA} disabled={organizandoIA}
                    style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6, cursor: organizandoIA ? 'default' : 'pointer',
                      border: '1px solid #7c3aed', background: organizandoIA ? '#ede9fe' : '#7c3aed', color: organizandoIA ? '#7c3aed' : '#fff' }}>
                    {organizandoIA ? '🤖 organizando…' : '🤖 Organizar com IA'}
                  </button>
                </div>
                <textarea
                  value={(form.ficha && form.ficha._descricao) || ''}
                  onChange={e => set('ficha', Object.assign({}, form.ficha || {}, { _descricao: e.target.value }))}
                  placeholder="Cole aqui a descrição do imóvel (do anúncio ou do proprietário). A IA usa esse texto para preencher a ficha."
                  style={{ width: '100%', minHeight: 64, fontSize: 12, padding: 8, borderRadius: 6, border: '1px solid #e5e7eb', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                {form.ficha && (
                  <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.6, marginTop: 8 }}>
                    {[
                      form.ficha.tipo,
                      form.ficha.preco ? ('R$ ' + Number(form.ficha.preco).toLocaleString('pt-BR')) : null,
                      [form.ficha.bairro, form.ficha.cidade, form.ficha.estado].filter(Boolean).join(', ') || null,
                      form.ficha.metragemTotal ? (form.ficha.metragemTotal + ' m² terreno') : (form.ficha.metragem ? (form.ficha.metragem + ' m²') : null),
                      form.ficha.quartos ? (form.ficha.quartos + ' qto') : null,
                      form.ficha.garagens ? (form.ficha.garagens + ' vaga') : null,
                      (form.ficha.condicoes && form.ficha.condicoes.length) ? form.ficha.condicoes.join(' · ') : null
                    ].filter(Boolean).join('  ·  ') || 'Ficha vazia'}
                  </div>
                )}
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '8px 0 0' }}>
                  Ao marcar <b>Captado</b>, o imóvel é criado no Estoque <b>oculto</b>. Você adiciona as fotos lá e publica.
                </p>
              </div>
            )}
          </div>

          {form.ativo === 'N' && (
            <div className="field-full" style={{ position: 'relative', zIndex: 100 }}>
              <label className="form-label">Motivo da Desistência</label>
              <input
                value={form.motivo_desistencia}
                onChange={e => { set('motivo_desistencia', e.target.value); setMotivoAberto(true); }}
                onFocus={() => setMotivoAberto(true)}
                onBlur={() => setTimeout(() => setMotivoAberto(false), 200)}
                placeholder="Por que o cliente desistiu?"
                autoComplete="off"
              />
              {motivoAberto && motivos.length > 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 9999, maxHeight: 180, overflowY: 'auto' }}>
                  {motivos
                    .filter(m => !form.motivo_desistencia || m.toLowerCase().includes((form.motivo_desistencia || '').toLowerCase()))
                    .map((m, i) => (
                      <div key={i} onMouseDown={e => { e.preventDefault(); set('motivo_desistencia', m); setMotivoAberto(false); }}
                        style={{ padding: '10px 14px', fontSize: 13, cursor: 'pointer', color: '#374151', borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        {m}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )}

          <div className="field-full">
            <label className="form-label">Modalidade *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['Compra','🛒','#059669','#dcfce7','#065f46'],['Venda','🏠','#2563eb','#dbeafe','#1d4ed8'],['Locação','🔑','#7c3aed','#ede9fe','#5b21b6']].map(([m, icon, border, bg, text]) => (
                <button key={m} type="button" onClick={() => set('modalidade', m)}
                  style={{ flex: 1, padding: '8px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${form.modalidade === m ? border : '#d1d5db'}`,
                    background: form.modalidade === m ? bg : '#fff',
                    color: form.modalidade === m ? text : '#6b7280',
                    outline: errors.modalidade ? '2px solid #dc2626' : 'none' }}>
                  {icon} {m}
                </button>
              ))}
            </div>
          </div>

          {/* Captação (Venda) */}
          {isVenda && (
            <div className="field-full" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 4 }}>🏠 Captação</div>
              <div style={{ fontSize: 12, color: '#3b82f6' }}>Imóvel a ser captado para venda. Preencha localização e observações.</div>
            </div>
          )}

          {(() => {
            const tipoSel = tipos.find(t => t.id === form.tipo_id);
            const permiteCond = !!tipoSel?.permite_condominio;
            return (
              <div>
                <label className="form-label" style={errors.tipo_id ? { color: '#dc2626' } : {}}>
                  Tipo de Imóvel{!isVenda ? ' *' : ''}
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
                  style={!isVenda ? errStyle('tipo_id') : {}}
                >
                  <option value="">Selecionar</option>
                  {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
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
            <label className="form-label" style={errors.valor ? { color: '#dc2626' } : {}}>Valor (R$) *</label>
            <input value={valorDisplay} onChange={handleValorChange} placeholder="R$ 0,00" style={errStyle('valor')} />
          </div>

          <div>
            <label className="form-label">Localização *</label>
            <input value={form.localizacao} onChange={e => set('localizacao', e.target.value)} placeholder="Região, bairro..." style={errStyle('localizacao')} />
          </div>

          <div>
            <label className="form-label">Próxima Ação</label>
            <input value={form.proxima_acao} onChange={e => set('proxima_acao', e.target.value)} placeholder="O que fazer?" />
          </div>

          <div className="field-full">
            <label className="form-label">
              Observações Internas <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>— visível só para a equipe</span>
            </label>
            <textarea rows={2} value={form.detalhes} onChange={e => set('detalhes', e.target.value)}
              placeholder="Anotações internas, perfil do cliente, situação financeira..."
              style={{ background: '#fffbeb', borderColor: '#fde68a' }} />
          </div>

          <div className="field-full">
            <label className="form-label">
              Observações Externas <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>— pode ser compartilhado</span>
            </label>
            <textarea rows={2} value={form.detalhes_externos || ''} onChange={e => set('detalhes_externos', e.target.value)}
              placeholder="Informações para enviar a parceiros ou clientes..."
              style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }} />
          </div>

          <div>
            <label className="form-label">Último Contato</label>
            <input type="date" value={form.ultimo_contato || ''} onChange={e => set('ultimo_contato', e.target.value)} />
            <button type="button" onClick={() => set('ultimo_contato', hoje)}
              style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              📌 Registrar contato hoje
            </button>
          </div>

          <div>
            <label className="form-label">Próx. Contato</label>
            <input type="date" value={form.prox_contato || ''} onChange={e => set('prox_contato', e.target.value)} />
          </div>

          {!isVenda && (
            <div>
              <label className="form-label">Imóveis Visitados</label>
              <input value={form.imoveis_visitados} onChange={e => set('imoveis_visitados', e.target.value)} />
            </div>
          )}

          {!isVenda && (
            <div className="field-full">
              <label className="form-label" style={errors.funil ? { color: '#dc2626' } : {}}>
                Etapas do Funil * {errors.funil && <span style={{ fontSize: 11 }}>— selecione pelo menos uma</span>}
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
          )}

          {!isVenda && (
            <div className="field-full">
              <button type="button" onClick={() => set('solicitar_parceria', !form.solicitar_parceria)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 8, cursor: 'pointer', width: '100%',
                  border: `2px solid ${form.solicitar_parceria ? '#7c3aed' : '#d1d5db'}`,
                  background: form.solicitar_parceria ? '#f5f3ff' : '#fff' }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${form.solicitar_parceria ? '#7c3aed' : '#d1d5db'}`, background: form.solicitar_parceria ? '#7c3aed' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {form.solicitar_parceria && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: form.solicitar_parceria ? '#7c3aed' : '#374151' }}>🤝 Solicitar Parceria</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Este imóvel aparecerá na aba Demandas</div>
                </div>
              </button>
            </div>
          )}

        </div>
        <div className="modal-footer">
          {onDelete && modal && modal.id && !modal.novaNegociacao && (
            <button className="btn btn-ghost" style={{ color: '#dc2626', marginRight: 'auto' }} onClick={async () => {
              if (!window.confirm('Excluir esta tratativa? Esta ação não pode ser desfeita.')) return;
              localStorage.removeItem('crm_rascunho');
              await onDelete(modal.id);
              onClose();
            }}>🗑️ Excluir</button>
          )}
          <button className="btn btn-ghost" onClick={() => { localStorage.removeItem('crm_rascunho'); onClose(); }}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}
