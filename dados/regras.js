// Parâmetros da transição. Base legal: EC 132/2023 (ADCT, arts. 125 a 129) e LC 214/2025.

export const REGRAS = {
  anos: [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033],

  // Alíquota de referência proposta pelo TCU para 2027. O Senado pode alterar até 15/12/2026.
  // De 2028 em diante a lei ainda não fixou número: o valor é projeção editável.
  cbsRef: { 2027: 11.3, 2028: 11.3, 2029: 11.3, 2030: 11.3, 2031: 11.3, 2032: 11.3, 2033: 11.3 },

  // Projeção do Comitê Gestor do IBS. Não é alíquota fixada em lei.
  ibsRef: { 2029: 18.7, 2030: 18.7, 2031: 18.7, 2032: 18.7, 2033: 18.7 },

  teste2026: { cbs: 0.9, ibs: 0.1 },
  ibsInicial: 0.1,
  reducaoCbsInicial: 0.1,

  proporcaoIbs: { 2029: 0.1, 2030: 0.2, 2031: 0.3, 2032: 0.4, 2033: 1 },
  proporcaoAntigos: { 2026: 1, 2027: 1, 2028: 1, 2029: 0.9, 2030: 0.8, 2031: 0.7, 2032: 0.6, 2033: 0 },

  grupos: {
    geral: { fator: 1, rotulo: 'Geral (alíquota cheia)' },
    r30: { fator: 0.7, rotulo: 'Redução de 30%: profissões regulamentadas por conselho (art. 127)' },
    r40: { fator: 0.6, rotulo: 'Redução de 40%: hotelaria, parques, restaurantes, transporte (arts. 275, 281, 286)' },
    r50: { fator: 0.5, rotulo: 'Redução de 50%: operações com imóveis (art. 261)' },
    r60: { fator: 0.4, rotulo: 'Redução de 60%: saúde, educação, medicamentos, alimentos (arts. 128 a 142)' },
    r70: { fator: 0.3, rotulo: 'Redução de 70%: locação de imóveis (art. 261, parágrafo único)' },
    zero: { fator: 0, rotulo: 'Alíquota zero: cesta básica e itens listados (arts. 125, 143 a 149)' },
  },

  pisCofins: { presumido: 3.65, real: 9.25 },

  renda: {
    irpj: 15,
    adicionalIrpj: 10,
    limiteAdicionalMes: 20000,
    csll: 9,
    presuncaoIrpj: { comercio: 8, industria: 8, servico: 32 },
    presuncaoCsll: { comercio: 12, industria: 12, servico: 32 },
    limiteAcrescimoAno: 5000000, // LC 224/2025
    acrescimoPresuncao: 1.1,
    cpp: 20,
  },

  simples: {
    limite: 4800000,
    sublimite: 3600000,
    fatorR: 0.28,
    faixas: [180000, 360000, 720000, 1800000, 3600000, 4800000],
    // Estimativa do crédito de fornecedor do Simples: 6% de efetiva, Anexo I, 1ª faixa.
    efetivaFornecedor: 6,
  },

  mei: {
    limite: 81000,
    salarioMinimo: 1621,
    inss: 5,
    // Valores fixos mensais: LC 123, Anexo VII (LC 214, Anexo XXIII).
    fixos: {
      2026: { icms: 1, iss: 5, cbs: 0, ibs: 0 },
      2027: { icms: 1, iss: 5, cbs: 0.994, ibs: 0.006 },
      2029: { icms: 0.9, iss: 4.5, cbs: 1, ibs: 0.2 },
      2030: { icms: 0.8, iss: 4, cbs: 1, ibs: 0.4 },
      2031: { icms: 0.7, iss: 3.5, cbs: 1, ibs: 0.6 },
      2032: { icms: 0.6, iss: 3, cbs: 1, ibs: 0.8 },
      2033: { icms: 0, iss: 0, cbs: 1, ibs: 2 },
    },
  },

  // Alíquota interna padrão em 2026, com fundo de pobreza quando houver. Valor inicial editável.
  icmsUf: {
    AC: 19, AL: 21.5, AM: 20, AP: 18, BA: 20.5, CE: 20, DF: 20, ES: 17, GO: 19,
    MA: 23, MG: 18, MS: 17, MT: 17, PA: 19, PB: 20, PE: 20.5, PI: 22.5, PR: 19.5,
    RJ: 22, RN: 20, RO: 19.5, RR: 20, RS: 17, SC: 17, SE: 20, SP: 18, TO: 20,
  },
};
