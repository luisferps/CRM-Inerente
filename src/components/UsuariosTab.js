import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const FUNCOES = [
  { key: 'is_gerente', label: 'Gerente', color: '#2563eb', bg: '#eff6ff' },
  { key: 'is_corretor', label: 'Corretor', color: '#059669', bg: '#f0fdf4' },
  { key: 'is_escritorio', label: 'Escritório', color: '#7c3aed', bg: '#f5f3ff' },
];

export default function UsuariosTab() {
  const [usuarios, setUsuarios] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [sugestoes, setSugestoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [senhaTemp, setSenhaTemp] = useState('');
  const [metaModal, setMetaModal] = useState(null);
  const [metas, setMetas] = useState({});
  const [metaForm, setMetaForm] = useState({ meta_clientes: '', meta_contratos: '' });
  const [metaMes, setMetaMes] = useState(new Date().getMonth() + 1);
  const [metaAno, setMetaAno] = useState(new Date().getFullYear());
  const [savingMeta, setSavingMeta] = useState(false);
  const [realizacoes, setRealizacoes] = useState({});

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: perfisData } = await supabase.from('perfis').select('*').order('nome');
    const aprovados = (perfisData || []).filter(p => p.aprovado);
    const pend = (perfisData || []).filter(p => !p.aprovado);
    setUsuarios(aprovados);
    setPendentes(pend);

    const { data: sug } = await supabase
      .from('sugestoes_lista').select('*').eq('status', 'pendente')
      .order('created_at', { ascending: false });
    setSugestoes(sug || []);

    const corretores = aprovados.filter(p => p.is_corretor);
    if (corretores.length > 0) {
      const mesAtual = new Date().getMonth() + 1;
      const anoAtual = new Date().getFullYear();
      const ids = corretores.map(c => c.id);
      const { data: metasData } = await supabase
        .from('metas').select('*').in('corretor_id', ids).eq('mes', mesAtual).eq('ano', anoAtual);
      const metasMap = {};
      (metasData || []).forEach(m => { metasMap[m.corretor_id] = m; });
      setMetas(metasMap);

      const inicioMes = `${anoAtual}-${String(mesAtual).padStart(2,'0')}-01`;
      const fimMes = new Date(anoAtual, mesAtual, 1).toISOString().split('T')[0];
      const { data: negs } = await supabase
        .from('negociacoes').select('corretor_id, contrato, created_at')
        .in('corretor_id', ids).gte('created_at', inicioMes).lt('created_at', fimMes);
      const realMap = {};
      ids.forEach(id => { realMap[id] = { clientes: 0, contratos: 0 }; });
      (negs || []).forEach(n => {
        if (!realMap[n.corretor_id]) realMap[n.corretor_id] = { clientes: 0, contratos: 0 };
        realMap[n.corretor_id].clientes += 1;
        if (n.contrato) realMap[n.corretor_id].contratos += 1;
      });
      setRealizacoes(realMap);
    }
    setLoading(false);
  }

  async function loadMetaUsuario(userId, mes, ano) {
    const { data } = await supabase.from('metas').select('*')
      .eq('corretor_id', userId).eq('mes', mes).eq('ano', ano).single();
    setMetaForm({ meta_clientes: data?.meta_clientes ?? '', meta_contratos: data?.meta_contratos ?? '' });
  }

  async function handleSaveMeta() {
    if (!metaModal) return;
    setSavingMeta(true);
    const { error } = await supabase.from('metas').upsert({
      corretor_id: metaModal.id, mes: metaMes, ano: metaAno,
      meta_clientes: parseInt(metaForm.meta_clientes) || 0,
      meta_contratos: parseInt(metaForm.meta_contratos) || 0,
    }, { onConflict: 'corretor_id,mes,ano' });
    if (error) alert('Erro: ' + error.message);
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
    if (authErr) { alert('Erro: ' + authErr.message); setSaving(false); return; }
    const funcoes = [];
    if (form.is_gerente) funcoes.push('gerente');
    if (form.is_corretor) funcoes.push('corretor');
    if (form.is_escritorio) funcoes.push('escritorio');
    const { error } = await supabase.from('perfis').insert({
      id: authData.user.id, nome: form.nome, email: form.email,
      telefone: form.telefone || null, cpf: form.cpf || null,
      creci: form.creci || null, data_entrada: form.data_entrada || null,
      role: form.is_gerente ? 'gerente' : 'corretor',
      is_gerente: form.is_gerente || false,
      is_corretor: form.is_corretor || false,
      is_escritorio: form.is_escritorio || false,
      whatsapp_instancia: form.whatsapp_instancia || null,
      funcoes, aprovado: true,
    });
    if (error) { alert('Erro: ' + error.message); setSaving(false); return; }
    setSenhaTemp(form.senha);
    await load();
    setModal('sucesso');
    setSaving(false);
  }

  async function handleSaveEditar() {
    setSaving(true);
    const funcoes = [];
    if (form.is_gerente) funcoes.push('gerente');
    if (form.is_corretor) funcoes.push('corretor');
    if (form.is_escritorio) funcoes.push('escritorio');
    await supabase.from('perfis').update({
      nome: form.nome, telefone: form.telefone || null,
      cpf: form.cpf || null, creci: form.creci || null,
      data_entrada: form.data_entrada || null,
      is_gerente: form.is_gerente || false,
      is_corretor: form.is_corretor || false,
      is_escritorio: form.is_escritorio || false,
      role: form.is_gerente ? 'gerente' : 'corretor',
      whatsapp_instancia: form.whatsapp_instancia || null,
      funcoes,
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

  async function aprovarSugestao(sug) {
    const { data: config } = await supabase.from('configuracoes').select('valor').eq('chave', sug.chave).single();
    const lista = config?.valor || [];
    if (!lista.includes(sug.valor)) {
      await supabase.from('configuracoes').upsert({ chave: sug.chave, valor: [...lista, sug.valor] }, { onConflict: 'chave' });
    }
    await supabase.from('sugestoes_lista').update({ status: 'aprovado' }).eq('id', sug.id);
    await load();
  }

  async function rejeitarSugestao(id) {
    await supabase.from('sugestoes_lista').update({ status: 'rejeitado' }).eq('id', id);
    await load();
  }

  function BarraMeta({ realizado, meta }) {
    if (!meta) return <span style={{ fontSize: 11, color: '#9ca3af' }}>Sem meta</span>;
    const pct = Math.min(100, Math.round((realizado / meta) * 100));
    const cor = pct >= 100 ? '#059669' : pct >= 60 ? '#f59e0b' : '#ef4444';
    return (
      <div style={{ minWidth: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
          <span style={{ color: cor, fontWeight: 600 }}>{realizado}/{meta}</span>
          <span style={{ color: '#9ca3af' }}>{pct}%</span>
        </div>
        <div style={{ background: '#e5e7eb', borderRadius: 99, height: 5 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: cor, borderRadius: 99 }} />
        </div>
      </div>
    );
  }

  const anoAtual = new Date().getFullYear();
  const anos = [anoAtual - 1, anoAtual, anoAtual + 1];

  // Campo de instância reutilizável
  function CampoInstancia() {
    return (
      <div style={{ gridColumn: '1/-1' }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>
          Instância WhatsApp (WA Scheduler)
        </label>
        <input
          type="text"
          value={form.whatsapp_instancia || ''}
          onChange={e => setForm(f => ({ ...f, whatsapp_instancia: e.target.value }))}
          placeholder="Ex: minha-empresa ou Luis Fernando"
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}
        />
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          Nome exato da instância cadastrada no Evolution Manager
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Sugestões */}
      {sugestoes.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 12 }}>
            💡 Sugestões de lista pendentes ({sugestoes.length})
          </div>
          {sugestoes.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1px solid #fde68a', borderRadius: 7, padding: '10px 14px', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{s.valor}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {s.chave === 'origens' ? 'Origem' : s.chave === 'imoveis' ? 'Tipo de Imóvel' : s.chave} · por {s.sugerido_por_nome}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => aprovarSugestao(s)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✓ Aprovar</button>
                <button onClick={() => rejeitarSugestao(s.id)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✕ Rejeitar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0369a1', marginBottom: 12 }}>
            ⏳ Cadastros pendentes ({pendentes.length})
          </div>
          {pendentes.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1px solid #bae6fd', borderRadius: 7, padding: '10px 14px', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.nome}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{p.email} · CRECI: {p.creci || '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => aprovar(p.id)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✓ Aprovar</button>
                <button onClick={() => rejeitar(p.id)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✕ Rejeitar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Usuários do Sistema</h2>
        <button className="btn btn-primary" onClick={() => { setForm({ is_corretor: true }); setModal('new'); }}>+ Novo Usuário</button>
      </div>

      {loading ? <div className="loading">Carregando...</div> : (
        <div className="table-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Nome','Email','Funções','CRECI','Instância WA','Meta Tratativas','Meta Contratos','Ações'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Nenhum usuário cadastrado.</td></tr>
              )}
              {usuarios.map(u => {
                const meta = metas[u.id];
                const real = realizacoes[u.id] || { clientes: 0, contratos: 0 };
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{u.nome}</td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {FUNCOES.filter(f => u[f.key]).map(f => (
                          <span key={f.key} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: f.bg, color: f.color, border: `1px solid ${f.color}30` }}>
                            {f.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>{u.creci || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {u.whatsapp_instancia
                        ? <span style={{ fontSize: 12, background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>
                            💬 {u.whatsapp_instancia}
                          </span>
                        : <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
                      }
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {u.is_corretor ? <BarraMeta realizado={real.clientes} meta={meta?.meta_clientes} /> : <span style={{ color: '#d1d5db', fontSize: 12 }}>N/A</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {u.is_corretor ? <BarraMeta realizado={real.contratos} meta={meta?.meta_contratos} /> : <span style={{ color: '#d1d5db', fontSize: 12 }}>N/A</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {u.is_corretor && (
                          <button onClick={() => { setMetaModal(u); setMetaMes(new Date().getMonth()+1); setMetaAno(new Date().getFullYear()); loadMetaUsuario(u.id, new Date().getMonth()+1, new Date().getFullYear()); }}
                            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                            🎯 Meta
                          </button>
                        )}
                        <button onClick={() => { setForm({ ...u }); setModal(u); }}
                          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                          Editar
                        </button>
                        <button onClick={() => setConfirmDelete(u.id)}
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

      {/* Modal Meta */}
      {metaModal && (
        <div className="modal-overlay">
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🎯 Definir Meta</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>{metaModal.nome}</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Mês</label>
                <select value={metaMes} onChange={e => { setMetaMes(+e.target.value); loadMetaUsuario(metaModal.id, +e.target.value, metaAno); }}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }}>
                  {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Ano</label>
                <select value={metaAno} onChange={e => { setMetaAno(+e.target.value); loadMetaUsuario(metaModal.id, metaMes, +e.target.value); }}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13 }}>
                  {anos.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Meta de Tratativas</label>
                <input type="number" min="0" value={metaForm.meta_clientes} onChange={e => setMetaForm(f => ({ ...f, meta_clientes: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Meta de Contratos</label>
                <input type="number" min="0" value={metaForm.meta_contratos} onChange={e => setMetaForm(f => ({ ...f, meta_contratos: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setMetaModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveMeta} disabled={savingMeta}>{savingMeta ? 'Salvando...' : 'Salvar Meta'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo usuário */}
      {modal === 'new' && (
        <div className="modal-overlay">
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 520, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Novo Usuário</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[['nome','Nome *','text'],['email','Email *','email'],['senha','Senha *','password'],['telefone','Telefone','text'],['cpf','CPF','text'],['creci','CRECI','text'],['data_entrada','Data de Entrada','date']].map(([k,l,t]) => (
                <div key={k} style={{ gridColumn: ['nome','email','senha'].includes(k) ? '1/-1' : 'auto' }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>{l}</label>
                  <input type={t} value={form[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              ))}
              <CampoInstancia />
            </div>
            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 10 }}>Funções *</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {FUNCOES.map(f => (
                  <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 12px', borderRadius: 8, border: `1px solid ${form[f.key] ? f.color : '#d1d5db'}`, background: form[f.key] ? f.bg : '#fff' }}>
                    <input type="checkbox" checked={form[f.key] || false} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.checked }))} style={{ margin: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: form[f.key] ? f.color : '#6b7280' }}>{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveNovo} disabled={saving}>{saving ? 'Criando...' : 'Criar Usuário'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal sucesso */}
      {modal === 'sucesso' && (
        <div className="modal-overlay">
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Usuário criado!</div>
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
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Editar Usuário</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[['nome','Nome'],['telefone','Telefone'],['cpf','CPF'],['creci','CRECI'],['data_entrada','Data Entrada']].map(([k,l]) => (
                <div key={k} style={{ gridColumn: k === 'nome' ? '1/-1' : 'auto' }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>{l}</label>
                  <input type={k === 'data_entrada' ? 'date' : 'text'} value={form[k] || ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              ))}
              <CampoInstancia />
            </div>
            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 10 }}>Funções</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {FUNCOES.map(f => (
                  <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 12px', borderRadius: 8, border: `1px solid ${form[f.key] ? f.color : '#d1d5db'}`, background: form[f.key] ? f.bg : '#fff' }}>
                    <input type="checkbox" checked={form[f.key] || false} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.checked }))} style={{ margin: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: form[f.key] ? f.color : '#6b7280' }}>{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveEditar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay">
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Confirmar exclusão</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>O usuário será removido do sistema.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function CampoInstancia() {
    return (
      <div style={{ gridColumn: '1/-1' }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>
          💬 Instância WhatsApp (WA Scheduler)
        </label>
        <input
          type="text"
          value={form.whatsapp_instancia || ''}
          onChange={e => setForm(f => ({ ...f, whatsapp_instancia: e.target.value }))}
          placeholder="Ex: minha-empresa ou Luis Fernando"
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}
        />
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          Nome exato da instância cadastrada no Evolution Manager
        </div>
      </div>
    );
  }
}
