import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { ETAPAS_FUNIL, ETAPAS_LABEL } from '../constants';
import DetailPanel from './DetailPanel';

function getEtapaAtual(c) {
  for (let i = ETAPAS_FUNIL.length - 1; i >= 0; i--) {
    if (c[ETAPAS_FUNIL[i]]) return ETAPAS_FUNIL[i];
  }
  return null;
}

function tipoBadge(tipo) {
  const map = { Comprador: 'badge-blue', Locatário: 'badge-purple', Corretor: 'badge-orange', Investidor: 'badge-green' };
  return map[tipo] || 'badge-gray';
}

function modalidadeBadge(modalidade) {
  if (modalidade === 'Venda') return { bg: '#dbeafe', color: '#1d4ed8' };
  if (modalidade === 'Locação') return { bg: '#ede9fe', color: '#7e22ce' };
  if (modalidade === 'Compra') return { bg: '#dcfce7', color: '#065f46' };
  return { bg: '#f3f4f6', color: '#6b7280' };
}

function DropdownFilter({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = value.length > 0;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }} onClick={e => e.stopPropagation()}>
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer',
          border: `1px solid ${selected ? '#2563eb' : '#d1d5db'}`,
          background: selected ? '#eff6ff' : '#f9fafb',
          color: selected ? '#2563eb' : '#9ca3af' }}>
        ▾{selected ? ` ${value.length}` : ''}
      </button>
      {open && (
        <div style={{ position: 'fixed', zIndex: 9999, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', minWidth: 160, padding: 8 }}>
          <div onClick={() => { onChange([]); setOpen(false); }}
            style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', color: '#6b7280', borderRadius: 4, marginBottom: 2 }}
            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            Limpar filtro
          </div>
          {options.map(opt => (
            <div key={opt} onClick={() => onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])}
              style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6,
                background: value.includes(opt) ? '#eff6ff' : 'transparent',
                color: value.includes(opt) ? '#2563eb' : '#374151' }}
              onMouseEnter={e => e.currentTarget.style.background = value.includes(opt) ? '#dbeafe' : '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.background = value.includes(opt) ? '#eff6ff' : 'transparent'}>
              <span style={{ fontSize: 10, width: 10 }}>{value.includes(opt) ? '✓' : ''}</span>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CRMTab({ data, onOpenModal, onDelete, onToggleFunil, onNovaNegociacao, isGerente }) {
  const [search, setSearch] = useState('');
  const [filterOrigem, setFilterOrigem] = useState('');
  const [filterTipo, setFilterTipo] = useState([]);
  const [filterModalidade, setFilterModalidade] = useState([]);
  const [filterCorretor, setFilterCorretor] = useState([]);
  const [filterFunil, setFilterFunil] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [origens, setOrigens] = useState([]);
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    async function loadListas() {
      const { data } = await supabase.from('configuracoes').select('chave, valor');
      if (data) data.forEach(row => { if (row.chave === 'origens') setOrigens(row.valor); });
    }
    loadListas();
  }, []);

  const tiposUnicos = useMemo(() => [...new Set(data.map(c => c.tipo).filter(Boolean))].sort(), [data]);
  const modalidadesUnicas = useMemo(() => [...new Set(data.map(c => c.modalidade).filter(Boolean))].sort(), [data]);
  const corretoresUnicos = useMemo(() => [...new Set(data.map(c => c.corretor).filter(Boolean))].sort(), [data]);
  const etapasUnicas = useMemo(() => ETAPAS_FUNIL.filter(e => data.some(c => c[e])).map(e => ETAPAS_LABEL[e]), [data]);

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = data.filter(c =>
      (!q || c.nome.toLowerCase().includes(q) || (c.telefone || '').includes(q) || (c.email || '').toLowerCase().includes(q)) &&
      (!filterOrigem || c.origem === filterOrigem) &&
      (filterTipo.length === 0 || filterTipo.includes(c.tipo)) &&
      (filterModalidade.length === 0 || filterModalidade.includes(c.modalidade)) &&
      (filterCorretor.length === 0 || filterCorretor.includes(c.corretor)) &&
      (filterFunil.length === 0 || filterFunil.some(f => { const etapa = getEtapaAtual(c); return etapa && ETAPAS_LABEL[etapa] === f; }))
    );
    if (sortCol) {
      result = [...result].sort((a, b) => {
        const getVal = (c) => sortCol === 'funil'
          ? (ETAPAS_FUNIL.indexOf(getEtapaAtual(c))).toString()
          : (c[sortCol] || '').toString().toLowerCase();
        const av = getVal(a), bv = getVal(b);
        return sortDir === 'asc' ? av.localeCompare(bv, 'pt-BR') : bv.localeCompare(av, 'pt-BR');
      });
    }
    return result;
  }, [data, search, filterOrigem, filterTipo, filterModalidade, filterCorretor, filterFunil, sortCol, sortDir]);

  const selected = data.find(c => c.id === selectedId) || null;

  async function handleDelete(id) {
    await onDelete(id);
    setConfirmDelete(null);
    setSelectedId(null);
  }

  function SortTh({ col, label, children }) {
    const active = sortCol === col;
    return (
      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: active ? '#2563eb' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span onClick={() => toggleSort(col)} style={{ cursor: 'pointer' }}>{label} {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
          {children}
        </div>
      </th>
    );
  }

  return (
    <>
      <div className="toolbar">
        <input className="input-search" placeholder="🔍  Buscar por nome, telefone ou email..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input-sm" value={filterOrigem} onChange={e => setFilterOrigem(e.target.value)}>
          <option value="">Todas origens</option>
          {origens.map(o => <option key={o}>{o}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => onOpenModal('new')}>+ Novo Cliente</button>
      </div>

      <div className="layout-with-panel">
        <div className="panel-main">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <SortTh col="nome" label="Nome" />
                  <SortTh col="imovel" label="Imóvel" />
                  <SortTh col="tipo" label="Tipo">
                    <DropdownFilter options={tiposUnicos} value={filterTipo} onChange={setFilterTipo} />
                  </SortTh>
                  <SortTh col="modalidade" label="Modalidade">
                    <DropdownFilter options={modalidadesUnicas} value={filterModalidade} onChange={setFilterModalidade} />
                  </SortTh>
                  <SortTh col="valor" label="Valor" />
                  <SortTh col="corretor" label="Corretor">
                    <DropdownFilter options={corretoresUnicos} value={filterCorretor} onChange={setFilterCorretor} />
                  </SortTh>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', width: 150 }}>Localização</th>
                  <th style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', width: 150 }}>Detalhes</th>
                  <SortTh col="funil" label="Funil">
                    <DropdownFilter options={etapasUnicas} value={filterFunil} onChange={setFilterFunil} />
                  </SortTh>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={10}><div className="empty-state">Nenhum cliente encontrado.</div></td></tr>
                )}
                {filtered.map(c => {
                  const etapa = getEtapaAtual(c);
                  const modColors = modalidadeBadge(c.modalidade);
                  return (
                    <tr key={c.id} className={selectedId === c.id ? 'selected' : ''}
                      onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}>
                      <td><div className="td-name">{c.nome}</div></td>
                      <td className="td-muted">{c.imovel || '—'}</td>
                      <td>{c.tipo ? <span className={`badge ${tipoBadge(c.tipo)}`}>{c.tipo}</span> : '—'}</td>
                      <td>{c.modalidade ? <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: modColors.bg, color: modColors.color }}>{c.modalidade}</span> : '—'}</td>
                      <td style={{ fontWeight: 600, color: '#059669' }}>{c.valor ? `R$ ${Number(c.valor).toLocaleString('pt-BR')}` : '—'}</td>
                      <td className="td-muted">{c.corretor || '—'}</td>
                      <td className="td-muted" title={c.localizacao || ''} style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.localizacao || '—'}</td>
                      <td className="td-muted" title={c.detalhes || ''} style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.detalhes || '—'}</td>
                      <td>
                        {etapa ? (
                          <div style={{ minWidth: 120 }}>
                            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{ETAPAS_LABEL[etapa]}</div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 20 }}>
                              {ETAPAS_FUNIL.map((e, i) => {
                                const etapaIdx = ETAPAS_FUNIL.indexOf(etapa);
                                const ativa = i <= etapaIdx;
                                const altura = 4 + (i * (16 / (ETAPAS_FUNIL.length - 1)));
                                const intensidade = Math.round(180 - (i * (120 / (ETAPAS_FUNIL.length - 1))));
                                return (
                                  <div key={e} style={{ width: 8, borderRadius: 2, height: `${altura}px`,
                                    background: ativa ? (i === ETAPAS_FUNIL.length - 1 ? '#16a34a' : `rgb(${intensidade}, ${intensidade + 20}, 255)`) : '#e5e7eb',
                                    transition: 'all 0.2s' }} />
                                );
                              })}
                            </div>
                          </div>
                        ) : <span className="td-muted">—</span>}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => onOpenModal(c)}>Editar</button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => setConfirmDelete(c.id)}>✕</button>
                          {c.telefone && (
                            <a href={`https://wa.me/55${c.telefone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 6, background: '#25d366', textDecoration: 'none', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                              WA
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <DetailPanel
            cliente={selected}
            onEdit={c => onOpenModal(c)}
            onDelete={id => setConfirmDelete(id)}
            onToggleFunil={onToggleFunil}
            onClose={() => setSelectedId(null)}
            onNovaNegociacao={onNovaNegociacao}
          />
        )}
      </div>

      {confirmDelete && (
        <div className="modal-overlay">
          <div className="confirm-dialog">
            <div className="confirm-icon">⚠️</div>
            <div className="confirm-title">Confirmar exclusão</div>
            <div className="confirm-text">Esta ação não pode ser desfeita.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
