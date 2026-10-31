import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcular, estudoHibrido } from '../calc.js';

const perto = (real, esperado, msg) => assert.ok(Math.abs(real - esperado) < 0.01, `${msg ?? ''} real ${real} esperado ${esperado}`);

// Anexo III, 2ª faixa: efetiva 8,6%. Em 2027: CBS 16,91%, IBS 0,19% e ISS 32% do DAS.
const base = {
  regime: 'tradicional', atividade: 'servico', anexoServico: 'III', grupo: 'geral',
  faturamentoMes: 30000, receita12: 360000,
};
const EF = 0.086;
const FATIA_NOVOS = 0.171;
const K = 1 - EF * 0.32; // base da CBS e do IBS: valor sem novos tributos, menos o ISS do DAS
const C = 0.113; // CBS 11,2% + IBS 0,1%
const PRECO_POR_S = 1 + K * C;
const LIQUIDO_POR_S = 1 - EF * (1 - FATIA_NOVOS);

test('Tradicional é a referência do estudo', () => {
  const e = estudoHibrido(base, 2027);
  perto(e.tradicional.faturamento, 30000);
  perto(e.tradicional.imposto, 2580);
  perto(e.tradicional.liquido, 27420);
  perto(e.tradicional.credito, 441.18);
});

test('Híbrido com o mesmo preço reduz o líquido', () => {
  const e = estudoHibrido(base, 2027);
  const s = 30000 / PRECO_POR_S;
  perto(e.mesmoPreco.faturamento, 30000);
  perto(e.mesmoPreco.liquido, s * LIQUIDO_POR_S);
  perto(e.mesmoPreco.imposto, 30000 - s * LIQUIDO_POR_S);
});

test('Faturamento sugerido recupera o líquido do tradicional', () => {
  const e = estudoHibrido(base, 2027);
  const esperado = (27420 / LIQUIDO_POR_S) * PRECO_POR_S;
  perto(e.sugerido.faturamento, esperado);
  perto(e.sugerido.liquido, 27420);
  perto(e.aumentoSugeridoPct, (esperado / 30000 - 1) * 100);
});

test('O sugerido coincide com o repasse do cálculo principal', () => {
  const r = calcular({ ...base, regime: 'hibrido', repasse: 'liquido' });
  const l = r.anos.find((a) => a.ano === 2027);
  perto(estudoHibrido(base, 2027).sugerido.faturamento, l.precoCliente);
});

test('Cliente com crédito aceita o preço que mantém o custo dele', () => {
  const e = estudoHibrido(base, 2027);
  const custoHoje = 30000 - 441.18;
  perto(e.comCredito, custoHoje * PRECO_POR_S);
  perto(e.aumentoComCreditoPct, (custoHoje * PRECO_POR_S / 30000 - 1) * 100);
});

test('Sem vendas a empresas o preço médio fica igual e não compensa', () => {
  const e = estudoHibrido({ ...base, vendasEmpresasPct: 0 }, 2027);
  perto(e.teto.faturamento, 30000);
  perto(e.ganho, e.mesmoPreco.liquido - 27420);
  assert.equal(e.compensa, false);
});

test('O preço médio segue a parte das vendas para empresas', () => {
  const e = estudoHibrido({ ...base, vendasEmpresasPct: 50 }, 2027);
  perto(e.teto.faturamento, 30000 + (e.comCredito - 30000) * 0.5);
  perto(e.ganho, e.teto.liquido - 27420);
});

test('Com todas as vendas para empresas com crédito, o caso sem compras fica perto do empate', () => {
  const e = estudoHibrido({ ...base, vendasEmpresasPct: 100 }, 2027);
  assert.equal(e.compensa, true);
  assert.ok(e.ganho >= 0 && e.ganho < 100, `ganho ${e.ganho}`);
  const esperado = ((e.sugerido.faturamento - 30000) / (e.comCredito - 30000)) * 100;
  perto(e.empateVendasPct, esperado);
  assert.ok(e.empateVendasPct > 90);
});

test('Compras com crédito reduzem o faturamento necessário', () => {
  const sem = estudoHibrido(base, 2027);
  const com = estudoHibrido({ ...base, compras: 10000 }, 2027);
  assert.ok(com.sugerido.faturamento < sem.sugerido.faturamento);
  assert.ok(com.empateVendasPct < sem.empateVendasPct);
  perto(com.sugerido.liquido, 27420);
});

test('Compras de empate zeram o ganho nas vendas informadas', () => {
  const e = estudoHibrido({ ...base, vendasEmpresasPct: 50 }, 2027);
  assert.ok(e.empateCompras > 0);
  const conferido = estudoHibrido({ ...base, vendasEmpresasPct: 50, compras: e.empateCompras }, 2027);
  perto(conferido.ganho, 0);
});

test('Quando já compensa, o empate fica em zero', () => {
  const e = estudoHibrido({ ...base, compras: 30000, vendasEmpresasPct: 100 }, 2027);
  assert.equal(e.compensa, true);
  perto(e.empateVendasPct, 0);
  perto(e.empateCompras, 0);
});

test('Matriz de possibilidades: dimensões, início e sentido', () => {
  const { matriz, ganho } = estudoHibrido({ ...base, vendasEmpresasPct: 0 }, 2027);
  assert.deepEqual(matriz.vendas, [0, 25, 50, 75, 100]);
  assert.deepEqual(matriz.compras, [0, 20, 40, 60]);
  assert.equal(matriz.ganhos.length, 5);
  assert.ok(matriz.ganhos.every((linha) => linha.length === 4));
  perto(matriz.ganhos[0][0], ganho);
  for (const linha of matriz.ganhos) {
    for (let j = 1; j < linha.length; j++) assert.ok(linha[j] >= linha[j - 1]);
  }
  for (let i = 1; i < 5; i++) assert.ok(matriz.ganhos[i][0] > matriz.ganhos[i - 1][0]);
});

test('A célula da matriz bate com o estudo do mesmo cenário', () => {
  const { matriz } = estudoHibrido(base, 2027);
  const direto = estudoHibrido({ ...base, vendasEmpresasPct: 50, compras: 12000 }, 2027);
  perto(matriz.ganhos[2][2], direto.ganho);
});

test('Receita de 12 meses vazia mantém a faixa nas simulações', () => {
  const { receita12, ...sem } = base;
  perto(estudoHibrido(sem, 2027).sugerido.faturamento, estudoHibrido(base, 2027).sugerido.faturamento);
});

test('Partir do híbrido dá o mesmo estudo', () => {
  perto(estudoHibrido({ ...base, regime: 'hibrido' }, 2027).sugerido.faturamento, estudoHibrido(base, 2027).sugerido.faturamento);
});

test('O repasse escolhido não muda o estudo', () => {
  perto(estudoHibrido({ ...base, repasse: 'preco' }, 2027).sugerido.faturamento, estudoHibrido(base, 2027).sugerido.faturamento);
});

test('Grupo reduzido baixa o faturamento necessário', () => {
  const geral = estudoHibrido(base, 2027);
  const r60 = estudoHibrido({ ...base, grupo: 'r60' }, 2027);
  assert.ok(r60.sugerido.faturamento < geral.sugerido.faturamento);
});

test('Alíquota zero: compensa sem vendas a empresas e o cliente com crédito aceita menos', () => {
  const e = estudoHibrido({ ...base, grupo: 'zero', vendasEmpresasPct: 0 }, 2033);
  assert.equal(e.compensa, true);
  assert.ok(e.sugerido.faturamento < 30000);
  assert.ok(e.comCredito < 30000);
  perto(e.empateVendasPct, 0);
});

test('Com todas as vendas para clientes com crédito, o híbrido nunca perde', () => {
  for (const cbs of [5, 11.3, 20, 40]) {
    for (const receita12 of [180000, 360000, 1200000, 3000000]) {
      const e = estudoHibrido({ ...base, receita12, vendasEmpresasPct: 100, cbsRef: { 2027: cbs } }, 2027);
      assert.ok(e.ganho >= -0.01, `CBS ${cbs}, receita ${receita12}: ganho ${e.ganho}`);
      assert.notEqual(e.empateVendasPct, null);
    }
  }
});

test('Funciona na 6ª faixa e em 2033', () => {
  const e = estudoHibrido({
    regime: 'tradicional', atividade: 'comercio', grupo: 'geral', faturamentoMes: 350000, receita12: 4200000, icmsPct: 18,
  }, 2033);
  assert.ok(Number.isFinite(e.sugerido.faturamento));
  perto(e.sugerido.liquido, e.tradicional.liquido);
});

test('Só vale para o Simples, de 2027 em diante e com faturamento', () => {
  assert.equal(estudoHibrido({ ...base, regime: 'presumido' }, 2027), null);
  assert.equal(estudoHibrido({ ...base, regime: 'real' }, 2027), null);
  assert.equal(estudoHibrido({ ...base, regime: 'mei' }, 2027), null);
  assert.equal(estudoHibrido(base, 2026), null);
  assert.equal(estudoHibrido({ ...base, faturamentoMes: 0 }, 2027), null);
});
