import React, { useState, useEffect, useCallback } from 'react';

const BACKEND = 'https://agentes-de-whatsapp-production.up.railway.app';

function fmtData(ms) {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return '—'; }
}
function fmtTel(t) {
  const d = String(t || '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) return '(' + d.slice(2, 4) + ') ' + d.slice(4, 9) + '-' + d.slice(9);
  if (d.length === 12 && d.startsWith('55')) return '(' + d.slice(2, 4) + ') ' + d.slice(4, 8) + '-' + d.slice(8);
  return t || '';
}

export default function LeadsPortalTab() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('todos'); // todos | sem_resposta | respondeu

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    try {
      const r = await fetch(BACKEND + '/leads/lista-json');
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'erro ao carregar');
      setDados(j);
    } catch (e) { setErro(e.message); }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const leads = (dados && dados.leads) || [];
  const filtrados = leads.filter(l => {
    if (filtro === 'sem_resposta') return !l.respondeu;
    if (filtro === 'respondeu') return l.respondeu;
    return true;
  });

  return (
    <div style={{ padding: '4px 2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>📥 Leads de portal</h2>
        <button onClick={carregar} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 13 }}>↻ Atualizar</button>
        {dados && (
          <span style={{ fontSize: 13, color: '#666' }}>
            {dados.total} lead(s) · <b style={{ color: '#dc2626' }}>{dados.sem_resposta} sem resposta</b> · últimos 30 dias
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['todos', 'Todos'], ['sem_resposta', 'Sem resposta'], ['respondeu', 'Responderam']].map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)}
            style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid ' + (filtro === k ? '#dc2626' : '#ddd'), background: filtro === k ? '#dc2626' : '#fff', color: filtro === k ? '#fff' : '#333', cursor: 'pointer', fontSize: 12.5 }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
        Se um lead que chegou no e-mail não aparece aqui, a automação/leitor não entregou.
      </div>

      {carregando && <div style={{ padding: 30, textAlign: 'center', color: '#999' }}>Carregando…</div>}
      {erro && <div style={{ padding: 14, background: '#fee2e2', color: '#dc2626', borderRadius: 8 }}>Erro: {erro}</div>}

      {!carregando && !erro && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#666', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: 8, background: '#f5f5f7' }}>Quando</th>
                <th style={{ padding: 8, background: '#f5f5f7' }}>Nome</th>
                <th style={{ padding: 8, background: '#f5f5f7' }}>WhatsApp</th>
                <th style={{ padding: 8, background: '#f5f5f7' }}>Origem</th>
                <th style={{ padding: 8, background: '#f5f5f7' }}>Interesse</th>
                <th style={{ padding: 8, background: '#f5f5f7' }}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{fmtData(l.quando)}</td>
                  <td style={{ padding: 8, fontWeight: 600 }}>{l.nome || '—'}</td>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                    <a href={'https://wa.me/' + String(l.telefone || '').replace(/\D/g, '')} target="_blank" rel="noreferrer" style={{ color: '#059669', textDecoration: 'none' }}>
                      {fmtTel(l.telefone)}
                    </a>
                  </td>
                  <td style={{ padding: 8 }}>{l.origem || '—'}</td>
                  <td style={{ padding: 8, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>{(l.interesse || '').slice(0, 70)}</td>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                    {l.respondeu
                      ? <span style={{ background: '#d1fae5', color: '#059669', padding: '2px 8px', borderRadius: 10, fontSize: 12 }}>✓ respondeu</span>
                      : <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: 10, fontSize: 12 }}>sem resposta</span>}
                    {l.corretor_avisado && <span style={{ fontSize: 11, color: '#7c3aed', marginLeft: 6 }}>corretor avisado</span>}
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: '#999' }}>Nenhum lead nesse filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
