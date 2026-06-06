import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { ETAPAS_FUNIL_COMPLETO, ETAPAS_LABEL } from '../constants';

const hoje = new Date().toISOString().slice(0, 10);

const emptyForm = {
  nome: '', telefone: '', telefone2: '', email: '', entrada: hoje,
  origem: '', is_corretor: false,
  ativo: 'S', motivo_desistencia: '',
  corretor: '', corretor_id: null,
  imovel: '', modalidade: '',
  origem_tratativa: '',
  valor: '', detalhes: '', detalhes_externos: '', localizacao: '',
  proxima_acao: '', imoveis_visitados: '',
  ultimo_contato: '', prox_contato: '', final_contato: '', prorrogacao: '',
  solicitar_parceria: false,
  tratativa: false, pesquisa: false, agendamento: false, visita: false,
  proposta: false, contrato: false, financiamento: false, recebimento: false, recebido: false,
};

function isIntl(value) { return (value || '').trim().startsWith('+'); }

function validarTel(value, intl) {
  if (!value?.trim()) return false;
  if (intl) return value.trim().length >= 8;
  return value.replace(/\D/g,'').length >= 10;
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
            {options.map(o => <option key={o}>{o}</option>)}
          </select>
          <button type="button" onClick={() => setAdding(true)} title={isGerente ? 'Adicionar' : 'Sugerir'}
            style={{ padding: '8px 12px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: isGerente ? '#2563eb' : '#f59e0b', fontSize: 16, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}>+</button>
        </div>
      )}
    </div>
  );
}

export default function ClienteModal({ modal, onSave, onClose, perfil }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [origens, setOrigens] = useState([]);
  const [imoveis, setImoveis] = useState([]);
  const [valorDisplay, setValorDisplay] = useState('');
  const [internacional, setInternacional] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [origemBloqueada, setOrigemBloqueada] = useState(false);
  const [duplicatas, setDuplicatas] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [motivoAberto, setMotivoAberto] = useState(false);
  const timerNome = useRef(null);

  // Buscar motivos já usados no banco
  useEffect(() => {
    supabase.from('negociacoes').select('motivo_desistencia').neq('motivo_desistencia', '').not('motivo_desistencia', 'is', null)
      .then(({ data }) => {
        const unicos = [...new Set((data || []).map(d => d.motivo_desistencia).filter(Boolean))].sort();
        setMotivos(unicos);
      });
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
        if (row.chave === 'imoveis') setImoveis(row.valor);
      });
    });
  }, []);

  useEffect(() => {
    setClienteEncontrado(null);
    setOrigemBloqueada(false);
    if (isEdit) {
      setForm({ ...emptyForm, ...modal });
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
      if (!form.imovel) errs.imovel = true;
      if (!ETAPAS_FUNIL_COMPLETO.some(e => form[e])) errs.funil = true;
    }
    if (!form.localizacao.trim()) errs.localizacao = true;
    if (form.valor === '' || form.valor === null || form.valor === undefined) errs.valor = true;
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); alert('Preencha todos os campos obrigatórios.'); return; }
    setSaving(true);
    await onSave({ ...form, cliente_real_id: form.cliente_real_id || clienteEncontrado?.id });
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
                disabled={isEdit}
                inputMode="numeric"
              />
              {buscando && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9ca3af' }}>🔍</span>}
            </div>
            {errors.telefone && <span style={{ fontSize: 11, color: '#dc2626', marginTop: 3, display: 'block' }}>Informe um número válido.</span>}
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
            <input value={form.corretor || ''} readOnly style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
          </div>

          <SelectComAdd label="Origem da Tratativa" value={form.origem_tratativa || ''} onChange={v => set('origem_tratativa', v)}
            options={origens} setOptions={setOrigens} chave="origens"
            isGerente={isGerente} perfil={perfil} />

          <div>
            <label className="form-label">Status</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['S','N'].map(v => (
                <button key={v} type="button" onClick={() => set('ativo', v)}
                  style={{ flex: 1, padding: '8px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${form.ativo === v ? (v === 'S' ? '#059669' : '#dc2626') : '#d1d5db'}`,
                    background: form.ativo === v ? (v === 'S' ? '#d1fae5' : '#fee2e2') : '#fff',
                    color: form.ativo === v ? (v === 'S' ? '#065f46' : '#991b1b') : '#6b7280' }}>
                  {v === 'S' ? '✓ Ativo' : '✕ Inativo'}
                </button>
              ))}
            </div>
          </div>

          {form.ativo === 'N' && (
            <div className="field-full">
              <label className="form-label">Motivo da Desistência</label>
              <input value={form.motivo_desistencia} onChange={e => set('motivo_desistencia', e.target.value)} placeholder="Por que o cliente desistiu?" />
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

          <SelectComAdd label="Tipo de Imóvel" value={form.imovel}
            onChange={v => { set('imovel', v); if (errors.imovel) setErrors(e => ({ ...e, imovel: false })); }}
            options={imoveis} setOptions={setImoveis} chave="imoveis" required={!isVenda} errStyle={!isVenda ? errStyle('imovel') : {}}
            isGerente={isGerente} perfil={perfil} />

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
          <button className="btn btn-ghost" onClick={() => { localStorage.removeItem('crm_rascunho'); onClose(); }}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}
