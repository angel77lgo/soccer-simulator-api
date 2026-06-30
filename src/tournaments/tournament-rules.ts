export interface TournamentQuotas {
  [confed: string]: number;
}

export interface TournamentTemplate {
  name: string;
  teamsCount: number;
  quotas: TournamentQuotas;
}

export const OFFICIAL_TEMPLATES: Record<string, TournamentTemplate> = {
  world_cup: {
    name: 'Copa Mundial FIFA',
    teamsCount: 48,
    quotas: { UEFA: 16, CAF: 9, AFC: 8, CONCACAF: 6, CONMEBOL: 6, OFC: 1 },
  },
  euro: {
    name: 'Eurocopa',
    teamsCount: 24,
    quotas: { UEFA: 24 },
  },
  copa_america: {
    name: 'Copa América',
    teamsCount: 16,
    quotas: { CONMEBOL: 10, CONCACAF: 6 },
  },
  caf_nations: {
    name: 'Copa Africana de Naciones',
    teamsCount: 24,
    quotas: { CAF: 24 },
  },
  asian_cup: {
    name: 'Copa Asiática',
    teamsCount: 24,
    quotas: { AFC: 24 },
  },
  concacaf_gold: {
    name: 'Copa Oro CONCACAF',
    teamsCount: 16,
    quotas: { CONCACAF: 16 },
  },
  ofc_nations: {
    name: 'Copa de Naciones OFC',
    teamsCount: 8,
    quotas: { OFC: 8 },
  },
};
