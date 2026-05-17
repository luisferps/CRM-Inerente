import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const CHAVES = {
  origens: 'Origens',
  tipos_lead: 'Tipos de Lead',
  imoveis: 'Tipos de Imóvel',
};

function ListManager({ chave, title }) {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editingVal, setEditingVal] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('configuracoes').select('valor').eq('chave', chave).single();
      if (data) setItems([...data.valor].sort((a, b) => a.localeCompare(b, 'pt-BR')));
      setLoading(false);
    }
    load();
  }, [chave]);

  async function save(updated) {
    const sorted = [...updated].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    await supabase.from('configuracoes').update({ valor: sorted }).eq('chave', chave);
    setItems(sorted);
  }

  async function add() {
    const val = newItem.trim();
    if (!val) return alert('Digite um item antes de adicionar.');
    if (items.includes(val)) return alert('Item já existe na lista.');
    await save([...items, val]);
    setNewItem('');
  }

  async function remove(item) {
    if (!window.confirm(`Remover "${item}"?`)) return;
    await save(items.filter(i => i !== item));
  }

  function startEdit(idx) {
    setEditingIdx(idx);
    setEditingVal(items[idx]);
  }

  async function saveEdit(idx) {
    const val = editingVal.trim();
    if (!val) return;
    if (items.includes(val) && val !== items[idx]) return alert('Item já existe.');
    const updated = items.map((item, i) => i === idx ? val : item);
    await save(updated);
    setEditingIdx(null);
  }

  if (loading) return <div className="dash-section" style={{ maxWidth: 420 }}>Carregando...</div>;

  return (
    <div className="dash-section" style={{ maxWidth: 420 }}>
      <div style={{ marginBottom: 14 }}>
        <div className="dash-section-title" style={{ margin: 0 }}>{title}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Novo item..."
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary btn-sm" onClick={add}>+ Adicionar</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.length === 0 && (
          <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 12 }}>Nenhum item.</div>
        )}
        {items.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px' }}>
            {editingIdx === idx ? (
              <>
                <input
                  value={editingVal}
                  onChange={e => setEditingVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveEdit(idx)}
                  style={{ flex: 1, padding: '4px 8px', fontSize: 13, border: '1px solid #2563eb', borderRadius: 5 }}
                  autoFocus
                />
                <button onClick={() => saveEdit(idx)} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>✓</button>
                <button onClick={() => setEditingIdx(null)} style={{ background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 5, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>✕</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 13 }}>{item}</span>
                <button onClick={() => startEdit(idx)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14 }}>✏️</button>
                <button onClick={() => remove(item)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}>×</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ConfigTab() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>Configurações</h2>
        <p style={{ fontSize: 13, color: '#6b7280' }}>Gerencie as listas usadas nos formulários. Ordenadas alfabeticamente.</p>
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {Object.entries(CHAVES).map(([chave, title]) => (
          <ListManager key={chave} chave={chave} title={title} />
        ))}
      </div>
    </div>
  );
}
