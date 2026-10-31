// Cálculo puro: sem DOM e sem rede. Regras em ESPECS/2026-10-30-calculadora-design.md.

import { SIMPLES } from './dados/simples.js';
import { REGRAS } from './dados/regras.js';

const fracao = (p) => (p || 0) / 100;
const positivo = (v) => Math.max(0, v);

const periodoPartilha = (ano) => (ano <= 2026 ? '2026' : ano <= 2028 ? '2027' : String(ano));
const periodoAliquota = (ano) => (ano <= 2026 ? '2026' : ano <= 2028 ? '2027' : '2029');

const ROTULOS = {
  mei: 'MEI',
  tradicional: 'Simples tradicional',
  hibrido: 'Simples híbrido',
  presumido: 'Lucro Presumido',
  real: 'Lucro Real',
};

export const rotuloRegime = (r) => ROTULOS[r];

function normalizar(entrada) {
  const e = {
    atividade: 'servico', anexoServico: 'III', grupo: 'geral', repasse: 'liquido',
    faturamentoMes: 0, folha12: 0, compras: 0, comprasSimples: 0, vendasEmpresasPct: 0,
    icmsPct: 18, issPct: 5, ipiPct: 0, margemPct: 10,
    ipiMantido: false, incluirRenda: false, salarioMinimo: REGRAS.mei.salarioMinimo,
    ...entrada,
  };
  e.receita12 = entrada.receita12 || e.faturamentoMes * 12;
  e.cbsRef = { ...REGRAS.cbsRef, ...entrada.cbsRef };
  e.ibsRef = { ...REGRAS.ibsRef, ...entrada.ibsRef };
  return e;
}

/** Alíquotas do ano como fração. `fator` é o redutor do grupo; 1 representa a alíquota cheia. */
function aliquotas(e, ano, fator) {
  if (ano <= 2026) return { cbs: 0, ibs: 0 };
  if (ano <= 2028) {
    return {
      cbs: fracao(e.cbsRef[ano] - REGRAS.reducaoCbsInicial) * fator,
      ibs: fracao(REGRAS.ibsInicial) * fator,
    };
  }
  return {
    cbs: fracao(e.cbsRef[ano]) * fator,
    ibs: fracao(e.ibsRef[ano]) * REGRAS.proporcaoIbs[ano] * fator,
  };
}

const aliquotasGrupo = (e, ano) => aliquotas(e, ano, REGRAS.grupos[e.grupo].fator);

function creditoFornecedorSimples(ano) {
  const fatia = SIMPLES.I.partilha[periodoPartilha(ano)].lin[1];
  const efetiva = fracao(REGRAS.simples.efetivaFornecedor);
  return { cbs: efetiva * fracao(fatia.CBS), ibs: efetiva * fracao(fatia.IBS) };
}

function creditosCompras(e, ano) {
  if (ano <= 2026) return { cbs: 0, ibs: 0 };
  const cheia = aliquotas(e, ano, 1);
  const simples = creditoFornecedorSimples(ano);
  return {
    cbs: e.compras * cheia.cbs + e.comprasSimples * simples.cbs,
    ibs: e.compras * cheia.ibs + e.comprasSimples * simples.ibs,
  };
}

const taxaIcms = (e) => (e.atividade === 'servico' ? 0 : fracao(e.icmsPct));
const taxaIss = (e) => (e.atividade === 'servico' ? fracao(e.issPct) : 0);
const ipiDoAno = (e, ano, valor) =>
  e.atividade === 'industria' && (ano <= 2026 || e.ipiMantido) ? valor * fracao(e.ipiPct) : 0;

function renda(e, receita, liquidoBase) {
  if (!e.incluirRenda) return {};
  const R = REGRAS.renda;
  const cpp = (e.folha12 / 12) * fracao(R.cpp);
  const imposto = (baseIrpj, baseCsll) => ({
    irpj: baseIrpj * fracao(R.irpj) + positivo(baseIrpj - R.limiteAdicionalMes) * fracao(R.adicionalIrpj),
    csll: baseCsll * fracao(R.csll),
    cpp,
  });
  if (e.regime === 'real') {
    const lucro = positivo(liquidoBase * fracao(e.margemPct));
    return imposto(lucro, lucro);
  }
  const limite = R.limiteAcrescimoAno / 12;
  const excedente = positivo(receita - limite);
  const presumir = (p) => fracao(p) * (receita - excedente + excedente * R.acrescimoPresuncao);
  return imposto(presumir(R.presuncaoIrpj[e.atividade]), presumir(R.presuncaoCsll[e.atividade]));
}

function regularHoje(e) {
  const V = e.faturamentoMes;
  const r = taxaIcms(e);
  const s = taxaIss(e);
  const icmsDebito = V * r;
  const taxaPis = fracao(REGRAS.pisCofins[e.regime]);
  const pisDebito = (V - icmsDebito) * taxaPis;
  const creditoPis = e.regime === 'real' ? (e.compras + e.comprasSimples) * taxaPis : 0;
  const N = V - icmsDebito - V * s - pisDebito;
  return { V, r, s, N, icmsDebito, pisDebito, creditoPis };
}

function regular(e, ano, hoje) {
  const { V, N: liquidoHoje } = hoje;
  const ipiHoje = ipiDoAno(e, 2026, V);
  if (ano === 2026) {
    const itens = {
      icms: positivo(hoje.icmsDebito - e.compras * hoje.r),
      iss: V * hoje.s,
      pisCofins: positivo(hoje.pisDebito - hoje.creditoPis),
      ipi: ipiHoje,
      ...renda(e, V, liquidoHoje),
    };
    const teste = {
      cbs: liquidoHoje * fracao(REGRAS.teste2026.cbs) * REGRAS.grupos[e.grupo].fator,
      ibs: liquidoHoje * fracao(REGRAS.teste2026.ibs) * REGRAS.grupos[e.grupo].fator,
    };
    return { itens, precoCliente: V + ipiHoje, creditoCliente: 0, teste };
  }

  const prop = REGRAS.proporcaoAntigos[ano];
  const r = hoje.r * prop;
  const s = hoje.s * prop;
  const { cbs: c, ibs: b } = aliquotasGrupo(e, ano);
  const ipi = ipiDoAno(e, ano, V);
  const liquido = e.repasse === 'preco'
    ? (V + ipiHoje - ipi) / (1 / (1 - r - s) + c + b)
    : liquidoHoje;
  const semNovos = liquido / (1 - r - s);
  const cbsDebito = liquido * c;
  const ibsDebito = liquido * b;
  const credito = creditosCompras(e, ano);
  const itens = {
    icms: positivo(semNovos * r - e.compras * r),
    iss: semNovos * s,
    ipi,
    cbs: positivo(cbsDebito - credito.cbs),
    ibs: positivo(ibsDebito - credito.ibs),
    ...renda(e, semNovos, liquido),
  };
  return {
    itens,
    precoCliente: semNovos + cbsDebito + ibsDebito + ipi,
    creditoCliente: (cbsDebito + ibsDebito) * fracao(e.vendasEmpresasPct),
  };
}

export function anexoDoAno(e, ano) {
  if (e.atividade === 'comercio') return 'I';
  if (e.atividade === 'industria') return ano <= 2026 || e.ipiMantido ? 'II' : 'I';
  if (e.anexoServico !== 'fatorR') return e.anexoServico;
  const razao = e.receita12 > 0 ? e.folha12 / e.receita12 : 0;
  return razao >= REGRAS.simples.fatorR ? 'III' : 'V';
}

function faixaDe(rbt) {
  const i = REGRAS.simples.faixas.findIndex((teto) => rbt <= teto);
  return i === -1 ? 6 : i + 1;
}

function tabelaSimples(e, ano) {
  const tab = SIMPLES[anexoDoAno(e, ano)];
  const faixa = faixaDe(e.receita12);
  const [nominal, deduzir] = tab.aliquotas[periodoAliquota(ano)][faixa];
  const rbt = e.receita12;
  const efetiva = rbt > 0 ? (rbt * fracao(nominal) - deduzir) / rbt : fracao(nominal);

  const partilha = tab.partilha[periodoPartilha(ano)];
  let fatias = Object.fromEntries(Object.entries(partilha.lin[faixa]).map(([k, v]) => [k, fracao(v)]));

  // Teto do ISS: acima dele o ISS fica fixo e o restante segue a linha própria da tabela.
  const teto = faixa === 5 ? partilha.teto : null;
  if (teto && efetiva * (fatias.ISS || 0) > fracao(teto.ISS)) {
    const iss = fracao(teto.ISS);
    fatias = { ISS: iss / efetiva };
    for (const [k, v] of Object.entries(teto)) {
      if (k !== 'ISS') fatias[k] = ((efetiva - iss) * fracao(v)) / efetiva;
    }
  }
  return { efetiva, fatias, faixa };
}

const cppFora = (e, ano) =>
  e.incluirRenda && anexoDoAno(e, ano) === 'IV' ? (e.folha12 / 12) * fracao(REGRAS.renda.cpp) : 0;

function simplesTradicional(e, ano) {
  const V = e.faturamentoMes;
  const { efetiva, fatias, faixa } = tabelaSimples(e, ano);
  const das = V * efetiva;
  const parte = (k) => das * (fatias[k] || 0);
  const itens = {
    das,
    irpj: parte('IRPJ'), csll: parte('CSLL'), cpp: parte('CPP') + cppFora(e, ano),
    pisCofins: parte('PIS_COFINS'), icms: parte('ICMS'), iss: parte('ISS'), ipi: parte('IPI'),
    cbs: parte('CBS'), ibs: parte('IBS'),
  };
  if (faixa === 6) {
    const prop = REGRAS.proporcaoAntigos[ano];
    itens.icms += V * taxaIcms(e) * prop;
    itens.iss += V * taxaIss(e) * prop;
    const base = V - itens.icms - itens.iss;
    const credito = creditosCompras(e, ano);
    itens.ibs += positivo(base * aliquotasGrupo(e, ano).ibs - credito.ibs);
  }
  return {
    itens,
    precoCliente: V,
    creditoCliente: (itens.cbs + itens.ibs) * fracao(e.vendasEmpresasPct),
  };
}

function simplesHibrido(e, ano) {
  if (ano === 2026) return simplesTradicional(e, ano);
  const V = e.faturamentoMes;
  const { efetiva, fatias, faixa } = tabelaSimples(e, ano);
  const hoje = simplesTradicional(e, 2026);
  const fatiaNovos = (fatias.CBS || 0) + (fatias.IBS || 0);
  const fatiaConsumo = (fatias.ICMS || 0) + (fatias.ISS || 0);
  const prop = faixa === 6 ? REGRAS.proporcaoAntigos[ano] : 0;
  const r = taxaIcms(e) * prop;
  const s = taxaIss(e) * prop;

  const { cbs: c, ibs: b } = aliquotasGrupo(e, ano);
  const fatorBase = 1 - efetiva * fatiaConsumo - r - s;
  const liquidoHoje = V - hoje.itens.das - hoje.itens.icms * (faixa === 6 ? 1 : 0) - hoje.itens.iss * (faixa === 6 ? 1 : 0);
  const semNovos = e.repasse === 'preco'
    ? V / (1 + fatorBase * (c + b))
    : liquidoHoje / (1 - efetiva * (1 - fatiaNovos) - r - s);

  const das = semNovos * efetiva * (1 - fatiaNovos);
  const base = semNovos * fatorBase;
  const cbsDebito = base * c;
  const ibsDebito = base * b;
  const credito = creditosCompras(e, ano);
  const parte = (k) => semNovos * efetiva * (fatias[k] || 0);
  const itens = {
    das,
    irpj: parte('IRPJ'), csll: parte('CSLL'), cpp: parte('CPP') + cppFora(e, ano),
    icms: parte('ICMS') + semNovos * r, iss: parte('ISS') + semNovos * s, ipi: parte('IPI'),
    cbs: positivo(cbsDebito - credito.cbs),
    ibs: positivo(ibsDebito - credito.ibs),
  };
  return {
    itens,
    precoCliente: semNovos + cbsDebito + ibsDebito,
    creditoCliente: (cbsDebito + ibsDebito) * fracao(e.vendasEmpresasPct),
  };
}

function mei(e, ano) {
  const periodo = ano <= 2026 ? 2026 : ano <= 2028 ? 2027 : ano;
  const fixo = REGRAS.mei.fixos[periodo];
  const servico = e.atividade === 'servico';
  const itens = {
    inss: e.salarioMinimo * fracao(REGRAS.mei.inss),
    icms: servico ? 0 : fixo.icms,
    iss: servico ? fixo.iss : 0,
    cbs: fixo.cbs,
    ibs: fixo.ibs,
  };
  return { itens, precoCliente: e.faturamentoMes, creditoCliente: (fixo.cbs + fixo.ibs) * fracao(e.vendasEmpresasPct) };
}

function statusDoAno(e, ano) {
  const fixo = e.regime === 'mei' || (e.regime === 'tradicional' && faixaDe(e.receita12) < 6);
  if (ano === 2026 || fixo) return 'lei';
  return ano === 2027 ? 'proposta' : 'projecao';
}

function linhas(e) {
  const hojeRegular = e.regime === 'presumido' || e.regime === 'real' ? regularHoje(e) : null;
  const motor = {
    mei: (ano) => mei(e, ano),
    tradicional: (ano) => simplesTradicional(e, ano),
    hibrido: (ano) => simplesHibrido(e, ano),
    presumido: (ano) => regular(e, ano, hojeRegular),
    real: (ano) => regular(e, ano, hojeRegular),
  }[e.regime];

  const anos = REGRAS.anos.map((ano) => {
    const { itens: parcial, precoCliente, creditoCliente, teste } = motor(ano);
    const itens = { das: 0, irpj: 0, csll: 0, cpp: 0, inss: 0, pisCofins: 0, icms: 0, iss: 0, ipi: 0, cbs: 0, ibs: 0, ...parcial };
    const antigos = itens.pisCofins + itens.icms + itens.iss + itens.ipi;
    const outros = itens.irpj + itens.csll + itens.cpp + itens.inss;
    const total = antigos + itens.cbs + itens.ibs + outros;
    return {
      ano, status: statusDoAno(e, ano), itens, antigos, cbs: itens.cbs, ibs: itens.ibs, outros, total,
      precoCliente, liquido: precoCliente - total, creditoCliente, teste: teste ?? null,
    };
  });
  const hoje = anos[0].total;
  for (const l of anos) {
    l.difHoje = l.total - hoje;
    l.difHojePct = hoje > 0 ? (l.difHoje / hoje) * 100 : 0;
  }
  return anos;
}

function avisos(e) {
  const lista = [];
  const simples = e.regime === 'tradicional' || e.regime === 'hibrido';
  if (e.regime === 'mei' && e.receita12 > REGRAS.mei.limite) {
    lista.push('A receita passa do limite do MEI (R$ 81.000 por ano).');
  }
  if (simples && e.receita12 > REGRAS.simples.limite) {
    lista.push('A receita passa do limite do Simples (R$ 4,8 milhões por ano). O cálculo usa a 6ª faixa só como referência.');
  } else if (simples && e.receita12 > REGRAS.simples.sublimite) {
    lista.push('Acima de R$ 3,6 milhões por ano, ICMS, ISS e IBS saem do DAS. A calculadora soma esses tributos à parte.');
  }
  if (e.regime === 'tradicional' && e.grupo !== 'geral') {
    lista.push('As tabelas do DAS não têm redução por grupo. O grupo escolhido não muda o valor do DAS.');
  }
  if (e.regime === 'mei' && e.grupo !== 'geral') {
    lista.push('O MEI paga valores fixos. O grupo escolhido não muda o resultado.');
  }
  if (e.regime === 'hibrido') {
    lista.push('A opção híbrida é semestral e irretratável no semestre. As janelas ficam em setembro e março (LC 123, art. 13, § 10).');
  }
  return lista;
}

export function calcular(entrada) {
  const e = normalizar(entrada);
  const outra = { tradicional: 'hibrido', hibrido: 'tradicional' }[e.regime];
  return {
    entrada: e,
    avisos: avisos(e),
    anexoPorAno: Object.fromEntries(REGRAS.anos.map((ano) => [ano, anexoDoAno(e, ano)])),
    anos: linhas(e),
    comparativo: outra ? { regime: outra, anos: linhas({ ...e, regime: outra }) } : null,
  };
}

const LIMITE_PRESUMIDO = 78000000;

function regimesDisponiveis(e) {
  const lista = ['real'];
  if (e.receita12 <= LIMITE_PRESUMIDO) lista.push('presumido');
  if (e.receita12 <= REGRAS.simples.limite) lista.push('tradicional', 'hibrido');
  if (e.receita12 <= REGRAS.mei.limite) lista.push('mei');
  return lista;
}

export function interferencias(entrada, ano) {
  const e = normalizar(entrada);
  const linha = (x) => linhas(normalizar(x)).find((l) => l.ano === ano);
  const base = linha(e);
  const itens = [];
  const semEfeito = [];

  const testar = (fator, frase, mudanca, referencia = base, soma = {}) => {
    const novo = linha({ ...e, ...soma, ...mudanca });
    const dif = novo.total - referencia.total;
    const difCredito = novo.creditoCliente - referencia.creditoCliente;
    const difLiquido = novo.liquido - referencia.liquido;
    if (Math.abs(dif) < 0.005 && Math.abs(difCredito) < 0.005) semEfeito.push(frase);
    else itens.push({ fator, frase, dif, difCredito, difLiquido });
  };

  const comRenda = linha({ ...e, incluirRenda: true });
  for (const regime of regimesDisponiveis(e)) {
    if (regime !== e.regime) {
      testar('regime', `Trocar para ${ROTULOS[regime]}`, { regime }, comRenda, { incluirRenda: true });
    }
  }

  const extra = e.faturamentoMes * 0.2;
  const extraTexto = extra.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  testar('compras', `Comprar mais ${extraTexto} de fornecedor do regime regular`, { compras: e.compras + extra });
  testar('clientes', 'Vender 20 pontos a mais para empresas', { vendasEmpresasPct: Math.min(100, e.vendasEmpresasPct + 20) });

  if (e.grupo === 'geral') testar('grupo', 'Estar no grupo com redução de 60%', { grupo: 'r60' });
  else testar('grupo', 'Estar no grupo geral', { grupo: 'geral' });

  const somarAno = (mapa, chave) => ({ ...mapa, [chave]: (mapa[chave] ?? 0) + 1 });
  if (ano >= 2027) testar('cbs', 'CBS de referência 1 ponto maior', { cbsRef: somarAno(e.cbsRef, ano) });
  if (ano >= 2029) testar('ibs', 'IBS pleno 1 ponto maior', { ibsRef: somarAno(e.ibsRef, ano) });

  if (e.atividade === 'servico') testar('iss', 'ISS 1 ponto maior', { issPct: e.issPct + 1 });
  else testar('icms', 'ICMS 1 ponto maior', { icmsPct: e.icmsPct + 1 });

  if (e.atividade === 'servico' && e.anexoServico === 'fatorR') {
    const atual = anexoDoAno(e, ano);
    testar('fatorR', `Mudar a folha para cair no Anexo ${atual === 'III' ? 'V' : 'III'}`, { anexoServico: atual === 'III' ? 'V' : 'III' });
  }

  testar('repasse',
    e.repasse === 'liquido' ? 'Não repassar e manter o preço ao cliente' : 'Repassar e manter o valor líquido',
    { repasse: e.repasse === 'liquido' ? 'preco' : 'liquido' });

  itens.sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif) || Math.abs(b.difCredito) - Math.abs(a.difCredito));
  return { base: base.total, itens, semEfeito };
}

const VENDAS_CENARIOS = [0, 25, 50, 75, 100];
const COMPRAS_CENARIOS = [0, 20, 40, 60];
const PASSOS_BUSCA = 60;

/** Acha x com f(x) = alvo, para f crescente. O teto dobra até cobrir o alvo. */
function resolver(f, alvo, min, max) {
  let a = min;
  let b = max;
  for (let i = 0; i < PASSOS_BUSCA && f(b) < alvo; i++) b *= 2;
  for (let i = 0; i < PASSOS_BUSCA; i++) {
    const meio = (a + b) / 2;
    if (f(meio) < alvo) a = meio;
    else b = meio;
  }
  return (a + b) / 2;
}

/**
 * Estudo da mudança do Simples tradicional para o híbrido em um ano.
 * Referência: o tradicional com o faturamento informado. O volume de vendas e a receita de 12 meses
 * ficam iguais. O cliente com crédito aceita pagar até manter o custo real de hoje, e o cliente sem
 * crédito paga o mesmo preço. O repasse escolhido no formulário não entra: o preço é o que se estuda.
 */
export function estudoHibrido(entrada, ano) {
  const e = normalizar(entrada);
  const V = e.faturamentoMes;
  const simples = e.regime === 'tradicional' || e.regime === 'hibrido';
  if (!simples || ano < 2027 || !(V > 0)) return null;

  const linhaAno = (mudanca) => linhas(normalizar({ ...e, vendasEmpresasPct: 100, ...mudanca })).find((l) => l.ano === ano);
  const tradicional = linhaAno({ regime: 'tradicional' });
  const hibrido = (faturamentoMes, mudanca = {}) =>
    linhaAno({ regime: 'hibrido', repasse: 'preco', faturamentoMes, ...mudanca });
  const resumo = (l, faturamento) => ({ faturamento, imposto: l.total, liquido: l.liquido, credito: l.creditoCliente });

  const liquidoAlvo = tradicional.liquido;
  const custoClienteHoje = V - tradicional.creditoCliente;
  const faturamentoSugerido = resolver((p) => hibrido(p).liquido, liquidoAlvo, 0, V * 2);
  const comCredito = resolver((p) => p - hibrido(p).creditoCliente, custoClienteHoje, 0, V * 2);

  const precoMedio = (vendasPct) => V + (comCredito - V) * (vendasPct / 100);
  const ganhoEm = (vendasPct, mudanca) => hibrido(precoMedio(vendasPct), mudanca).liquido - liquidoAlvo;

  const vendasPct = e.vendasEmpresasPct;
  const teto = precoMedio(vendasPct);
  const ganho = ganhoEm(vendasPct);

  const semVendas = ganhoEm(0);
  const empateVendasPct = semVendas >= 0 ? 0
    : ganhoEm(100) < 0 ? null
      : resolver((pct) => ganhoEm(pct), 0, 0, 100);

  const comprasMax = V * 3;
  const comCompras = (compras) => ganhoEm(vendasPct, { compras });
  const empateCompras = comCompras(0) >= 0 ? 0
    : comCompras(comprasMax) < 0 ? null
      : resolver(comCompras, 0, 0, comprasMax);

  return {
    ano,
    vendasPct,
    tradicional: resumo(tradicional, V),
    mesmoPreco: resumo(hibrido(V), V),
    sugerido: resumo(hibrido(faturamentoSugerido), faturamentoSugerido),
    teto: resumo(hibrido(teto), teto),
    aumentoSugeridoPct: (faturamentoSugerido / V - 1) * 100,
    comCredito,
    aumentoComCreditoPct: (comCredito / V - 1) * 100,
    ganho,
    compensa: ganho >= 0,
    empateVendasPct,
    empateCompras,
    matriz: {
      vendas: VENDAS_CENARIOS,
      compras: COMPRAS_CENARIOS,
      ganhos: VENDAS_CENARIOS.map((pct) =>
        COMPRAS_CENARIOS.map((compras) => ganhoEm(pct, { compras: V * (compras / 100) }))),
    },
  };
}
