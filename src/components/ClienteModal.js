import { useState, useEffect } from 'react';
import { ORIGENS, TIPOS, IMOVEIS, ETAPAS_FUNIL, ETAPAS_LABEL } from '../constants';

const emptyForm = {
  nome: '', ativo: 'S', telefone: '', email: '',
  entrada: new Date().toISOString().slice(0, 10),
  origem: '', atendente: '', tipo: '', imovel: '',
  valor: '', detalhes: '', localizacao: '',
  proxima_acao: '', imoveis_visitados: '', motivo_desistencia: '',
  ultimo_contato: '', prox_contato: '', final_contato: '', prorrogacao: '',
  tratativa: false, pesquisa: false, agendamento: false, visita: false,
  proposta: false, contrato: false, financiamento: false, recebimento: false,
};

export default function ClienteModal({ cliente, onSave, onClose }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cliente) {
      setForm({ ...emptyForm, ...cliente });
    } else {
      setForm(emptyForm);
    }
  }, [cliente]);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSave() {
    if (!form.nome.trim()) return alert('Nome é obrigatório.');
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{cliente ? 'Editar Cliente' : 'Novo Cliente'}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div>
            <label className="form-label">Nome *</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <label className="form-label">Status</label>
            <select value={form.ativo} onChange={e => set('ativo', e.target.value)}>
              <option value="S">Ativo</option>
              <option value="N">Inativo</option>
            </select>
          </div>
          <div>
            <label className="form-label">Telefone</label>
            <input value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="62 9 9999-9999" />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" />
          </div>
          <div>
            <label className="form-label">Data de Entrada</label>
            <input type="date" value={form.entrada} onChange={e => set('entrada', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Atendente</label>
            <input value={form.atendente} onChange={e => set('atendente', e.target.value)} placeholder="Nome do atendente" />
          </div>
          <div>
            <label className="form-label">Origem</label>
            <select value={form.origem} onChange={e => set('origem', e.target.value)}>
              <option value="">Selecionar</option>
              {ORIGENS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Tipo</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              <option value="">Selecionar</option>
              {TIPOS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Tipo de Imóvel</label>
            <select value={form.imovel} onChange={e => set('imovel', e.target.value)}>
              <option value="">Selecionar</option>
              {IMOVEIS.map(i => <option key={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Valor (R$)</label>
            <input type="number" value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="Ex: 500000" />
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
            <input type="date" value={form.ultimo_contato} onChange={e => set('ultimo_contato', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Próx. Contato</label>
            <input type="date" value={form.prox_contato} onChange={e => set('prox_contato', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Imóveis Visitados</label>
            <input value={form.imoveis_visitados} onChange={e => set('imoveis_visitados', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Motivo Desistência</label>
            <input value={form.motivo_desistencia} onChange={e => set('motivo_desistencia', e.target.value)} />
          </div>

          <div className="field-full">
            <label className="form-label">Etapas do Funil</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {ETAPAS_FUNIL.map(e => (
                <button key={e} type="button"
                  onClick={() => set(e, !form[e])}
                  style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${form[e] ? '#059669' : '#d1d5db'}`,
                    background: form[e] ? '#d1fae5' : '#fff',
                    color: form[e] ? '#065f46' : '#6b7280',
                    transition: 'all 0.15s',
                  }}>
                  {ETAPAS_LABEL[e]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
