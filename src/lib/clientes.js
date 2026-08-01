import { supabase } from '../supabaseClient';

// -- Cadastro central de clientes - funcao unica compartilhada por todas as portas --
// O banco tem: coluna clientes.telefone_norm (mantida por trigger) + indice unico.
// Estas funcoes fazem o mesmo criterio do banco (funcao SQL public.tel_canonico),
// pra que buscar/gravar cliente por qualquer porta caia sempre no MESMO registro.

// Telefone canonico: so digitos; se 12-13 digitos comecando com 55, tira o 55.
export function telCanonico(v) {
  const d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.length >= 12 && d.length <= 13 && d.slice(0, 2) === '55') return d.slice(2);
  return d;
}

// Encaixa no cliente existente (pelo telefone canonico) ou cria um novo.
// Nunca duplica: o banco tambem trava. Retorna { cliente, criado }.
export async function obterOuCriarCliente(dados = {}) {
  const { nome, telefone, telefone2, email, entrada, origem, is_corretor, corretor_id } = dados;
  const norm = telCanonico(telefone);

  if (norm) {
    const { data: achado } = await supabase
      .from('clientes').select('*').eq('telefone_norm', norm).limit(1);
    if (achado && achado.length) return { cliente: achado[0], criado: false };
  }

  const payload = {
    nome: String(nome || '').trim() || (norm ? 'Cliente ' + norm : 'Cliente'),
    telefone: telefone || '',
    telefone2: telefone2 || null,
    email: email || null,
    entrada: entrada || new Date().toISOString().slice(0, 10),
    origem: origem || null,
    is_corretor: !!is_corretor,
    corretor_id: corretor_id || null,
  };

  const { data, error } = await supabase.from('clientes').insert(payload).select().single();
  if (error) {
    if (norm) {
      const { data: rebusca } = await supabase
        .from('clientes').select('*').eq('telefone_norm', norm).limit(1);
      if (rebusca && rebusca.length) return { cliente: rebusca[0], criado: false };
    }
    throw error;
  }
  return { cliente: data, criado: true };
}
