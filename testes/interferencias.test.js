import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interferencias } from '../calc.js';

const perto = (real, esperado) => assert.ok(Math.abs(real - esperado) < 0.01, `real ${real} esperado ${esperado}`);

const presumido = { regime: 'presumido', atividade: 'servico', grupo: 'geral', faturamentoMes: 100000, receita12: 1200000, issPct: 5 };
const tradicional = { regime: 'tradicional', atividade: 'servico', anexoServico: 'III', grupo: 'geral', faturamentoMes: 15000, receita12: 180000 };

test('Presumido: compras reduzem o imposto pelo valor do crédito', () => {
  const r = interferencias(presumido, 2027);
  const compras = r.itens.find((i) => i.fator === 'compras');
  perto(compras.dif, -20000 * 0.113);
});

test('Presumido: CBS 1 ponto maior soma 1% da base', () => {
  const cbs = interferencias(presumido, 2027).itens.find((i) => i.fator === 'cbs');
  perto(cbs.dif, 913.5);
});

test('Simples tradicional: compras e alíquota da CBS não interferem no DAS', () => {
  const r = interferencias(tradicional, 2027);
  assert.ok(r.semEfeito.some((f) => f.includes('Comprar mais')));
  assert.ok(r.semEfeito.some((f) => f.includes('CBS de referência')));
  assert.ok(r.semEfeito.some((f) => f.includes('redução de 60%')));
});

test('Simples tradicional: o híbrido aparece como troca de regime', () => {
  const r = interferencias(tradicional, 2027);
  const hibrido = r.itens.find((i) => i.frase.includes('Simples híbrido'));
  assert.ok(hibrido.dif > 0);
  assert.ok(hibrido.difCredito >= 0);
});

test('Itens saem do maior impacto para o menor', () => {
  const { itens } = interferencias(presumido, 2033);
  for (let i = 1; i < itens.length; i++) {
    assert.ok(Math.abs(itens[i - 1].dif) >= Math.abs(itens[i].dif));
  }
});

test('Vendas para empresas mudam o crédito do cliente, não o imposto', () => {
  const c = interferencias(presumido, 2027).itens.find((i) => i.fator === 'clientes');
  perto(c.dif, 0);
  assert.ok(c.difCredito > 0);
});

test('Fator R aparece só quando a escolha é automática', () => {
  const e = { ...tradicional, anexoServico: 'fatorR', folha12: 60000 };
  assert.ok(interferencias(e, 2027).itens.some((i) => i.fator === 'fatorR'));
  assert.ok(!interferencias(tradicional, 2027).itens.some((i) => i.fator === 'fatorR'));
});

test('IBS só interfere a partir de 2029', () => {
  assert.ok(!interferencias(presumido, 2028).itens.some((i) => i.fator === 'ibs'));
  assert.ok(interferencias(presumido, 2029).itens.some((i) => i.fator === 'ibs'));
});
