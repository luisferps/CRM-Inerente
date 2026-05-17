import React, { useState, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';

// Mapeamento de colunas do CSV para campos do banco
const FIELD_MAP = {
  // Nome → campo do banco
  nome: 'nome',
  name: 'nome',
  cliente: 'nome',

  telefone: 'telefone',
  phone: 'telefone',
  celular: 'telefone',
  whatsapp: 'telefone',

  email: 'email',
  'e-mail': 'email',

  origem: 'origem',
  source: 'origem',
  canal: 'origem',

  tipo: 'tipo',
  'tipo de lead': 'tipo',
  perfil: 'tipo',

  imovel: 'imovel',
  imóvel: 'imovel',
  'tipo de imóvel': 'imovel',
  'tipo de imovel': 'imovel',

  modalidade: 'modalidade',
  'modalidade de negócio': 'modalidade',
  negocio: 'modalidade',
  negócio: 'modalidade',

  valor: 'valor',
  'valor do imóvel': 'valor',
  preco: 'valor',
  preço: 'valor',

  localizacao: 'localizacao',
  localização: 'localizacao',
  bairro: 'localizacao',
  cidade: 'localizacao',
  local: 'localizacao',

  detalhes: 'detalhes',
  observacoes: 'detalhes',
  observações: 'detalhes',
  obs: 'detalhes',
  notas: 'detalhes',

  entrada: 'entrada',
  'data de entrada': 'entrada',
  data: 'entrada',

  'proxima acao': 'proxima_acao',
  'próxima ação': 'proxima_acao',
  proxima_acao: 'proxima_acao',
  'próxima acao': 'proxima_acao',

  'ultimo contato': 'ultimo_contato',
  'último contato': 'ultimo_contato',
  ultimo_contato: 'ultimo_contato',

  'proximo contato': 'prox_contato',
  'próximo contato': 'prox_contato',
  prox_contato: 'prox_contato',

  funil: 'funil',
  etapa: 'funil',
  'etapa do funil': 'funil',
};

const ETAPAS_FUNIL = [
  'tratativa', 'pesquisa', 'agendamento', 'visita',
  'proposta', 'contrato', 'financiamento', 'recebimento', 'recebido'
];

const MODALIDADES = ['Compra', 'Locação', 'Lançamento'];

function normalizeKey(key) {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  // Detecta separador
  const firstLine = lines[0];
  const separator = firstLine.includes(';') ? ';' : ',';

  const parseRow = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === separator && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(line => {
    const vals = parseRow(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });

  return { headers, rows };
}

function mapRow(row, corretorId, corretorNome) {
  const mapped = {
    corretor_id: corretorId,
    corretor: corretorNome,
    ativo: true,
    tratativa: false, pesquisa: false, agendamento: false, visita: false,
    proposta: false, contrato: false, financiamento: false,
    recebimento: false, recebido: false,
  };

  for (const [rawKey, value] of Object.entries(row)) {
    if (!value) continue;
    const normKey = normalizeKey(rawKey);
    const field = FIELD_MAP[normKey];
    if (!field) continue;

    if (field === 'funil') {
      const etapa = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      ETAPAS_FUNIL.forEach(e => {
        if (etapa.includes(e)) mapped[e] = true;
      });
    } else if (field === 'valor') {
      const num = parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.'));
      if (!isNaN(num)) mapped[field] = num;
    } else if (field === 'entrada' || field === 'ultimo_contato' || field === 'prox_contato') {
      // Tenta converter datas comuns: dd/mm/yyyy ou yyyy-mm-dd
      const parts = value.split(/[\/\-]/);
      if (parts.length === 3) {
        let iso;
        if (parts[0].length === 4) {
          iso = `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
        } else {
          iso = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
        if (!isNaN(Date.parse(iso))) mapped[field] = iso;
      }
    } else if (field === 'modalidade') {
      const mod = MODALIDADES.find(m =>
        m.toLowerCase().includes(value.toLowerCase()) ||
        value.toLowerCase().includes(m.toLowerCase())
      );
      mapped[field] = mod || value;
    } else {
      mapped[field] = value;
    }
  }

  return mapped;
}

export default function ImportacaoTab({ user, perfil, darkMode }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // { headers, rows, mapped }
  const [step, setStep] = useState('upload'); // upload | preview | result
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null); // { success, errors }
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const isGerente = perfil?.role === 'gerente';

  const handleFile = useCallback(async (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      alert('Formato não suportado. Use CSV ou Excel (.xlsx, .xls)');
      return;
    }
    setFile(f);
    setStep('preview');
    setResult(null);

    if (ext === 'csv') {
      const text = await f.text();
      const { headers, rows } = parseCSV(text);
      const mapped = rows.map(r => mapRow(r, perfil?.id, perfil?.nome));
      setPreview({ headers, rows, mapped });
    } else {
      // Excel: usar SheetJS via CDN (já incluso no projeto como dep comum)
      // Tenta importar dinamicamente
      try {
        const XLSX = await import('xlsx').catch(() => null);
        if (!XLSX) {
          alert('Para importar Excel, instale a dependência: npm install xlsx\nOu converta para CSV e tente novamente.');
          setStep('upload');
          return;
        }
        const buffer = await f.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'yyyy-mm-dd' });
        const headers = json.length > 0 ? Object.keys(json[0]) : [];
        const mapped = json.map(r => mapRow(r, perfil?.id, perfil?.nome));
        setPreview({ headers, rows: json, mapped });
      } catch (e) {
        alert('Erro ao ler Excel: ' + e.message);
        setStep('upload');
      }
    }
  }, [perfil]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleImport = async () => {
    if (!preview?.mapped?.length) return;
    setImporting(true);

    const errors = [];
    const successes = [];

    // Inserir em lotes de 50
    const chunks = [];
    for (let i = 0; i < preview.mapped.length; i += 50) {
      chunks.push(preview.mapped.slice(i, i + 50));
    }

    for (const chunk of chunks) {
      const { data, error } = await supabase.from('clientes').insert(chunk).select('id');
      if (error) {
        errors.push(error.message);
      } else {
        successes.push(...(data || []));
      }
    }

    setResult({ success: successes.length, errors });
    setStep('result');
    setImporting(false);
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setStep('upload');
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const bg = darkMode ? '#1a1a2e' : '#f0f4f8';
  const card = darkMode ? '#16213e' : '#ffffff';
  const border = darkMode ? '#0f3460' : '#e2e8f0';
  const text = darkMode ? '#e2e8f0' : '#1a202c';
  const textMuted = darkMode ? '#94a3b8' : '#64748b';
  const accent = '#2563eb';
  const accentLight = darkMode ? '#1d4ed8' : '#3b82f6';

  // ── DOWNLOAD TEMPLATE ──
  const downloadTemplate = () => {
    const headers = [
      'nome', 'telefone', 'email', 'origem', 'tipo', 'imovel',
      'modalidade', 'valor', 'localizacao', 'detalhes',
      'proxima_acao', 'ultimo_contato', 'prox_contato', 'funil'
    ];
    const example = [
      'João Silva', '62999990000', 'joao@email.com', 'Instagram',
      'Comprador', 'Apartamento', 'Compra', '350000',
      'Setor Bueno - Goiânia', 'Busca 3 quartos com varanda',
      'Enviar plantas', '2025-05-10', '2025-05-17', 'pesquisa'
    ];
    const csv = [headers.join(';'), example.join(';')].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_importacao_clientes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '24px', maxWidth: 960, margin: '0 auto', color: text }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>📥 Importar Clientes</h2>
        <p style={{ margin: '6px 0 0', color: textMuted, fontSize: 14 }}>
          Importe clientes em massa via arquivo CSV ou Excel (.xlsx)
        </p>
      </div>

      {/* STEP: UPLOAD */}
      {step === 'upload' && (
        <>
          {/* Zona de drop */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? accent : border}`,
              borderRadius: 16,
              background: dragOver ? (darkMode ? '#1e3a5f' : '#eff6ff') : card,
              padding: '60px 32px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>
              Arraste seu arquivo aqui
            </p>
            <p style={{ margin: '8px 0 16px', color: textMuted, fontSize: 14 }}>
              ou clique para selecionar
            </p>
            <span style={{
              background: accent, color: '#fff', padding: '10px 24px',
              borderRadius: 8, fontSize: 14, fontWeight: 600,
            }}>
              Selecionar Arquivo
            </span>
            <p style={{ margin: '16px 0 0', color: textMuted, fontSize: 12 }}>
              Formatos aceitos: CSV, XLSX, XLS
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>

          {/* Cards de instrução */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>📋 Colunas Reconhecidas</h4>
              <p style={{ margin: 0, color: textMuted, fontSize: 13, lineHeight: 1.6 }}>
                <strong>nome</strong>, <strong>telefone</strong>, <strong>email</strong>, <strong>origem</strong>,
                <strong> tipo</strong>, <strong>imovel</strong>, <strong>modalidade</strong>, <strong>valor</strong>,
                <strong> localizacao</strong>, <strong>detalhes</strong>, <strong>proxima_acao</strong>,
                <strong> ultimo_contato</strong>, <strong>prox_contato</strong>, <strong>funil</strong>
              </p>
            </div>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>💡 Dicas de Importação</h4>
              <ul style={{ margin: 0, paddingLeft: 18, color: textMuted, fontSize: 13, lineHeight: 1.8 }}>
                <li>Datas no formato <strong>dd/mm/aaaa</strong> ou <strong>aaaa-mm-dd</strong></li>
                <li>Funil: escreva o nome da etapa (ex: <em>pesquisa</em>)</li>
                <li>Separador CSV: vírgula ou ponto-e-vírgula</li>
                <li>Clientes serão vinculados ao seu perfil</li>
              </ul>
            </div>
          </div>

          <button
            onClick={downloadTemplate}
            style={{
              background: 'transparent', border: `1px solid ${border}`,
              color: text, padding: '10px 20px', borderRadius: 8,
              cursor: 'pointer', fontSize: 14, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            ⬇️ Baixar Template CSV
          </button>
        </>
      )}

      {/* STEP: PREVIEW */}
      {step === 'preview' && preview && (
        <>
          <div style={{
            background: card, border: `1px solid ${border}`,
            borderRadius: 12, padding: '16px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 20,
          }}>
            <div>
              <strong>{file?.name}</strong>
              <span style={{ color: textMuted, fontSize: 13, marginLeft: 12 }}>
                {preview.rows.length} registros encontrados
              </span>
            </div>
            <button onClick={reset} style={{
              background: 'none', border: 'none', color: textMuted,
              cursor: 'pointer', fontSize: 13,
            }}>
              ✕ Trocar arquivo
            </button>
          </div>

          {/* Resumo do mapeamento */}
          <MappingPreview
            headers={preview.headers}
            darkMode={darkMode}
            card={card}
            border={border}
            text={text}
            textMuted={textMuted}
          />

          {/* Tabela de preview (primeiros 5) */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 15 }}>
              Pré-visualização (primeiros {Math.min(5, preview.rows.length)} de {preview.rows.length})
            </h4>
            <div style={{ overflowX: 'auto', borderRadius: 10, border: `1px solid ${border}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: darkMode ? '#0f3460' : '#f8fafc' }}>
                    {['nome', 'telefone', 'email', 'origem', 'tipo', 'modalidade', 'valor', 'funil'].map(col => (
                      <th key={col} style={{
                        padding: '10px 14px', textAlign: 'left',
                        fontWeight: 600, color: textMuted, borderBottom: `1px solid ${border}`,
                        whiteSpace: 'nowrap',
                      }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.mapped.slice(0, 5).map((row, i) => {
                    const etapaAtiva = ETAPAS_FUNIL.find(e => row[e]);
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${border}` }}>
                        {['nome', 'telefone', 'email', 'origem', 'tipo', 'modalidade', 'valor'].map(col => (
                          <td key={col} style={{ padding: '10px 14px', color: row[col] ? text : textMuted }}>
                            {row[col] || '—'}
                          </td>
                        ))}
                        <td style={{ padding: '10px 14px' }}>
                          {etapaAtiva
                            ? <span style={{
                                background: accent, color: '#fff',
                                padding: '2px 8px', borderRadius: 20, fontSize: 11,
                              }}>{etapaAtiva}</span>
                            : <span style={{ color: textMuted }}>tratativa</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Avisos */}
          {preview.mapped.some(r => !r.nome) && (
            <div style={{
              background: darkMode ? '#7c2d12' : '#fef3c7',
              border: `1px solid ${darkMode ? '#dc2626' : '#f59e0b'}`,
              borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13,
            }}>
              ⚠️ <strong>Atenção:</strong> {preview.mapped.filter(r => !r.nome).length} registros sem nome serão importados como "(sem nome)".
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleImport}
              disabled={importing}
              style={{
                background: accent, color: '#fff', border: 'none',
                padding: '12px 28px', borderRadius: 8, fontSize: 15,
                fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer',
                opacity: importing ? 0.7 : 1,
              }}
            >
              {importing ? '⏳ Importando...' : `✅ Importar ${preview.rows.length} Clientes`}
            </button>
            <button
              onClick={reset}
              style={{
                background: 'none', border: `1px solid ${border}`,
                color: text, padding: '12px 20px', borderRadius: 8,
                fontSize: 15, cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </>
      )}

      {/* STEP: RESULT */}
      {step === 'result' && result && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>
            {result.errors.length === 0 ? '🎉' : '⚠️'}
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: 22 }}>
            {result.errors.length === 0 ? 'Importação concluída!' : 'Importação parcial'}
          </h3>
          <p style={{ color: textMuted, margin: '0 0 24px' }}>
            <strong style={{ color: '#22c55e' }}>{result.success} clientes</strong> importados com sucesso
            {result.errors.length > 0 && (
              <span> · <strong style={{ color: '#ef4444' }}>{result.errors.length} erros</strong></span>
            )}
          </p>

          {result.errors.length > 0 && (
            <div style={{
              background: darkMode ? '#7c2d12' : '#fef2f2',
              border: `1px solid #ef4444`,
              borderRadius: 8, padding: 16, marginBottom: 24,
              textAlign: 'left', maxWidth: 500, margin: '0 auto 24px',
            }}>
              {result.errors.map((e, i) => (
                <p key={i} style={{ margin: '4px 0', fontSize: 13, color: '#ef4444' }}>• {e}</p>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={reset}
              style={{
                background: accent, color: '#fff', border: 'none',
                padding: '12px 24px', borderRadius: 8, fontSize: 14,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Nova Importação
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MappingPreview({ headers, darkMode, card, border, text, textMuted }) {
  const mappedCount = headers.filter(h => FIELD_MAP[normalizeKey(h)]).length;
  const unmapped = headers.filter(h => !FIELD_MAP[normalizeKey(h)]);

  return (
    <div style={{
      background: card, border: `1px solid ${border}`,
      borderRadius: 12, padding: 16, marginBottom: 20,
    }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 15 }}>
        🔗 Mapeamento de Colunas —{' '}
        <span style={{ color: '#22c55e' }}>{mappedCount} reconhecidas</span>
        {unmapped.length > 0 && (
          <span style={{ color: '#f59e0b' }}> · {unmapped.length} ignoradas</span>
        )}
      </h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {headers.map(h => {
          const mapped = FIELD_MAP[normalizeKey(h)];
          return (
            <span key={h} style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              background: mapped ? (darkMode ? '#14532d' : '#dcfce7') : (darkMode ? '#292524' : '#f1f5f9'),
              color: mapped ? '#22c55e' : textMuted,
              border: `1px solid ${mapped ? '#22c55e' : border}`,
            }}>
              {h} {mapped ? `→ ${mapped}` : '✕'}
            </span>
          );
        })}
      </div>
    </div>
  );
}
