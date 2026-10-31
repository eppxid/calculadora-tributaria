import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decimal, lerNumero, moeda, percentual } from '../formato.js';

test('lerNumero: formato brasileiro com milhar e vírgula', () => {
  assert.equal(lerNumero('15.000,50'), 15000.5);
  assert.equal(lerNumero('1.234.567,89'), 1234567.89);
  assert.equal(lerNumero('0,5'), 0.5);
});

test('lerNumero: inteiro sem separador', () => {
  assert.equal(lerNumero('15000'), 15000);
  assert.equal(lerNumero('7'), 7);
});

test('lerNumero: vazio, espaço e texto ilegível valem 0', () => {
  assert.equal(lerNumero(''), 0);
  assert.equal(lerNumero('   '), 0);
  assert.equal(lerNumero('abc'), 0);
  assert.equal(lerNumero('.'), 0);
  assert.equal(lerNumero(undefined), 0);
  assert.equal(lerNumero(null), 0);
});

test('lerNumero: ponto sem vírgula é milhar em grupos de três e decimal nos demais casos', () => {
  assert.equal(lerNumero('15.000'), 15000);
  assert.equal(lerNumero('1.500'), 1500);
  assert.equal(lerNumero('15.5'), 15.5);
  assert.equal(lerNumero('15.50'), 15.5);
});

test('lerNumero: ignora símbolo e espaço', () => {
  assert.equal(lerNumero('R$ 1.234,56'), 1234.56);
  assert.equal(lerNumero(' 12 345,6 '), 12345.6);
});

test('lerNumero: sinal só vale no início', () => {
  assert.equal(lerNumero('-10,5'), -10.5);
  assert.equal(lerNumero('5-3'), 53);
  assert.equal(lerNumero('-'), 0);
});

test('lerNumero: número fora do alcance não vira Infinity', () => {
  assert.equal(lerNumero('9'.repeat(400)), 0);
});

test('moeda: reais com milhar, vírgula e espaço comum', () => {
  assert.equal(moeda(1234.5), 'R$ 1.234,50');
  assert.equal(moeda(0), 'R$ 0,00');
  assert.equal(moeda(1000000), 'R$ 1.000.000,00');
});

test('moeda: negativo, arredondamento e valor inválido', () => {
  assert.equal(moeda(-5), '-R$ 5,00');
  assert.equal(moeda(-0.001), 'R$ 0,00');
  assert.equal(moeda(2.006), 'R$ 2,01');
  assert.equal(moeda(NaN), 'R$ 0,00');
  assert.equal(moeda(Infinity), 'R$ 0,00');
});

test('moeda: sinal explícito, exceto no zero', () => {
  assert.equal(moeda(913.5, { sinal: true }), '+R$ 913,50');
  assert.equal(moeda(-913.5, { sinal: true }), '-R$ 913,50');
  assert.equal(moeda(0, { sinal: true }), 'R$ 0,00');
  assert.equal(moeda(-0.004, { sinal: true }), 'R$ 0,00');
});

test('percentual: uma casa decimal e valor em pontos percentuais', () => {
  assert.equal(percentual(12.345), '12,3%');
  assert.equal(percentual(11.3), '11,3%');
  assert.equal(percentual(5), '5,0%');
  assert.equal(percentual(-8.26), '-8,3%');
  assert.equal(percentual(NaN), '0,0%');
});

test('percentual: sinal explícito e número de casas', () => {
  assert.equal(percentual(18.3, { sinal: true }), '+18,3%');
  assert.equal(percentual(-18.3, { sinal: true }), '-18,3%');
  assert.equal(percentual(0, { sinal: true }), '0,0%');
  assert.equal(percentual(-0.01, { sinal: true }), '0,0%');
  assert.equal(percentual(11.3, { casas: 2 }), '11,30%');
});

test('decimal: máscara do campo, sem símbolo', () => {
  assert.equal(decimal(15000.5), '15.000,50');
  assert.equal(decimal(0), '0,00');
  assert.equal(decimal(5, 0), '5');
});

test('lerNumero desfaz a máscara de decimal', () => {
  for (const n of [0, 0.5, 18, 15000.5, 1234567.89]) {
    assert.equal(lerNumero(decimal(n)), n);
  }
});
