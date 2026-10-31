import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcular } from '../calc.js';
import { SIMPLES } from '../dados/simples.js';

const perto = (real, esperado, msg) => assert.ok(Math.abs(real - esperado) < 0.01, `${msg ?? ''} real ${real} esperado ${esperado}`);
const ano = (r, a) => r.anos.find((l) => l.ano === a);

const servicoSimples = {
  regime: 'tradicional', atividade: 'servico', anexoServico: 'III', grupo: 'geral',
  faturamentoMes: 15000, receita12: 180000, repasse: 'liquido',
};

test('toda linha de partilha soma 100%', () => {
  for (const [anexo, tab] of Object.entries(SIMPLES)) {
    for (const [periodo, p] of Object.entries(tab.partilha)) {
      for (const [faixa, lin] of Object.entries(p.lin)) {
        const soma = Object.values(lin).reduce((a, b) => a + b, 0);
        perto(soma, 100, `${anexo} ${periodo} ${faixa}`);
      }
    }
  }
});

test('Simples tradicional: Anexo III, 1ª faixa, 2026 e 2027', () => {
  const r = calcular(servicoSimples);
  const h = ano(r, 2026);
  perto(h.total, 900);
  perto(h.itens.pisCofins, 140.4);
  perto(h.itens.iss, 301.5);
  perto(h.cbs, 0);
  const n = ano(r, 2027);
  perto(n.total, 900);
  perto(n.cbs, 138.87);
  perto(n.ibs, 1.53);
  perto(n.difHoje, 0);
  perto(n.creditoCliente, 0);
});

test('Simples tradicional: crédito ao cliente segue as vendas para empresas', () => {
  const r = calcular({ ...servicoSimples, vendasEmpresasPct: 50 });
  perto(ano(r, 2027).creditoCliente, 70.2);
});

test('Simples: 6ª faixa cai 0,1 ponto em 2027 e volta em 2029', () => {
  const e = { regime: 'tradicional', atividade: 'comercio', grupo: 'geral', faturamentoMes: 100000, receita12: 4200000, icmsPct: 0, repasse: 'liquido' };
  const r = calcular(e);
  perto(ano(r, 2026).itens.das, 10000);
  perto(ano(r, 2027).itens.das, 9900);
  perto(ano(r, 2029).itens.das, 10000);
});

test('Simples: 6ª faixa cobra ICMS, ISS e IBS fora do DAS', () => {
  const e = { regime: 'tradicional', atividade: 'comercio', grupo: 'geral', faturamentoMes: 100000, receita12: 4200000, icmsPct: 18, repasse: 'liquido' };
  const r = calcular(e);
  perto(ano(r, 2026).itens.icms, 18000);
  perto(ano(r, 2026).total, 28000);
  perto(ano(r, 2027).ibs, 82, 'IBS sobre a base sem ICMS');
  assert.ok(r.avisos.some((a) => a.includes('3,6 milhões')));
});

test('Simples: teto do ISS na 5ª faixa do Anexo III', () => {
  const e = { regime: 'tradicional', atividade: 'servico', anexoServico: 'III', grupo: 'geral', faturamentoMes: 100000, receita12: 3000000, repasse: 'liquido' };
  const h = ano(calcular(e), 2026);
  perto(h.itens.iss, 5000);
  perto(h.itens.cpp, 7708.51);
  perto(h.total, 16812);
});

test('Simples: Fator R escolhe Anexo III ou V', () => {
  const base = { regime: 'tradicional', atividade: 'servico', anexoServico: 'fatorR', grupo: 'geral', faturamentoMes: 15000, receita12: 180000, repasse: 'liquido' };
  perto(ano(calcular({ ...base, folha12: 60000 }), 2026).total, 900);
  perto(ano(calcular({ ...base, folha12: 40000 }), 2026).total, 2325);
});

test('Simples: indústria usa Anexo II em 2026 e Anexo I depois, salvo IPI mantido', () => {
  const base = { regime: 'tradicional', atividade: 'industria', grupo: 'geral', faturamentoMes: 15000, receita12: 180000, repasse: 'liquido' };
  const r = calcular(base);
  perto(ano(r, 2026).total, 675);
  perto(ano(r, 2027).total, 600);
  perto(ano(calcular({ ...base, ipiMantido: true }), 2027).total, 675);
});

test('Simples: Anexo IV cobra CPP fora do DAS quando pedido', () => {
  const e = { regime: 'tradicional', atividade: 'servico', anexoServico: 'IV', grupo: 'geral', faturamentoMes: 15000, receita12: 180000, folha12: 120000, incluirRenda: true, repasse: 'liquido' };
  const h = ano(calcular(e), 2026);
  perto(h.itens.das, 675);
  perto(h.itens.cpp, 2000);
  perto(h.total, 2675);
});

test('Simples híbrido: CBS e IBS saem do DAS', () => {
  const r = calcular({ ...servicoSimples, regime: 'hibrido', vendasEmpresasPct: 100 });
  perto(ano(r, 2026).total, 900);
  const n = ano(r, 2027);
  const s = 14100 / 0.94936;
  const baseCbs = s * 0.9799;
  perto(n.itens.das, s * 0.05064);
  perto(n.cbs, baseCbs * 0.112);
  perto(n.ibs, baseCbs * 0.001);
  perto(n.total, s * 0.05064 + baseCbs * 0.113);
  perto(n.creditoCliente, baseCbs * 0.113);
  perto(n.liquido, 14100);
});

test('Simples híbrido: compras geram crédito e o imposto não fica negativo', () => {
  const r = calcular({ ...servicoSimples, regime: 'hibrido', compras: 100000 });
  const n = ano(r, 2027);
  perto(n.cbs, 0);
  perto(n.ibs, 0);
});

test('Simples híbrido: grupo reduzido corta CBS e IBS', () => {
  const geral = ano(calcular({ ...servicoSimples, regime: 'hibrido' }), 2027);
  const r30 = ano(calcular({ ...servicoSimples, regime: 'hibrido', grupo: 'r30' }), 2027);
  assert.ok(r30.cbs < geral.cbs * 0.75);
});

test('Simples tradicional: grupo reduzido não muda o DAS e gera aviso', () => {
  const r = calcular({ ...servicoSimples, grupo: 'r30' });
  perto(ano(r, 2027).total, 900);
  assert.ok(r.avisos.some((a) => a.includes('DAS')));
});

test('Presumido, serviço, valor líquido mantido', () => {
  const e = { regime: 'presumido', atividade: 'servico', grupo: 'geral', faturamentoMes: 100000, receita12: 1200000, issPct: 5, repasse: 'liquido' };
  const r = calcular(e);
  const h = ano(r, 2026);
  perto(h.itens.iss, 5000);
  perto(h.itens.pisCofins, 3650);
  perto(h.total, 8650);
  const n = ano(r, 2027);
  perto(n.cbs, 10231.2);
  perto(n.ibs, 91.35);
  perto(n.itens.iss, 4807.89);
  perto(n.total, 15130.44);
  perto(n.precoCliente, 106480.44);
  const f = ano(r, 2033);
  perto(f.itens.iss, 0);
  perto(f.cbs, 10322.55);
  perto(f.ibs, 17082.45);
  perto(f.total, 27405);
  perto(f.liquido, 91350);
});

test('Presumido: repasse por preço mantém o que o cliente paga', () => {
  const e = { regime: 'presumido', atividade: 'servico', grupo: 'geral', faturamentoMes: 100000, receita12: 1200000, issPct: 5, repasse: 'preco' };
  const r = calcular(e);
  perto(ano(r, 2027).precoCliente, 100000);
  perto(ano(r, 2033).precoCliente, 100000);
  assert.ok(ano(r, 2033).liquido < 91350);
});

test('Presumido: IRPJ, CSLL e CPP quando pedidos', () => {
  const e = { regime: 'presumido', atividade: 'servico', grupo: 'geral', faturamentoMes: 100000, receita12: 1200000, issPct: 5, folha12: 240000, incluirRenda: true, repasse: 'liquido' };
  const h = ano(calcular(e), 2026);
  perto(h.itens.irpj, 32000 * 0.15 + 12000 * 0.1);
  perto(h.itens.csll, 32000 * 0.09);
  perto(h.itens.cpp, 4000);
  perto(h.outros, 4800 + 1200 + 2880 + 4000);
});

test('Presumido: presunção 10% maior acima de R$ 5 milhões por ano', () => {
  const e = { regime: 'presumido', atividade: 'servico', grupo: 'geral', faturamentoMes: 600000, receita12: 7200000, issPct: 5, incluirRenda: true, repasse: 'liquido' };
  const limite = 5000000 / 12;
  const base = limite * 0.32 + (600000 - limite) * 0.352;
  const h = ano(calcular(e), 2026);
  perto(h.itens.csll, base * 0.09);
});

test('Lucro Real, comércio, com compras', () => {
  const e = { regime: 'real', atividade: 'comercio', grupo: 'geral', faturamentoMes: 100000, receita12: 1200000, icmsPct: 18, compras: 60000, repasse: 'liquido' };
  const r = calcular(e);
  const h = ano(r, 2026);
  perto(h.itens.icms, 7200);
  perto(h.itens.pisCofins, 2035);
  perto(h.total, 9235);
  const n = ano(r, 2027);
  perto(n.itens.icms, 5535);
  perto(n.cbs, 1614.48);
  perto(n.ibs, 14.415);
  perto(n.total, 7163.9);
});

test('Regime regular: grupo reduz a alíquota, inclusive os 0,1 ponto', () => {
  const e = { regime: 'presumido', atividade: 'servico', grupo: 'r60', faturamentoMes: 100000, receita12: 1200000, issPct: 5, repasse: 'liquido' };
  const n = ano(calcular(e), 2027);
  perto(n.cbs, 91350 * 0.112 * 0.4);
  perto(n.ibs, 91350 * 0.001 * 0.4);
});

test('Regime regular: alíquota zero não paga CBS e IBS', () => {
  const e = { regime: 'presumido', atividade: 'comercio', grupo: 'zero', faturamentoMes: 100000, receita12: 1200000, icmsPct: 18, repasse: 'liquido' };
  const n = ano(calcular(e), 2033);
  perto(n.cbs, 0);
  perto(n.ibs, 0);
});

test('Regime regular: alíquota editada muda o resultado', () => {
  const e = { regime: 'presumido', atividade: 'servico', grupo: 'geral', faturamentoMes: 100000, receita12: 1200000, issPct: 5, repasse: 'liquido', cbsRef: { 2027: 9 } };
  perto(ano(calcular(e), 2027).cbs, 91350 * 0.089);
});

test('Regime regular: IPI some em 2027, salvo IPI mantido', () => {
  const base = { regime: 'presumido', atividade: 'industria', grupo: 'geral', faturamentoMes: 100000, receita12: 1200000, icmsPct: 18, ipiPct: 10, repasse: 'liquido' };
  perto(ano(calcular(base), 2026).itens.ipi, 10000);
  perto(ano(calcular(base), 2027).itens.ipi, 0);
  perto(ano(calcular({ ...base, ipiMantido: true }), 2027).itens.ipi, 10000);
});

test('MEI: valores fixos por atividade', () => {
  const base = { regime: 'mei', grupo: 'geral', faturamentoMes: 5000, receita12: 60000, repasse: 'liquido' };
  perto(ano(calcular({ ...base, atividade: 'comercio' }), 2026).total, 82.05);
  perto(ano(calcular({ ...base, atividade: 'comercio' }), 2027).total, 83.05);
  perto(ano(calcular({ ...base, atividade: 'servico' }), 2029).total, 86.75);
  perto(ano(calcular({ ...base, atividade: 'servico' }), 2033).ibs, 2);
});

test('Avisos de limite', () => {
  const m = calcular({ regime: 'mei', atividade: 'servico', grupo: 'geral', faturamentoMes: 10000, receita12: 120000, repasse: 'liquido' });
  assert.ok(m.avisos.some((a) => a.includes('81.000')));
  const s = calcular({ ...servicoSimples, receita12: 5000000 });
  assert.ok(s.avisos.some((a) => a.includes('4,8 milhões')));
});

test('Receita em 12 meses vazia vale 12 vezes o faturamento', () => {
  const { receita12, ...sem } = servicoSimples;
  perto(ano(calcular(sem), 2026).total, 900);
});

test('Simples traz o comparativo com a outra opção', () => {
  const r = calcular(servicoSimples);
  assert.equal(r.comparativo.regime, 'hibrido');
  assert.ok(r.comparativo.anos.find((l) => l.ano === 2027).total > 900);
  assert.equal(calcular({ ...servicoSimples, regime: 'presumido' }).comparativo, null);
});

test('Status de cada ano', () => {
  const p = calcular({ ...servicoSimples, regime: 'presumido', issPct: 5 });
  assert.deepEqual(p.anos.slice(0, 3).map((l) => l.status), ['lei', 'proposta', 'projecao']);
  assert.equal(ano(calcular(servicoSimples), 2030).status, 'lei');
});

test('Faturamento zero não quebra', () => {
  const r = calcular({ regime: 'presumido', atividade: 'servico', grupo: 'geral', faturamentoMes: 0, repasse: 'liquido' });
  assert.equal(ano(r, 2027).total, 0);
  assert.equal(ano(r, 2027).difHojePct, 0);
});
