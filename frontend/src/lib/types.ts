export type Funcao = 'admin' | 'operador';
export type StatusAnimal = 'ativo' | 'vendido' | 'obito';

export interface User {
  id: string;
  nome: string;
  email: string;
  funcao: Funcao;
  fazenda_id: string;
}

export interface Farm {
  id: string;
  nome: string;
  localizacao: string | null;
  area_hectares: number | null;
  criado_em: string;
}

export interface Animal {
  id: string;
  tag_rfid: string;
  brinco_visual: string;
  raca: string | null;
  data_nascimento: string | null;
  sexo: 'M' | 'F';
  status: StatusAnimal;
  status_data?: string | null; // data da venda / óbito
  status_obs?: string | null;
  ultimo_peso_kg?: number | null;
  ultima_pesagem_em?: string | null;
  gmd_kg_dia?: number | null;
}

export interface AnimalDetail extends Animal {
  pesagens: { id: string; peso_kg: number; timestamp: string; dispositivo: string | null }[];
  resumo: {
    total_pesagens: number;
    peso_inicial_kg: number | null;
    peso_atual_kg: number | null;
    ganho_total_kg: number | null;
    gmd_kg_dia: number | null;
    gmd_30d_kg_dia: number | null;
  };
}

export interface Weighing {
  id: string;
  animal_id: string;
  brinco_visual: string;
  tag_rfid: string;
  dispositivo_id: string | null;
  dispositivo_nome: string;
  peso_kg: number;
  timestamp: string;
  ganho_kg?: number | null;
}

export interface Device {
  id: string;
  identificador_esp32: string;
  nome: string;
  status_online: boolean;
  ultimo_contato: string | null;
  pesagens_hoje: number;
  telemetria: Record<string, { valor: number; timestamp: string }>;
  api_key?: string;
}

export interface Overview {
  animais: { ativos: number; vendidos: number; obitos: number };
  pesagens_hoje: number;
  peso_medio_rebanho_kg: number | null;
  gmd_medio_kg_dia: number | null;
  dispositivos: { total: number; online: number };
  serie_diaria: { dia: string; total: number; peso_medio: number }[];
  top_gmd: RankItem[];
  pior_gmd: RankItem[];
}

export interface RankItem {
  animal_id: string;
  brinco_visual: string;
  raca: string | null;
  gmd_kg_dia: number;
  peso_atual_kg: number;
}
