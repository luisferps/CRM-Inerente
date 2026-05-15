import { useState } from 'react';
import {
  DEFAULT_ORIGENS, DEFAULT_TIPOS_LEAD, DEFAULT_IMOVEIS,
  STORAGE_ORIGENS, STORAGE_TIPOS_LEAD, STORAGE_IMOVEIS,
  getList, saveList
} from '../constants';

function ListManager({ title, storageKey, defaultList }) {
  const [items, setItems] = useState(() => getList(storageKey, defaultList));
  const [newItem, setNewItem] = useState('');

  function add() {
    const val = newItem.trim();
    if (!val || items.includes(val)) return;
    const updated = [...items, val];
    setItems(updated);
    saveList(storageKey, updated);
    setNewItem('');
  }

  function remove(item) {
    const updated = items.filter(i => i !== item);
    setItems(updated);
    saveList(storageKey, updated);
  }

  function reset() {
    if (window.confirm('Restaurar lista padrão?')) {
      setItems(defaultList);
      saveList(storageKey, defaultList);
    }
  }

  return (
    <div className="dash-section" style={{ maxWidth: 420 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="dash-section-title" style={{ margin: 0 }}>{title}</div>
        <button className="btn btn-ghost btn-sm" onClick={reset}>Restaurar padrão</button>
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
        {items.map(item => (
          <div key={item} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6,
            padding: '7px 12px', fontSize: 13
          }}>
            <span>{item}</span>
            <button onClick={() => remove(item)}
              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
              ×
            </button>
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
        <p style={{ fontSize: 13, color: '#6b7280' }}>Gerencie as listas usadas nos formulários. As alterações são salvas automaticamente.</p>
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <ListManager title="Origens" storageKey={STORAGE_ORIGENS} defaultList={DEFAULT_ORIGENS} />
        <ListManager title="Tipos de Lead" storageKey={STORAGE_TIPOS_LEAD} defaultList={DEFAULT_TIPOS_LEAD} />
        <ListManager title="Tipos de Imóvel" storageKey={STORAGE_IMOVEIS} defaultList={DEFAULT_IMOVEIS} />
      </div>
    </div>
  );
}
