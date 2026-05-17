import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ETAPAS_FUNIL, ETAPAS_LABEL } from '../constants';

const hoje = new Date().toISOString().slice(0, 10);

const emptyForm = {
  // cliente
  nome: '', telefone: '', email: '', tipo: '', entrada: hoje,
  // negociacao
  ativo: 'S', motivo_desistencia: '',
  origem: '', corretor: '', corretor_id: null,
  imovel: '', modalidade: '',
  valor: '', detalhes: '', localizacao: '',
  proxima_acao: '', imoveis_visitados: '',
  ultimo_contato: '', prox_contato: '', final_contato: '', prorrogacao: '',
  tratativa: false, pesquisa: false, agendamento: false, visita: false,
  proposta: false, contrato: false, financiamento: false, recebimento: false, recebido: false,
};

function isInternacional(value) {
  return value.trim().startsWith('+');
}

function formatPhone(value, internacional) {
  if (internacional) return value;
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}

function validarTelefone(value, internacional) {
  if (!value || !value.trim()) return false;
  if (internacional) return value.trim().length >= 8;
  const digits = value.replace(/\D/g, '');
  return digits.length === 11;
}

function SelectComAdd({ label, value, onChange, options, setOptions, chave, required, errStyle }) {
  const [adding, setAdding] = useState(false);
  const [novoValor, setNovoValor] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    const v = novoValor.trim();
    if (!v) return;
    if (options.includes(v)) { onChange(v); setAdding(false); setNovoValor(''); return; }
    setSaving(true);
    const novaLista = [...options, v];
    const { error } = await supabase.from('configuracoes').upsert({ chave, valor: novaLista }, { onConflict: 'chave' });
    if (error) alert('Erro ao salvar: ' + error.message);
    else { setOptions(novaLista); onChange(v); }
    setSaving(false); setAdding(false); setNovoValor('');
  }

  return (
    <div>
      <label className="form-label">{label}{required ? ' *' : ''}</label>
      {adding ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input autoFocus value={novoValor} onChange={e => setNovoValor(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNovoValor(''); } }}
            placeholder="Nova opção..." style={{ flex: 1 }} />
          <button type="button" onClick={handleAdd} disabled={saving}
            style={{ padding: '8px 14px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? '...' : '✓'}
          </button>
          <button type="button" onClick={() => { setAdding(false); setNovoValor(''); }}
            style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={value} onChange={e => onChange(e.target.value)} style={{ flex: 1, ...(errStyle || {}) }}>
            <option value="">Selecionar</option>
            {options.map(o => <option key={o}>{o}</option>)}
          </select>
          <button type="button" onClick={() => setAdding(true)} title="Adicionar nova opção"
            style={{ padding: '8px 12px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#2563eb', fontSize: 16, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}>
            +
          </button>
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
  const [tiposLead, setTiposLead] = useState([]);
  const [imoveis, setImoveis] = useState([]);
  const [valorDisplay, setValorDisplay] = useState('');
  const [internacional, setInternacional] = useState(false);

  // Detecta o modo: novo, editar, nova negociação de cliente existente
  const isNew = modal === 'new';
  const isEdit = modal && modal.negociacao_id;
  const isNovaNeg = modal && modal.novaNegociacao;

  useEffect(() => {
    async function loadDados() {
      const { data: config } = await supabase.from('configuracoes').select('chave, valor');
      if (config) {
        config.forEach(row => {
          if (row.chave === 'origens') setOrigens(row.valor);
          if (row.chave === 'tipos_lead') setTiposLead(row.valor);
          if (row.chave === 'imoveis') setImoveis(row.valor);
        });
      }
    }
    loadDados();
  }, []);

  useEffect(() => {
    if (isEdit) {
      // Editar negociação existente
      setForm({ ...emptyForm, ...modal });
      setValorDisplay(modal.valor ? Number(modal.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '');
      setInternacional(isInternacional(modal.telefone || ''));
      localStorage.removeItem('crm_rascunho');
    } else if (isNovaNeg) {
      // Nova negociação para cliente existente — preenche dados do cliente, negociação em branco
      const c = modal.cliente;
      const initial = { ...emptyForm, nome: c.nome, telefone: c.telefone, email: c.email, tipo: c.tipo, entrada: c.entrada, cliente_real_id: c.id };
      if (perfil) { initial.corretor = perfil.nome; initial.corretor_id = perfil.id; }
      setForm(initial);
      setInternacional(isInternacional(c.telefone || ''));
      setValorDisplay('');
    } else {
      // Novo cliente + negociação
      const rascunho = localStorage.getItem('crm_rascunho');
      if (rascunho) {
        try {
          const r = JSON.parse(rascunho);
          setForm(r);
          setValorDisplay(r.valor ? Number(r.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '');
          setInternacional(isInternacional(r.telefone || ''));
        } catch { setForm(emptyForm); }
      } else {
        const initial = { ...emptyForm };
        if (perfil) { initial.corretor = perfil.nome; initial.corretor_id = perfil.id; }
        setForm(initial);
      }
    }
  }, [modal, perfil]);

  function set(key, val) {
    setForm(f => {
      const updated = { ...f, [key]: val };
      if (isNew) localStorage.setItem('crm_rascunho', JSON.stringify(updated));
      return updated;
    });
    if (errors[key]) setErrors(e => ({ ...e, [key]: false }));
  }

  function handleValorChange(e) {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) { setValorDisplay(''); set('valor', ''); return; }
    const number = parseInt(raw, 10) / 100;
    setValorDisplay(number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    set('valor', number);
  }

  function handleTelefoneChange(e) {
    const formatted = formatPhone(e.target.value, internacional);
    set('telefone', formatted);
  }

  function toggleInternacional() {
    const next = !internacional;
    setInternacional(next);
    set('telefone', '');
  }

  function validate() {
    const errs = {};
    if (!form.nome.trim()) errs.nome = true;
    if (!validarTelefone(form.telefone, internacional)) errs.telefone = true;
    if (!form.imovel) errs.imovel = true;
    if (!form.tipo) errs.tipo = true;
    if (!form.modalidade) errs.modalidade = true;
    if (!form.localizacao.trim()) errs.localizacao = true;
    if (!form.detalhes.trim()) errs.detalhes = true;
    const temEtapa = ETAPAS_FUNIL.some(e => form[e]);
    if (!temEtapa) errs.funil = true;
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      alert('Preencha todos os campos obrigatórios marcados em vermelho.');
      return;
    }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  const isInativo = form.ativo === 'N';
  const errStyle = (key) => errors[key] ? { borderColor: '#dc2626', boxShadow: '0 0 0 3px #dc262618' } : {};

  const titulo = isNovaNeg ? `Nova Negociação — ${modal.cliente?.nome}` : isEdit ? 'Editar' : 'Novo Cliente';

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{titulo}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { localStorage.removeItem('crm_rascunho'); onClose(); }}>✕</button>
        </div>
        <div className="modal-body">

          {/* ── DADOS DO CLIENTE ── */}
          <div className="field-full" style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 14, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dados do Cliente</span>
          </div>

          <div>
            <label className="form-label">Nome *</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome completo"
              style={errStyle('nome')} disabled={isNovaNeg} />
          </div>

          <div>
            <label className="form-label">Tipo de Lead *</label>
            <SelectComAdd
              label=""
              value={form.tipo}
              onChange={v => { set('tipo', v); if (errors.tipo) setErrors(e => ({ ...e, tipo: false })); }}
              options={tiposLead}
              setOptions={setTiposLead}
              chave="tipos_lead"
              required
              errStyle={errStyle('tipo')}
            />
          </div>

          <div>
            <label className="form-label">
              Telefone *
              <label style={{ marginLeft: 12, fontSize: 11, fontWeight: 400, color: '#6b7280', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={internacional} onChange={toggleInternacional} style={{ width: 'auto', margin: 0 }} />
                Internacional
              </label>
            </label>
            <input
              value={form.telefone}
              onChange={handleTelefoneChange}
              placeholder={internacional ? '+1 555 000 0000' : '(62) 9 9999-9999'}
              style={errStyle('telefone')}
              disabled={isNovaNeg}
            />
            {errors.telefone && (
              <span style={{ fontSize: 11, color: '#dc2626', marginTop: 3, display: 'block' }}>
                {internacional ? 'Digite um número válido.' : 'Nacional: (XX) X XXXX-XXXX — 11 dígitos.'}
              </span>
            )}
          </div>

          <div>
            <label className="form-label">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="email@exemplo.com" disabled={isNovaNeg} />
          </div>

          <div>
            <label className="form-label">Data de Entrada</label>
            <input type="date" value={form.entrada || hoje} onChange={e => set('entrada', e.target.value)} />
          </div>

          <div>
            <label className="form-label">Corretor</label>
            <input value={form.corretor || ''} readOnly style={{ background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }} />
          </div>

          {/* ── DADOS DA NEGOCIAÇÃO ── */}
          <div className="field-full" style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 14, marginBottom: 4, marginTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Negociação</span>
          </div>

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

          {isInativo && (
            <div className="field-full">
              <label className="form-label">Motivo da Desistência</label>
              <input value={form.motivo_desistencia} onChange={e => set('motivo_desistencia', e.target.value)} placeholder="Por que o cliente desistiu?" />
            </div>
          )}

          <SelectComAdd
            label="Origem"
            value={form.origem}
            onChange={v => set('origem', v)}
            options={origens}
            setOptions={setOrigens}
            chave="origens"
          />

          <div className="field-full">
            <label className="form-label">Modalidade *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Compra','Venda','Locação'].map((m, i) => {
                const colors = [
                  { bg: '#dcfce7', border: '#059669', text: '#065f46' },
                  { bg: '#dbeafe', border: '#2563eb', text: '#1d4ed8' },
                  { bg: '#ede9fe', border: '#7c3aed', text: '#5b21b6' },
                ];
                const c = colors[i];
                return (
                  <button key={m} type="button" onClick={() => set('modalidade', m)}
                    style={{ flex: 1, padding: '8px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${form.modalidade === m ? c.border : '#d1d5db'}`,
                      background: form.modalidade === m ? c.bg : '#fff',
                      color: form.modalidade === m ? c.text : '#6b7280',
                      outline: errors.modalidade ? '2px solid #dc2626' : 'none' }}>
                    {m === 'Compra' ? '🛒 Compra' : m === 'Venda' ? '🏠 Venda' : '🔑 Locação'}
                  </button>
                );
              })}
            </div>
          </div>

          <SelectComAdd
            label="Tipo de Imóvel"
            value={form.imovel}
            onChange={v => { set('imovel', v); if (errors.imovel) setErrors(e => ({ ...e, imovel: false })); }}
            options={imoveis}
            setOptions={setImoveis}
            chave="imoveis"
            required
            errStyle={errStyle('imovel')}
          />

          <div>
            <label className="form-label">Valor (R$)</label>
            <input value={valorDisplay} onChange={handleValorChange} placeholder="R$ 0,00" />
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
            <label className="form-label">Detalhes / Observações *</label>
            <textarea rows={2} value={form.detalhes} onChange={e => set('detalhes', e.target.value)} placeholder="Informações adicionais..." style={errStyle('detalhes')} />
          </div>

          <div>
            <label className="form-label">Último Contato</label>
            <input type="date" value={form.ultimo_contato || ''} onChange={e => set('ultimo_contato', e.target.value)} />
          </div>

          <div>
            <label className="form-label">Próx. Contato</label>
            <input type="date" value={form.prox_contato || ''} onChange={e => set('prox_contato', e.target.value)} />
          </div>

          <div>
            <label className="form-label">Imóveis Visitados</label>
            <input value={form.imoveis_visitados} onChange={e => set('imoveis_visitados', e.target.value)} />
          </div>

          <div className="field-full">
            <label className="form-label" style={errors.funil ? { color: '#dc2626' } : {}}>
              Etapas do Funil * {errors.funil && <span style={{ fontSize: 11 }}>— selecione pelo menos uma</span>}
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4, padding: errors.funil ? '8px' : '0', borderRadius: 7, border: errors.funil ? '1px solid #dc2626' : 'none' }}>
              {ETAPAS_FUNIL.map(e => (
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

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => { localStorage.removeItem('crm_rascunho'); onClose(); }}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
