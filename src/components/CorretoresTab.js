import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function CorretoresTab() {
  const [corretores, setCorretores] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [senhaTemp, setSenhaTemp] = useState('');

  // Metas
  const [metaModal, setMetaModal] = useState(null); // corretor obj
  const [metas, setMetas] = useState({}); // { [corretor_id]: { meta_clientes, meta_contratos } }
  const [metaForm, setMetaForm] = useState({ meta_clientes: '', meta_contratos: '' });
  const [metaMes, setMetaMes] = useState(new Date().getMonth() + 1);
  const [metaAno, setMetaAno] = useState(new Date().getFullYear());
  const [savingMeta, setSavingMeta] = useState(false);

  // Realizações do mês atual
  const [realizacoes, setRealizacoes] = useState({}); // { [corretor_id]: { clientes, contratos } }

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('perfis').select('*').eq('role', 'corretor').order('nome');
    const aprovados = (data || []).filter(c => c.aprovado);
    setCorretores(aprovados);
    setPendentes((data || []).filter(c => !c.aprovado));

    // Carregar metas do mês atual
    const mesAtual = new Date().getMonth() + 1;
    const anoAtual = new Date().getFullYear();
    if (aprovados.length > 0) {
      const ids = aprovados.map(c => c.id);
      const { data: metasData } = await supabase
        .from('metas')
        .select('*')
        .in('corretor_id', ids)
        .eq('mes', mesAtual)
        .eq('ano', anoAtual);

      const metasMap = {};
      (metasData || []).forEach(m => { metasMap[m.corretor_id] = m; });
      setMetas(metasMap);

      // Carregar realizações: clientes cadastrados no mês
      const inicioMes = `${anoAtual}-${String(mesAtual).padStart(2,'0')}-01`;
      const fimMes = new Date(anoAtual, mesAtual, 1).toISOString().split('T')[0];
      const { data: clientes } = await supabase
        .from('clientes')
        .select('corretor_id, contrato, created_at')
        .in('corretor_id', ids)
        .gte('created_at', inicioMes)
        .lt('created_at', fimMes);

      const realMap = {};
      ids.forEach(id => { realMap[id] = { clientes: 0, contratos: 0 }; });
      (clientes || []).forEach(c => {
        if (!realMap[c.corretor_id]) realMap[c.corretor_id] = { clientes: 0, contratos: 0 };
        realMap[c.corretor_id].clientes += 1;
        if (c.contrato) realMap[c.corretor_id].contratos += 1;
      });
      setRealizacoes(realMap);
    }

    setLoading(false);
  }

  async function loadMetaCorretor(corretorId, mes, ano) {
    const { data } = await supabase
      .from('metas')
      .select('*')
      .eq('corretor_id', corretorId)
      .eq('mes', mes)
      .eq('ano', ano)
      .single();
    setMetaForm({
      meta_clientes: data?.meta_clientes ?? '',
      meta_contratos: data?.meta_contratos ?? '',
    });
  }

  async function handleSaveMeta() {
    if (!metaModal) return;
    setSavingMeta(true);
    const payload = {
      corretor_id: metaModal.id,
      mes: metaMes,
      ano: metaAno,
      meta_clientes: parseInt(metaForm.meta_clientes) || 0,
      meta_contratos: parseInt(metaForm.meta_contratos) || 0,
    };
    const { error } = await supabase.from('metas').upsert(payload, { onConflict: 'corretor_id,mes,ano' });
    if (error) alert('Erro ao salvar meta: ' + error.message);
    else { await load(); setMetaModal(null); }
    setSavingMeta(false);
  }

  async function aprovar(id) {
    await supabase.from('perfis').update({ aprovado: true }).eq('id', id);
    await load();
  }

  async function rejeitar(id) {
    if (!window.confirm('Rejeitar e remover este cadastro?')) return;
    await supabase.from('perfis').delete().eq('id', id);
    await load();
  }

  async function handleSaveNovo() {
    if (!form.nome || !form.email || !form.senha) return alert('Nome, email e senha são obrigatórios.');
    if (form.senha.length < 6) return alert('Senha deve ter pelo menos 6 caracteres.');
    setSaving(true);
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: form.email, password: form.senha, email_confirm: true,
    });
    if (authErr) { alert('Erro ao criar usuário: ' + authErr.message); setSaving(false); return; }
    const { error } = await supabase.from('perfis').insert({
      id: authData.user.id, nome: form.nome, email: form.email,
      telefone: form.telefone || null, cpf: form.cpf || null,
      creci: form.creci || null, data_entrada: form.data_entrada || null,
      role: 'corretor', aprovado: true,
    });
    if (error) { alert('Erro: ' + error.message); setSaving(false); return; }
    setSenhaTemp(form.senha);
    await load();
    setModal('sucesso');
    setSaving(false);
  }

  async function handleSaveEditar() {
    setSaving(true);
    await supabase.from('perfis').update({
      nome: form.nome, telefone: form.telefone || null,
      cpf: form.cpf || null, creci: form.creci || null,
      data_entrada: form.data_entrada || null,
    }).eq('id', modal.id);
    await load();
    setModal(null);
    setSaving(false);
  }

  async function handleDelete(id) {
    await supabase.from('perfis').delete().eq('id', id);
    await load();
    setConfirmDelete(null);
  }

  function BarraMeta({ realizado, meta, cor }) {
    if (!meta) return <span style={{ fontSize: 11, color: '#9ca3af' }}>Sem meta</span>;
    const pct = Math.min(100, Math.round((realizado / meta) * 100));
    const cor2 = pct >= 100 ? '#059669' : pct >= 60 ? '#f59e0b' : '#ef4444';
    return (
      <div style={{ minWidth: 120 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
          <span style={{ color: cor2, fontWeight: 600 }}>{realizado}/{meta}</span>
          <span style={{ color: '#9ca3af' }}>{pct}%</span>
        </div>
        <div style={{ background: '#e5e7eb', borderRadius: 99, height: 6 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: cor2, borderRadius: 99, transition: 'width 0.4s' }} />
        </div>
      </div>
    );
  }

  const anoAtual = new Date().getFullYear();
  const anos = [anoAtual - 1, anoAtual, anoAtual + 1];

  return (
    <div>
      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 12 }}>
            ⏳ Solicitações pendentes ({pendentes.length})
          </div>
          {pendentes.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1px solid #fde68a', borderRadius: 7, padding: '10px 14px', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nome}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{c.email} · CRECI: {c.creci || '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => aprovar(c.id)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✓ Aprovar</button>
                <button onClick={() => rejeitar(c.id)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✕ Rejeitar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Corretores Ativos</h2>
        <button className="btn btn-primary" onClick={() => { setForm({ senha: '' }); setModal('new'); }}>+ Novo Corretor</button>
      </div>

      {/* Tabela */}
      {loading ? <div className="loading">Carregando...</div> : (
        <div className="table-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Nome','Email','Telefone','CRECI','Meta Clientes','Meta Contratos','Ações'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corretores.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Nenhum corretor cadastrado.</td></tr>
              )}
              {corretores.map(c => {
                const meta = metas[c.id];
                const real = realizacoes[c.id] || { clientes: 0, contratos: 0 };
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{c.nome}</td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.email}</td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.telefone || '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.creci || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <BarraMeta realizado={real.clientes} meta={meta?.meta_clientes} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <BarraMeta realizado={real.contratos} meta={meta?.meta_contratos} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => { setMetaModal(c); setMetaMes(new Date().getMonth()+1); setMetaAno(new Date().getFullYear()); loadMetaCorretor(c.id, new Date().getMonth()+1, new Date().getFullYear()); }}
                          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                          🎯 Meta
                        </button>
                        <button onClick={() => { setForm({ ...c }); setModal(c); }}
                          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                          Editar
                        </button>
                        <button onClick={() => setConfirmDelete(c.id)}
                          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fee2e2', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Meta */}
      {metaModal && (
        <div className="modal-overlay">
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🎯 Definir Meta</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>{metaModal.nome}</div>

            {/* Seletor de mês/ano */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Mês</label>
                <select
                  value={metaMes}
                  onChange={e => { setMetaMes(+e.target.value); loadMetaCorretor(metaModal.id, +e.target.value, metaAno); }}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }}
                >
                  {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Ano</label>
                <select
                  value={metaAno}
                  onChange={e => { setMetaAno(+e.target.value); loadMetaCorretor(metaModal.id, metaMes, +e.target.value); }}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }}
                >
                  {anos.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Meta de Clientes</label>
                <input
                  type="number" min="0" value={metaForm.meta_clientes}
                  onChange={e => setMetaForm(f => ({ ...f, meta_clientes: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Meta de Contratos</label>
                <input
                  type="number" min="0" value={metaForm.meta_contratos}
                  onChange={e => setMetaForm(f => ({ ...f, meta_contratos: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setMetaModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveMeta} disabled={savingMeta}>
                {savingMeta ? 'Salvando...' : 'Salvar Meta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo corretor */}
      {modal === 'new' && (
        <div className="modal-overlay">
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 520, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Novo Corretor</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[['nome','Nome *','text'],['email','Email *','email'],['senha','Senha *','password'],['telefone','Telefone','text'],['cpf','CPF','text'],['creci','CRECI','text'],['data_entrada','Data de Entrada','date']].map(([k,l,t]) => (
                <div key={k} style={{ gridColumn: ['nome','email','senha'].includes(k) ? '1/-1' : 'auto' }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>{l}</label>
                  <input type={t} value={form[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, padding: '10px 14px', fontSize: 12, color: '#1d4ed8', marginTop: 14 }}>
              ℹ️ O corretor já terá acesso imediato com o email e senha cadastrados.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveNovo} disabled={saving}>{saving ? 'Criando...' : 'Criar Corretor'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal sucesso */}
      {modal === 'sucesso' && (
        <div className="modal-overlay">
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Corretor criado!</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Repasse as credenciais ao corretor:</div>
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px', textAlign: 'left', fontSize: 13, marginBottom: 20 }}>
              <div><strong>Email:</strong> {form.email}</div>
              <div><strong>Senha:</strong> {senhaTemp}</div>
            </div>
            <button className="btn btn-primary" onClick={() => setModal(null)}>Fechar</button>
          </div>
        </div>
      )}

      {/* Modal editar */}
      {modal && modal !== 'new' && modal !== 'sucesso' && (
        <div className="modal-overlay">
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 480, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Editar Corretor</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[['nome','Nome'],['telefone','Telefone'],['cpf','CPF'],['creci','CRECI'],['data_entrada','Data Entrada']].map(([k,l]) => (
                <div key={k} style={{ gridColumn: k === 'nome' ? '1/-1' : 'auto' }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>{l}</label>
                  <input type={k === 'data_entrada' ? 'date' : 'text'} value={form[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveEditar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar exclusão */}
      {confirmDelete && (
        <div className="modal-overlay">
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Confirmar exclusão</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>O corretor será removido do sistema.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
