import { useState, useEffect, useCallback } from 'react';

const BACKEND = 'https://agentes-de-whatsapp-production.up.railway.app';

function fmtData(v) {
  if (!v) return '—';
  try { return new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return '—'; }
}
function fmtTel(t) {
  const d = String(t || '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) return '(' + d.slice(2, 4) + ') ' + d.slice(4, 9) + '-' + d.slice(9);
  if (d.length === 12 && d.startsWith('55')) return '(' + d.slice(2, 4) + ') ' + d.slice(4, 8) + '-' + d.slice(8);
  return t || '';
}

const STATUS_META = {
  pendente:     { rotulo: 'aguardando resposta', bg: '#fef3c7', cor: '#b45309' },
  disponivel:   { rotulo: '✓ disponível',        bg: '#d1fae5', cor: '#059669' },
  indisponivel: { rotulo: '✕ indisponível',      bg: '#fee2e2', cor: '#dc2626' },
  expirado:     { rotulo: 'não respondeu (72h)', bg: '#e5e7eb', cor: '#6b7280' }
};

export default function DisponibilidadeTab() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('todos');

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    try {
      const r = await fetch(BACKEND + '/disponibilidade/painel-json');
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'erro ao carregar');
      setDados(j);
    } catch (e) { setErro(e.message); }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const regs = (dados && dados.registros) || [];
  const filtrados = filtro === 'todos' ? regs : regs.filter(r => r.status === filtro);
  const c = (dados && dados.contadores) || {};

  return (
    <div style={{ padding: '4px 2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>📡 Disponibilidade</h2>
        <button onClick={carregar} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 13 }}>↻ Atualizar</button>
        {dados && (
          <span style={{ fontSize: 13, color: '#666' }}>
            últimos 60 dias · <b style={{ color: '#b45309' }}>{c.pendente || 0} aguardando</b> · <b style={{ color: '#059669' }}>{c.disponivel || 0} disponíveis</b> · <b style={{ color: '#dc2626' }}>{c.indisponivel || 0} indisponíveis</b> · {c.expirado || 0} sem resposta
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['todos', 'Todos'], ['pendente', 'Aguardando'], ['disponivel', 'Disponíveis'], ['indisponivel', 'Indisponíveis'], ['expirado', 'Sem resposta']].map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)}
            style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid ' + (filtro === k ? '#dc2626' : '#ddd'), background: filtro === k ? '#dc2626' : '#fff', color: filtro === k ? '#fff' : '#333', cursor: 'pointer', fontSize: 12.5 }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
        Cada linha é um imóvel num ciclo de verificação (a cada 15 dias o dono é perguntado — uma mensagem só, mesmo com vários imóveis).
      </div>

      {carregando && <div style={{ padding: 30, textAlign: 'center', color: '#999' }}>Carregando…</div>}
      {erro && <div style={{ padding: 14, background: '#fee2e2', color: '#dc2626', borderRadius: 8 }}>Erro: {erro}</div>}

      {!carregando && !erro && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#666', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: 8, background: '#f5f5f7' }}>Perguntado em</th>
                <th style={{ padding: 8, background: '#f5f5f7' }}>Imóvel</th>
                <th style={{ padding: 8, background: '#f5f5f7' }}>Proprietário</th>
                <th style={{ padding: 8, background: '#f5f5f7' }}>Ciclo</th>
                <th style={{ padding: 8, background: '#f5f5f7' }}>Situação</th>
                <th style={{ padding: 8, background: '#f5f5f7' }}>Preço informado</th>
                <th style={{ padding: 8, background: '#f5f5f7' }}>Respondido em</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r, i) => {
                const meta = STATUS_META[r.status] || { rotulo: r.status, bg: '#eee', cor: '#333' };
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{fmtData(r.primeira_em)}</td>
                    <td style={{ padding: 8, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>{r.titulo || r.imovel_id}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                      <a href={'https://wa.me/' + String(r.telefone || '').replace(/\D/g, '')} target="_blank" rel="noreferrer" style={{ color: '#059669', textDecoration: 'none' }}>
                        {fmtTel(r.telefone)}
                      </a>
                    </td>
                    <td style={{ padding: 8 }}>{r.ciclo}º ({r.ciclo * 15}d)</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                      <span style={{ background: meta.bg, color: meta.cor, padding: '2px 8px', borderRadius: 10, fontSize: 12 }}>{meta.rotulo}</span>
                      {r.captador_notificado && <span style={{ fontSize: 11, color: '#7c3aed', marginLeft: 6 }}>captador avisado</span>}
                    </td>
                    <td style={{ padding: 8, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.preco_informado || '—'}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{fmtData(r.respondido_em)}</td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#999' }}>Nenhum registro nesse filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
