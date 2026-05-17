import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ETAPAS_FUNIL, ETAPAS_LABEL } from '../constants';

const emptyForm = {
  nome: '', ativo: 'S', motivo_desistencia: '',
  telefone: '', email: '',
  entrada: new Date().toISOString().slice(0, 10),
  origem: '', atendente: '', tipo: '', imovel: '', modalidade: '',
  valor: '', detalhes: '', localizacao: '',
  proxima_acao: '', imoveis_visitados: '',
  ultimo_contato: '', prox_contato: '', final_contato: '', prorrogacao: '',
  tratativa: false, pesquisa: false, agendamento: false, visita: false,
  proposta: false, contrato: false, financiamento: false, recebimento: false,
  recebido: false,
};

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}

function cleanDate(val) {
  if (!val || String(val).trim() === '') return null;
  return val;
}

export default function ClienteModal({ cliente, onSave, onClose }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [origens, setOrigens] = useState([]);
  const [tiposLead, setTiposLead] = useState([]);
  const [imoveis, setImoveis] = useState([]);

  useEffect(() => {
    async function loadListas() {
      const { data } = await supabase.from('configuracoes').select('chave, valor');
      if (data) {
        data.forEach(row => {
          if (row.chave === 'origens') setOrigens(row.valor);
          if (row.chave === 'tipos_lead') setTiposLead(row.valor);
          if (row.chave === 'imoveis') setImoveis(row.valor);
        });
      }
    }
    loadListas();
  }, []);

  useEffect(() => {
    if (cliente) {
      setForm({ ...emptyForm, ...cliente });
      localStorage.removeItem('crm_rascunho');
    } else {
      const rascunho = localStorage.getItem('crm_rascunho');
      if (rascunho) {
        try { setForm(JSON.parse(rascunho)); } catch { setForm(emptyForm); }
      } else {
        setForm(emptyForm);
      }
    }
  }, [cliente]);

  function set(key, val) {
    setForm(f => {
      const updated = { ...f, [key]: val };
      if (!cliente) localStorage.setItem('crm_rascunho', JSON.stringify(updated));
      return updated;
    });
  }

  async function handleSave() {
    if (!form.nome.trim()) return alert('Nome é obrigatório.');
    setSaving(true);
    const payload = {
      ...form,
      entrada: cleanDate(form.entrada),
      ultimo_contato: cleanDate(form.ultimo_contato),
      prox_contato: cleanDate(form.prox_contato),
      final_contato: cleanDate(form.final_contato),
      motivo_desistencia: form.ativo === 'S' ? '' : form.motivo_desistencia,
      valor: form.valor === '' || form.valor === null || form.valor === undefined ? null : Number(form.valor),
    };
   await onSave({ ...payload, id: cliente?.id || null });
    localStorage.removeItem('crm_rascunho');
    setSaving(false);
  }

  const isInativo = form.ativo === 'N';

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{cliente ? 'Editar Cliente' : 'Novo Cliente'}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { localStorage.removeItem('crm_rascunho'); onClose(); }}>✕</button>
        </div>
        <div className="modal-body">
          <div>
            <label className="form-label">Nome *</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <label className="form-label">Status</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['S','N'].map(v => (
                <button key={v} type="button" onClick={() => set('ativo', v)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${form.ativo === v ? (v === 'S' ? '#059669' : '#dc2626') : '#d1d5db'}`,
                    background: form.ativo === v ? (v === 'S' ? '#d1fae5' : '#fee2e2') : '#fff',
                    color: form.ativo === v ? (v === 'S' ? '#065f46' : '#991b1b') : '#6b7280',
                  }}>
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
          <div>
            <label className="form-label">Telefone</label>
            <input value={form.telefone} onChange={e => set('telefone', formatPhone(e.target.value))} placeholder="(62) 9 9999-9999" />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" />
          </div>
          <div>
            <label className="form-label">Data de Entrada</label>
            <input type="date" value={form.entrada || ''} onChange={e => set('entrada', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Atendente</label>
            <input value={form.atendente} onChange={e => set('atendente', e.target.value)} placeholder="Nome do atendente" />
          </div>
          <div>
            <label className="form-label">Origem</label>
            <select value={form.origem} onChange={e => set('origem', e.target.value)}>
              <option value="">Selecionar</option>
              {origens.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Tipo de Lead</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              <option value="">Selecionar</option>
              {tiposLead.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Modalidade</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Venda','Locação'].map(m => (
                <button key={m} type="button" onClick={() => set('modalidade', m)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${form.modalidade === m ? '#2563eb' : '#d1d5db'}`,
                    background: form.modalidade === m ? '#eff6ff' : '#fff',
                    color: form.modalidade === m ? '#1d4ed8' : '#6b7280',
                  }}>
                  {m === 'Venda' ? '🏠 Venda' : '🔑 Locação'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label">Tipo de Imóvel</label>
            <select value={form.imovel} onChange={e => set('imovel', e.target.value)}>
              <option value="">Selecionar</option>
              {imoveis.map(i => <option key={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Valor (R$)</label>
            <input type="number" value={form.valor || ''} onChange={e => set('valor', e.target.value)} placeholder="Ex: 500000" />
          </div>
          <div>
            <label className="form-label">Localização</label>
            <input value={form.localizacao} onChange={e => set('localizacao', e.target.value)} placeholder="Região, bairro..." />
          </div>
          <div>
            <label className="form-label">Próxima Ação</label>
            <input value={form.proxima_acao} onChange={e => set('proxima_acao', e.target.value)} placeholder="O que fazer?" />
          </div>
          <div className="field-full">
            <label className="form-label">Detalhes / Observações</label>
            <textarea rows={2} value={form.detalhes} onChange={e => set('detalhes', e.target.value)} placeholder="Informações adicionais..." />
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
            <label className="form-label">Etapas do Funil</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {ETAPAS_FUNIL.map(e => (
                <button key={e} type="button" onClick={() => set(e, !form[e])}
                  style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${form[e] ? '#059669' : '#d1d5db'}`,
                    background: form[e] ? '#d1fae5' : '#fff',
                    color: form[e] ? '#065f46' : '#6b7280',
                  }}>
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
