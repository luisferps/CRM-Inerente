import { useState } from 'react';
import { supabase } from '../supabaseClient';

function toCSV(data) {
  if (!data.length) return '';
  const cols = Object.keys(data[0]);
  const header = cols.join(';');
  const rows = data.map(row =>
    cols.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(';') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
    }).join(';')
  );
  return [header, ...rows].join('\n');
}

function downloadCSV(filename, csv) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function BackupTab() {
  const [loading, setLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState(localStorage.getItem('crm_last_backup') || null);

  async function handleBackup() {
    setLoading(true);
    try {
      const [
        { data: clientes },
        { data: negociacoes },
        { data: perfis },
        { data: config },
      ] = await Promise.all([
        supabase.from('clientes').select('*').order('created_at', { ascending: false }),
        supabase.from('negociacoes').select('*').order('created_at', { ascending: false }),
        supabase.from('perfis').select('*').order('nome'),
        supabase.from('configuracoes').select('*'),
      ]);

      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR').replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('pt-BR').replace(/:/g, '-');

      downloadCSV(`clientes_${dateStr}_${timeStr}.csv`, toCSV(clientes || []));
      setTimeout(() => downloadCSV(`negociacoes_${dateStr}_${timeStr}.csv`, toCSV(negociacoes || [])), 400);
      setTimeout(() => downloadCSV(`corretores_${dateStr}_${timeStr}.csv`, toCSV(perfis || [])), 800);
      setTimeout(() => downloadCSV(`configuracoes_${dateStr}_${timeStr}.csv`, toCSV(config || [])), 1200);

      const timestamp = now.toLocaleString('pt-BR');
      localStorage.setItem('crm_last_backup', timestamp);
      setLastBackup(timestamp);
    } catch (err) {
      alert('Erro ao gerar backup: ' + err.message);
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>Backup de Dados</h2>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
        Exporte todos os dados do sistema em formato CSV, compatível com Excel.
      </p>

      <div className="dash-section">
        <div className="dash-section-title">Backup Manual</div>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          Clique no botão abaixo para baixar 4 arquivos CSV — clientes, negociações, corretores e configurações.
        </p>

        {lastBackup && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, padding: '10px 14px', fontSize: 12, color: '#065f46', marginBottom: 16 }}>
            ✅ Último backup realizado em: <strong>{lastBackup}</strong>
          </div>
        )}

        <button className="btn btn-primary" onClick={handleBackup} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, padding: '10px 24px' }}>
          {loading ? <>⏳ Gerando backup...</> : <>📥 Baixar Backup CSV</>}
        </button>

        <div style={{ marginTop: 20, padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
          <strong>💡 Dica:</strong> Faça backup regularmente e salve os arquivos em um local seguro. Recomendamos backup semanal.
        </div>
      </div>

      <div className="dash-section" style={{ marginTop: 20 }}>
        <div className="dash-section-title">O que é incluído no backup?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {[
            ['📋', 'Clientes', 'Dados pessoais dos clientes — nome, telefone, email, tipo.'],
            ['🤝', 'Negociações', 'Todas as negociações — modalidade, imóvel, valor, funil, datas.'],
            ['👥', 'Corretores', 'Dados dos corretores cadastrados no sistema.'],
            ['⚙️', 'Configurações', 'Origens, tipos de lead e tipos de imóvel cadastrados.'],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ display: 'flex', gap: 12, padding: '10px 14px', background: '#f9fafb', borderRadius: 7, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 20 }}>{icon}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{title}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
