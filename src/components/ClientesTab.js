import { useState, useMemo } from 'react';

export default function ClientesTab({ clientes, negociacoes, onVerTratativas }) {
  const [search, setSearch] = useState('');

  const clientesComNeg = useMemo(() => {
    return clientes.map(c => {
      const negs = negociacoes.filter(n => n.cliente_id === c.id);
      const ativas = negs.filter(n => n.ativo === 'S').length;
      const finalizadas = negs.filter(n => n.ativo === 'N').length;
      return { ...c, totalNeg: negs.length, ativas, finalizadas };
    });
  }, [clientes, negociacoes]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clientesComNeg.filter(c =>
      !q || c.nome.toLowerCase().includes(q) ||
      (c.telefone || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  }, [clientesComNeg, search]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Clientes</h2>
        <p style={{ fontSize: 13, color: '#6b7280' }}>Base de clientes cadastrados no sistema.</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input placeholder="🔍 Buscar por nome, telefone ou email..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: 400, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
      </div>

      <div className="table-wrapper">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Nome','Telefone','Email','Aquisição','Corretor','Tratativas','Ativas','Finalizadas',''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Nenhum cliente encontrado.</td></tr>
            )}
            {filtered.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                  {c.nome}
                  {c.is_corretor && <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 10, fontSize: 10, background: '#fff7ed', color: '#c2410c', fontWeight: 600 }}>Corretor</span>}
                </td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.telefone || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.email || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.origem || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{c.corretor_padrao || '—'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontWeight: 700, color: '#2563eb' }}>{c.totalNeg}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontWeight: 600, color: '#059669' }}>{c.ativas}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ color: '#9ca3af' }}>{c.finalizadas}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button onClick={() => onVerTratativas(c.id)}
                    style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                    Ver Tratativas
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
