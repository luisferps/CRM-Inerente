export const DEFAULT_ORIGENS = [
  "Carteira","Facebook","Google","Grupo Wpp","Homer","Indicação",
  "Instagram","Market Fb","Newcore","Olx","Portaria","Status Wpp",
  "Stories Ig","Zap Imóveis","Corretor","Gabriela"
];
export const DEFAULT_IMOVEIS = ["Apartamento","Casa","Apt./Casa","Lote","Terreno","Comercial","Galpão"];
export const MODALIDADES = ["Compra","Venda","Locador","Locatário"];

// Os 4 tipos de tratativa em dois eixos:
//  • Captação (o cliente TEM o imóvel → vira imóvel no Estoque): Venda, Locador
//  • Procura  (o cliente QUER um imóvel nosso → vira contrato):    Compra, Locatário
export const MODALIDADES_CAPTACAO = ["Venda","Locador"];
export const MODALIDADES_PROCURA  = ["Compra","Locatário"];

// Normaliza a modalidade para leitura. Registros antigos gravados como
// "Locação"/"Aluguel" são lidos como "Locatário" (o lado da procura, que é
// o que eles sempre foram). Nenhuma migração no banco é necessária: a
// regravação acontece naturalmente quando o cadastro é salvo de novo.
export function normModalidade(m) {
  const s = String(m || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (s === "locacao" || s === "aluguel" || s === "locatario") return "Locatário";
  if (s === "locador") return "Locador";
  if (s === "venda") return "Venda";
  if (s === "compra") return "Compra";
  return m || "";
}
// É captação? (Venda ou Locador → vai pro Estoque)
export function ehCaptacao(m) { return MODALIDADES_CAPTACAO.includes(normModalidade(m)); }
// É locação? (Locador ou Locatário — inclui o "Locação" legado)
export function ehLocacao(m) { const n = normModalidade(m); return n === "Locador" || n === "Locatário"; }

export const ETAPAS_FUNIL = [
  "tratativa","pesquisa","agendamento","visita",
  "proposta","contrato","financiamento","recebimento"
];

export const ETAPAS_FUNIL_COMPLETO = [
  "tratativa","pesquisa","agendamento","visita",
  "proposta","contrato","financiamento","recebimento","recebido"
];

export const ETAPAS_LABEL = {
  tratativa: "Tratativa",
  pesquisa: "Pesquisa",
  agendamento: "Agendamento",
  visita: "Visita",
  proposta: "Proposta",
  contrato: "Contrato",
  financiamento: "Registro",
  recebimento: "À Receber",
  recebido: "Recebido",
};

export const STORAGE_ORIGENS = "crm_origens";
export const STORAGE_IMOVEIS = "crm_imoveis";

export function getList(storageKey, defaultList) {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : defaultList;
  } catch { return defaultList; }
}
export function saveList(storageKey, list) {
  localStorage.setItem(storageKey, JSON.stringify(list));
}
