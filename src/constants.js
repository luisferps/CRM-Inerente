export const DEFAULT_ORIGENS = [
  "Carteira","Facebook","Google","Grupo Wpp","Homer","Indicação",
  "Instagram","Market Fb","Newcore","Olx","Portaria","Status Wpp",
  "Stories Ig","Zap Imóveis","Corretor","Gabriela"
];
export const DEFAULT_IMOVEIS = ["Apartamento","Casa","Apt./Casa","Lote","Terreno","Comercial","Galpão"];
export const MODALIDADES = ["Compra","Venda","Locação"];

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
  financiamento: "Financiamento",
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
