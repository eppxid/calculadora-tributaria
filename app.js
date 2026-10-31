// Tela da calculadora: lê o formulário, chama calc.js e desenha o resultado.
// Nada do que o usuário digita sai desta página: sem rede, sem armazenamento, sem dados na URL.
// Todo texto entra por textContent e createElement, nunca como HTML.

import { calcular, estudoHibrido, interferencias, rotuloRegime } from './calc.js';
import { REGRAS } from './dados/regras.js';
import { decimal, lerNumero, moeda, percentual } from './formato.js';

const $ = (id) => document.getElementById(id);

const LIMITE_VALOR = 1e12;
const ATRASO_MS = 120;
const LIMIAR_ZERO = 0.005;
const ANO_INICIAL = 2027;
const INTERF_VISIVEIS = 6;

const HOJE = new Date();
const MES_HOJE = String(HOJE.getMonth() + 1).padStart(2, '0');

// Nome do tributo na ordem em que o detalhe do ano os lista. O DAS não entra: ele reúne os outros.
const TRIBUTOS = [
  ['pisCofins', 'PIS e Cofins'],
  ['icms', 'ICMS'],
  ['iss', 'ISS'],
  ['ipi', 'IPI'],
  ['cbs', 'CBS'],
  ['ibs', 'IBS'],
  ['irpj', 'IRPJ'],
  ['csll', 'CSLL'],
  ['cpp', 'CPP (INSS patronal)'],
  ['inss', 'INSS do MEI'],
];

const ATIVIDADES = { comercio: 'comércio', industria: 'indústria', servico: 'serviço' };
const REPASSES = { liquido: 'repassar e manter o valor líquido', preco: 'manter o preço ao cliente' };
const SITUACOES = { lei: 'lei', proposta: 'proposta', projecao: 'projeção' };
const SITUACOES_LONGAS = { lei: 'Tabela da lei', proposta: 'CBS proposta pelo TCU', projecao: 'Projeção' };
const SEGMENTOS = ['antigos', 'cbs', 'ibs', 'outros'];

const AJUDA_REGIME = {
  mei: 'Paga valores fixos por mês. Receita até R$ 81.000 por ano.',
  tradicional: 'Paga tudo numa guia só, o DAS. CBS e IBS ficam dentro dela.',
  hibrido: 'O DAS sai sem CBS e IBS. Você paga os dois à parte e gera crédito ao cliente.',
  presumido: 'O imposto de renda parte de uma margem presumida da receita.',
  real: 'O imposto de renda parte do lucro apurado. PIS e Cofins geram crédito.',
};

const MSG_VAZIO = 'Informe o faturamento do mês para ver o cálculo.';
const MSG_ERRO = 'Não foi possível calcular com estes valores. Confira os campos.';

let ultimo = null; // { entrada, resultado } do último cálculo bom
let temporizador = 0;
let ultimaManchete = '';
let anoSelecionado = ANO_INICIAL;
let campoRecemFocado = null;

/* ---------- DOM ---------- */

function el(tag, atributos = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos)) {
    if (valor === false || valor == null) continue;
    if (chave === 'class') no.className = valor;
    else no.setAttribute(chave, valor === true ? '' : valor);
  }
  no.append(...filhos);
  return no;
}

const th = (texto, classe, extra) => el('th', { scope: 'col', class: classe, ...extra }, texto);
const td = (conteudo, classe) => el('td', { class: classe }, ...[conteudo].flat());

const sinalDe = (v) => (v > LIMIAR_ZERO ? 'sobe' : v < -LIMIAR_ZERO ? 'desce' : '');

// A primeira linha é "hoje": mês corrente em 2026, ou só o ano se a página abrir depois de 2026.
function rotuloData(ano) {
  if (ano !== 2026) return `01/${ano}`;
  return HOJE.getFullYear() === 2026 ? `${MES_HOJE}/2026` : '2026';
}

/* ---------- Formulário ---------- */

const marcado = (nome) => document.querySelector(`input[name="${nome}"]:checked`).value;

// Limites vêm de data-min e data-max no campo. Campo vazio ou ilegível vale 0, depois do limite mínimo.
function valorDe(id) {
  const campo = $(id);
  const minimo = Number(campo.dataset.min ?? 0);
  const maximo = Number(campo.dataset.max ?? LIMITE_VALOR);
  return Math.min(maximo, Math.max(minimo, lerNumero(campo.value)));
}

function mascarar(campo) {
  if (campo.value.trim() === '') return;
  campo.value = decimal(valorDe(campo.id));
}

function lerEntrada() {
  const regime = marcado('regime');
  const atividade = marcado('atividade');
  const mei = regime === 'mei';
  const faixaAnos = (prefixo, tabela) =>
    Object.fromEntries(Object.keys(tabela).map((ano) => [ano, valorDe(`${prefixo}-${ano}`)]));
  return {
    regime,
    atividade,
    anexoServico: $('anexo').value,
    grupo: mei ? 'geral' : $('grupo').value,
    faturamentoMes: valorDe('faturamento'),
    receita12: valorDe('receita12'),
    folha12: valorDe('folha12'),
    compras: mei ? 0 : valorDe('compras'),
    comprasSimples: mei ? 0 : valorDe('comprasSimples'),
    vendasEmpresasPct: mei ? 0 : valorDe('vendas'),
    icmsPct: valorDe('icms'),
    issPct: valorDe('iss'),
    ipiPct: valorDe('ipi'),
    margemPct: valorDe('margem'),
    ipiMantido: atividade === 'industria' && $('ipiMantido').checked,
    incluirRenda: !mei && $('incluirRenda').checked,
    repasse: marcado('repasse'),
    cbsRef: faixaAnos('cbs', REGRAS.cbsRef),
    ibsRef: faixaAnos('ibs', REGRAS.ibsRef),
    salarioMinimo: valorDe('salarioMinimo'),
  };
}

function ajustarFormulario() {
  const regime = marcado('regime');
  const atividade = marcado('atividade');
  const mei = regime === 'mei';
  const simples = regime === 'tradicional' || regime === 'hibrido';
  const servico = atividade === 'servico';
  const renda = $('incluirRenda').checked;
  const mostrar = (id, visivel) => { $(id).hidden = !visivel; };

  $('ajuda-regime').textContent = AJUDA_REGIME[regime];

  mostrar('campo-anexo', servico && simples);
  const anexo = $('anexo').value;
  mostrar('ajuda-anexo', anexo === 'fatorR');
  mostrar('campo-folha', (servico && simples && (anexo === 'IV' || anexo === 'fatorR')) || (!mei && renda));

  // Em MEI o grupo não muda nada: o campo volta para "geral" e fica desativado.
  if (mei) $('grupo').value = 'geral';
  $('grupo').disabled = mei;
  $('ajuda-grupo').textContent = REGRAS.grupos[$('grupo').value].rotulo;
  $('ajuda-grupo').hidden = mei || $('grupo').value === 'geral';

  mostrar('d-compras', !mei);
  mostrar('d-local', !mei);
  mostrar('d-renda', !mei);
  mostrar('campo-uf', !servico);
  mostrar('campo-icms', !servico);
  mostrar('campo-iss', servico);
  mostrar('campo-ipi', atividade === 'industria');
  mostrar('campo-ipi-mantido', atividade === 'industria');

  mostrar('campo-margem', regime === 'real' && renda);
  $('aj-renda').textContent = simples
    ? 'O DAS já inclui IRPJ e CSLL. Esta opção soma só a CPP do Anexo IV, que fica fora do DAS.'
    : 'Soma IRPJ, CSLL e CPP ao total de cada data.';

  mostrar('campo-salario', mei);
  resumirAjustes(atividade);
}

// Cada ajuste fechado mostra o valor em uso: o leitor confere sem precisar abrir.
function resumirAjustes(atividade) {
  const receita = valorDe('receita12');
  $('r-receita').textContent = receita > 0 ? moeda(receita) : '12 × faturamento';

  const compras = valorDe('compras') + valorDe('comprasSimples');
  const vendas = valorDe('vendas');
  const partes = [];
  if (compras > 0) partes.push(moeda(compras));
  if (vendas > 0) partes.push(percentual(vendas, { casas: 0 }));
  $('r-compras').textContent = partes.join(' e ') || 'Nada informado';

  $('r-local').textContent = atividade === 'servico'
    ? `ISS ${percentual(valorDe('iss'), { casas: 2 })}`
    : `${$('uf').value}, ICMS ${percentual(valorDe('icms'), { casas: 2 })}`;
  $('r-renda').textContent = $('incluirRenda').checked ? 'Na conta' : 'Fora da conta';
  $('r-repasse').textContent = marcado('repasse') === 'liquido' ? 'Repassa a diferença' : 'Mantém o preço';
  $('r-aliquotas').textContent = `CBS ${percentual(valorDe('cbs-2027'))}, IBS ${percentual(valorDe('ibs-2033'))}`;
}

/* ---------- Resultado ---------- */

function mostrarMensagem(texto) {
  ultimo = null;
  if (ultimaManchete !== texto) {
    ultimaManchete = texto;
    $('manchete').replaceChildren(el('p', { class: 'vazio' }, texto));
  }
  $('conteudo').hidden = true;
  $('imprimir').hidden = true;
  $('fixo').hidden = true;
  $('escopo').textContent = '';
  $('resumo-impressao').replaceChildren();
}

const linhaFinita = (l) =>
  [l.total, l.cbs, l.ibs, l.antigos, l.outros, l.precoCliente, l.creditoCliente, l.difHoje, l.difHojePct]
    .every(Number.isFinite);

function atualizar() {
  ajustarFormulario();
  const entrada = lerEntrada();
  if (!(entrada.faturamentoMes > 0)) {
    mostrarMensagem(MSG_VAZIO);
    return;
  }
  try {
    const resultado = calcular(entrada);
    const conjuntos = [resultado.anos, resultado.comparativo?.anos ?? []];
    if (!conjuntos.every((anos) => anos.every(linhaFinita))) throw new Error('resultado não finito');
    ultimo = { entrada, resultado };
    desenhar();
  } catch (erro) {
    console.error(erro);
    mostrarMensagem(MSG_ERRO);
  }
}

function desenhar() {
  const { entrada, resultado } = ultimo;
  desenharEscopo(resultado.entrada);
  desenharManchete(resultado.anos);
  desenharAvisos(resultado.avisos);
  desenharTabela(resultado.anos);
  desenharComparativo(resultado);
  desenharResumo(resultado.entrada);
  desenharAno(entrada, resultado);
  $('conteudo').hidden = false;
  $('imprimir').hidden = false;
  $('fixo').hidden = false;
}

function desenharAno(entrada = ultimo.entrada, resultado = ultimo.resultado) {
  const ano = anoSelecionado;
  document.querySelectorAll('#rolagem-tabela tbody tr').forEach((linha) => {
    const atual = Number(linha.dataset.ano) === ano;
    linha.classList.toggle('selecionado', atual);
    linha.querySelector('button').setAttribute('aria-pressed', String(atual));
  });
  $('t-interf').textContent = `O que interfere em ${rotuloData(ano)}`;
  $('t-detalhe').textContent = `Tributos em ${rotuloData(ano)}`;
  desenharDetalhe(resultado, ano);
  desenharInterferencias(entrada, ano);
  desenharLeitura(resultado, ano);
  desenharEstudo(entrada, ano);
}

const porAno = (anos, ano) => anos.find((l) => l.ano === ano);

function desenharEscopo(e) {
  $('escopo').textContent =
    `${rotuloRegime(e.regime)}, ${ATIVIDADES[e.atividade]}, faturamento de ${moeda(e.faturamentoMes)}. Estimativa.`;
}

function colunaFaixa(rotulo, linha, lead) {
  const compoe = linha.ano === 2026
    ? `Tributos antigos ${moeda(linha.antigos)}`
    : `sendo CBS ${moeda(linha.cbs)} e IBS ${moeda(linha.ibs)}`;
  const situacao = SITUACOES_LONGAS[linha.status];
  const diferenca = Math.abs(linha.difHoje) < LIMIAR_ZERO
    ? [`Igual a hoje. ${situacao}.`]
    : [el('b', { class: sinalDe(linha.difHoje) },
        `${moeda(linha.difHoje, { sinal: true })} (${percentual(linha.difHojePct, { sinal: true })})`),
       ` sobre hoje. ${situacao}.`];
  return el('div', { class: `faixa__col${lead ? ' faixa__col--lead' : ''}` },
    el('p', { class: 'faixa__rotulo' }, rotulo),
    el('p', { class: 'faixa__valor' }, moeda(linha.total)),
    el('p', { class: 'faixa__novos' }, compoe),
    linha.ano === 2026 ? '' : el('p', { class: 'faixa__dif' }, ...diferenca));
}

// Três colunas que se leem como uma frase: hoje paga X; em 01/2027 pagará Y, sendo CBS e IBS.
function desenharManchete(anos) {
  const hoje = porAno(anos, 2026);
  const inicio = porAno(anos, 2027);
  const fim = porAno(anos, 2033);
  $('fixo-texto').textContent = `01/2027: ${moeda(inicio.total)}`;
  // Compara o texto antes de trocar o DOM: a região aria-live só fala quando o conteúdo muda.
  const chave = [hoje, inicio, fim].map((l) => `${l.total}|${l.cbs}|${l.ibs}|${l.status}`).join(';');
  if (chave === ultimaManchete) return;
  ultimaManchete = chave;
  $('manchete').replaceChildren(
    colunaFaixa(`Em ${rotuloData(2026)} você paga`, hoje, false),
    colunaFaixa('Em 01/2027 pagará', inicio, true),
    colunaFaixa('Em 01/2033, no fim da transição, pagará', fim, false));
}

function desenharAvisos(avisos) {
  $('avisos').replaceChildren(...avisos.map((texto) => el('li', { class: 'aviso' }, texto)));
  $('avisos').hidden = avisos.length === 0;
}

function barraComposicao(linha, maior) {
  const segmentos = SEGMENTOS.map((nome) => {
    const parte = el('i', { class: `seg seg--${nome}` });
    parte.style.width = `${(Math.max(0, linha[nome]) / maior) * 100}%`;
    return parte;
  });
  return el('div', {
    class: 'comp',
    role: 'img',
    'aria-label': `Tributos antigos ${moeda(linha.antigos)}, CBS ${moeda(linha.cbs)}, IBS ${moeda(linha.ibs)}, outros ${moeda(linha.outros)}.`,
  }, ...segmentos);
}

function desenharTabela(anos) {
  const comOutros = anos.some((l) => l.outros >= LIMIAR_ZERO);
  const maior = Math.max(...anos.map((l) => l.total), 0.01);
  const cabecalho = el('tr', {},
    th('Data'), th('Tributos antigos', 'num'), th('CBS', 'num'), th('IBS', 'num'),
    comOutros ? th('Outros', 'num') : '',
    th('Total', 'num'), th('Sobre hoje', 'num'), th('Preço ao cliente', 'num'), th('Crédito ao cliente', 'num'),
    th('Composição', 'comp-col'));

  const corpo = anos.map((l) => {
    const igual = Math.abs(l.difHoje) < LIMIAR_ZERO;
    const diferenca = l.ano === 2026
      ? '—'
      : igual
        ? decimal(0)
        : [moeda(l.difHoje, { sinal: true }).replace('R$ ', ''),
           el('span', { class: 'dif__pct' }, percentual(l.difHojePct, { sinal: true }))];
    return el('tr', { 'data-ano': l.ano },
      el('th', { scope: 'row' },
        el('button', { type: 'button', class: 'ano-botao' }, rotuloData(l.ano)),
        l.teste ? el('sup', {}, '1') : '',
        el('span', { class: 'situacao' }, SITUACOES[l.status])),
      td(decimal(l.antigos), 'num'), td(decimal(l.cbs), 'num'), td(decimal(l.ibs), 'num'),
      comOutros ? td(decimal(l.outros), 'num') : '',
      td(decimal(l.total), 'num total'),
      td(diferenca, 'num'),
      td(decimal(l.precoCliente), 'num'), td(decimal(l.creditoCliente), 'num'),
      td(barraComposicao(l, maior), 'comp-col'));
  });

  $('rolagem-tabela').replaceChildren(
    el('table', { class: 'tabela tabela--larga ano-tabela' },
      el('caption', { class: 'so-leitor' }, 'Imposto de cada data da transição'),
      el('thead', {}, cabecalho),
      el('tbody', {}, ...corpo)));

  const notas = ['Valores em reais, por mês. Escolha uma data para ver os tributos e o que interfere nela.'];
  const teste = anos[0].teste;
  if (teste) {
    notas.push(`1 Em ${rotuloData(2026)}, a CBS de teste (${moeda(teste.cbs)}) e o IBS de teste (${moeda(teste.ibs)}) são informativos. Você não paga esses valores.`);
  }
  notas.push(`Tributos antigos reúnem PIS, Cofins, ICMS, ISS e IPI.${comOutros ? ' Outros reúnem IRPJ, CSLL, CPP e INSS.' : ''} Crédito ao cliente é a parte de CBS e IBS que a empresa compradora aproveita.`);
  $('notas-tabela').replaceChildren(...notas.map((texto) => el('li', {}, texto)));
}

function desenharDetalhe(resultado, ano) {
  const linha = porAno(resultado.anos, ano);
  const itens = TRIBUTOS.filter(([chave]) => Math.abs(linha.itens[chave]) >= LIMIAR_ZERO);
  const fila = (nome, valor, classe) =>
    el('tr', { class: classe }, el('th', { scope: 'row' }, nome), el('td', {}, moeda(valor)));

  $('detalhe').replaceChildren(el('table', { class: 'detalhe' },
    el('caption', { class: 'so-leitor' }, `Tributos em ${rotuloData(ano)}`),
    el('tbody', {},
      ...itens.map(([chave, nome]) => fila(nome, linha.itens[chave])),
      fila('Total do mês', linha.total, 'soma'),
      fila('Preço ao cliente', linha.precoCliente, 'fim'),
      fila('Crédito ao cliente', linha.creditoCliente, 'fim'),
      fila('Valor líquido da empresa', linha.liquido, 'fim'))));

  const regime = resultado.entrada.regime;
  const noSimples = regime === 'tradicional' || regime === 'hibrido';
  const das = linha.itens.das;
  const partes = [];
  if (noSimples) partes.push(`Anexo ${resultado.anexoPorAno[ano]}`);
  if (das >= LIMIAR_ZERO) partes.push(`DAS de ${moeda(das)}`);
  if (regime === 'hibrido' && ano >= 2027) partes.push('CBS e IBS fora do DAS');
  $('anexo-ano').hidden = partes.length === 0;
  $('anexo-ano').textContent = partes.join(', ');
}

function desenharComparativo(resultado) {
  const secao = $('sec-comparativo');
  const outro = resultado.comparativo;
  secao.hidden = !outro;
  if (!outro) return;

  const nomeA = rotuloRegime(resultado.entrada.regime);
  const nomeB = rotuloRegime(outro.regime);
  const corpo = resultado.anos.map((a, i) => {
    const b = outro.anos[i];
    return el('tr', {},
      el('th', { scope: 'row' }, rotuloData(a.ano)),
      td(moeda(a.total), 'num total'), td(moeda(a.creditoCliente), 'num'),
      td(moeda(b.total), 'num total'), td(moeda(b.creditoCliente), 'num'));
  });

  $('rolagem-comparativo').replaceChildren(
    el('table', { class: 'tabela tabela--media' },
      el('caption', { class: 'so-leitor' }, `${nomeA} e ${nomeB}, por data`),
      el('thead', {},
        el('tr', {},
          el('td'),
          th(nomeA, 'grupo-col', { colspan: 2, scope: 'colgroup' }),
          th(nomeB, 'grupo-col', { colspan: 2, scope: 'colgroup' })),
        el('tr', {}, th('Data'), th('Total', 'num'), th('Crédito ao cliente', 'num'),
          th('Total', 'num'), th('Crédito ao cliente', 'num'))),
      el('tbody', {}, ...corpo)));
}

function desenharLeitura(resultado, anoEscolhido) {
  const outro = resultado.comparativo;
  if (!outro) return;
  const noHibrido = resultado.entrada.regime === 'hibrido';
  const ano = Math.max(anoEscolhido, ANO_INICIAL);
  const tradicional = porAno(noHibrido ? outro.anos : resultado.anos, ano);
  const hibrido = porAno(noHibrido ? resultado.anos : outro.anos, ano);
  const custo = hibrido.total - tradicional.total;
  const ganho = hibrido.creditoCliente - tradicional.creditoCliente;

  const textos = [
    custo >= 0
      ? `Em ${rotuloData(ano)}, o híbrido custa ${moeda(custo)} a mais por mês.`
      : `Em ${rotuloData(ano)}, o híbrido custa ${moeda(-custo)} a menos por mês.`,
    resultado.entrada.vendasEmpresasPct > 0
      ? `O cliente empresa recebe ${moeda(ganho)} a mais de crédito por mês.`
      : 'Informe as vendas para empresas em Compras e clientes para ver o crédito ao cliente.',
    'A opção vale por semestre e não muda dentro dele. As janelas ficam em setembro e março.',
  ];
  $('comp-leitura').replaceChildren(...textos.map((texto) => el('p', {}, texto)));
}

function desenharEstudo(entrada, anoEscolhido) {
  const ano = Math.max(anoEscolhido, ANO_INICIAL);
  const estudo = estudoHibrido(entrada, ano);
  $('sec-estudo').hidden = !estudo;
  if (!estudo) return;

  $('t-estudo').textContent = `Estudo: mudar para o híbrido em ${rotuloData(ano)}`;
  desenharCenariosEstudo(estudo);
  desenharMatriz(estudo.matriz);
  desenharCompensacao(estudo, rotuloData(ano));
}

function desenharCenariosEstudo(e) {
  const cenarios = [
    ['Simples tradicional', e.tradicional],
    ['Híbrido, mesmo preço', e.mesmoPreco],
    e.vendasPct > 0 ? ['Híbrido, preço aceito', e.teto] : null,
    ['Híbrido, sugerido', e.sugerido],
  ].filter(Boolean);

  $('estudo-cenarios').replaceChildren(
    el('table', { class: 'tabela tabela--media' },
      el('caption', { class: 'so-leitor' }, 'Cenários da mudança para o híbrido'),
      el('thead', {}, el('tr', {}, th('Cenário'), th('Faturamento', 'num'), th('Imposto', 'num'),
        th('Fica com a empresa', 'num'), th('Diferença', 'num'))),
      el('tbody', {}, ...cenarios.map(([nome, c], i) => {
        const dif = c.liquido - e.tradicional.liquido;
        return el('tr', {},
          el('th', { scope: 'row' }, nome),
          td(decimal(c.faturamento), 'num'), td(decimal(c.imposto), 'num'),
          td(decimal(c.liquido), 'num total'),
          td(i === 0 ? '—' : Math.abs(dif) < LIMIAR_ZERO ? decimal(0) : moeda(dif, { sinal: true }).replace('R$ ', ''), 'num'));
      }))));
}

function desenharMatriz({ vendas, compras, ganhos }) {
  const cabecalho = compras.map((pct) => th(pct === 0 ? 'Sem compras' : `Compras de ${pct}%`, 'num'));
  $('estudo-matriz').replaceChildren(
    el('table', { class: 'tabela tabela--media matriz' },
      el('caption', { class: 'so-leitor' }, 'Ganho ou perda por mês conforme as vendas para empresas e as compras com crédito, em porcentagem do faturamento'),
      el('thead', {}, el('tr', {}, th('Vendas para empresas'), ...cabecalho)),
      el('tbody', {}, ...vendas.map((pct, i) =>
        el('tr', {},
          el('th', { scope: 'row' }, percentual(pct, { casas: 0 })),
          ...ganhos[i].map((ganho) => td(moeda(ganho, { sinal: true }), `num${ganho >= 0 ? ' ganho' : ''}`)))))));
}

function textoEmpate(e) {
  if (e.empateVendasPct === 0) return 'Compensa mesmo sem vendas para empresas.';
  if (e.empateVendasPct === null) return 'Nem com todas as vendas para empresas o híbrido empata.';
  return `Empata com ${percentual(e.empateVendasPct)} das vendas para empresas.`;
}

function textoCompras(e) {
  if (e.compensa) return null;
  return e.empateCompras === null
    ? 'Compras com crédito sozinhas não fecham a conta.'
    : `Nas vendas informadas, empata com ${moeda(e.empateCompras)} por mês em compras com crédito.`;
}

function desenharCompensacao(e, data) {
  $('estudo-valor').textContent = moeda(e.sugerido.faturamento);
  $('estudo-sub').textContent =
    `${percentual(e.aumentoSugeridoPct, { sinal: true })} sobre ${moeda(e.tradicional.faturamento)}. Mantém ${moeda(e.tradicional.liquido)} para a empresa em ${data}.`;

  const veredito = e.compensa
    ? `Compensa: sobram ${moeda(e.ganho)} por mês.`
    : `Não compensa neste cenário: faltam ${moeda(-e.ganho)} por mês.`;
  const textos = [
    `O cliente com crédito aceita ${percentual(e.aumentoComCreditoPct, { sinal: true })} no preço sem pagar mais do que hoje.`,
    e.vendasPct > 0
      ? `Com ${percentual(e.vendasPct, { casas: 0 })} das vendas para empresas, o faturamento médio aceito é ${moeda(e.teto.faturamento)}.`
      : 'Informe as vendas para empresas em Compras e clientes para medir o preço aceito.',
    textoEmpate(e),
    textoCompras(e),
  ].filter(Boolean);

  $('estudo-leitura').replaceChildren(
    el('p', { class: `estudo__veredito${e.compensa ? ' ganho' : ''}` }, veredito),
    ...textos.map((texto) => el('p', {}, texto)));
}

function desenharResumo(e) {
  $('resumo-impressao').textContent =
    `Calculado em ${HOJE.toLocaleDateString('pt-BR')}. Dados informados: ${rotuloRegime(e.regime)}; ${ATIVIDADES[e.atividade]}; ` +
    `faturamento do mês ${moeda(e.faturamentoMes)}; receita em 12 meses ${moeda(e.receita12)}; ` +
    `grupo: ${REGRAS.grupos[e.grupo].rotulo}; repasse: ${REPASSES[e.repasse]}.`;
}

function linhaInterf(i) {
  return el('li', {},
    el('span', {}, i.frase),
    el('span', { class: `interf__valor ${sinalDe(i.dif)}` }, moeda(i.dif, { sinal: true })),
    Math.abs(i.difCredito) >= LIMIAR_ZERO
      ? el('span', { class: 'interf__cred' }, `Crédito ao cliente: ${moeda(i.difCredito, { sinal: true })}`)
      : '');
}

function desenharInterferencias(entrada, ano) {
  const { base, itens, semEfeito } = interferencias(entrada, ano);
  const trocaRegime = itens.some((i) => i.fator === 'regime');
  $('interf-ref').textContent =
    `Efeito sobre o total de ${moeda(base)} em ${rotuloData(ano)}, mudando um fator por vez.` +
    (trocaRegime ? ' A troca de regime compara com IRPJ, CSLL e CPP incluídos.' : '');

  $('interf').replaceChildren(...itens.slice(0, INTERF_VISIVEIS).map(linhaInterf));
  const resto = itens.slice(INTERF_VISIVEIS);
  $('interf-mais').replaceChildren(...(resto.length === 0 ? [] : [
    el('details', { class: 'mais' },
      el('summary', {}, `Ver mais ${resto.length} ${resto.length === 1 ? 'fator' : 'fatores'}`),
      el('ul', { class: 'interf' }, ...resto.map(linhaInterf))),
  ]));

  $('sem-efeito').hidden = semEfeito.length === 0;
  $('sem-efeito').textContent = `Não interfere neste caso: ${semEfeito.join('; ')}.`;
}

/* ---------- Montagem inicial ---------- */

function montarSelects() {
  $('grupo').replaceChildren(...Object.entries(REGRAS.grupos)
    .map(([chave, grupo]) => el('option', { value: chave }, grupo.rotulo)));
  $('uf').replaceChildren(...Object.keys(REGRAS.icmsUf).sort()
    .map((uf) => el('option', { value: uf }, uf)));
  $('uf').value = 'SP';
}

function montarGrade(idGrade, prefixo, nome, tabela) {
  for (const ano of Object.keys(tabela)) {
    const id = `${prefixo}-${ano}`;
    // O motor tira 0,1 ponto da CBS de 2027 e 2028; abaixo disso a alíquota ficaria negativa.
    const minimo = prefixo === 'cbs' && Number(ano) <= 2028 ? REGRAS.reducaoCbsInicial : 0;
    $(idGrade).append(el('div', {},
      el('label', { for: id }, el('span', { class: 'so-leitor' }, `${nome} `), ano),
      el('div', { class: 'entrada' },
        el('input', { id, type: 'text', inputmode: 'decimal', 'data-tipo': 'pct', 'data-min': minimo, 'data-max': 100 }),
        el('span', { class: 'entrada__pos', 'aria-hidden': 'true' }, '%'))));
  }
}

function preencherPadroes() {
  for (const [ano, valor] of Object.entries(REGRAS.cbsRef)) $(`cbs-${ano}`).value = decimal(valor);
  for (const [ano, valor] of Object.entries(REGRAS.ibsRef)) $(`ibs-${ano}`).value = decimal(valor);
  $('salarioMinimo').value = decimal(REGRAS.mei.salarioMinimo);
}

// Entrar num campo de valor seleciona o número: o que a pessoa digita substitui o que estava lá.
// Soltar o clique reaplica a seleção uma vez. O clique seguinte posiciona o cursor normalmente.
function selecionarAoEntrar(evento) {
  const campo = evento.target;
  if (!campo.dataset.tipo) return;
  campo.select();
  campoRecemFocado = campo;
}

function manterSelecaoAoSoltar(evento) {
  if (evento.target === campoRecemFocado) evento.target.select();
  campoRecemFocado = null;
}

function aoAlterar(evento) {
  const campo = evento.target;
  if (campo.id === 'uf') $('icms').value = decimal(REGRAS.icmsUf[campo.value]);
  if (campo.dataset.tipo) mascarar(campo);
  clearTimeout(temporizador);
  atualizar();
}

function iniciar() {
  montarSelects();
  montarGrade('grade-cbs', 'cbs', 'CBS', REGRAS.cbsRef);
  montarGrade('grade-ibs', 'ibs', 'IBS', REGRAS.ibsRef);
  preencherPadroes();
  $('icms').value = decimal(REGRAS.icmsUf[$('uf').value]);

  const formulario = $('formulario');
  formulario.addEventListener('submit', (evento) => evento.preventDefault());
  // Digitar recalcula com um pequeno atraso; sair do campo aplica a máscara e recalcula na hora.
  formulario.addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(atualizar, ATRASO_MS);
  });
  formulario.addEventListener('change', aoAlterar);
  formulario.addEventListener('focusin', selecionarAoEntrar);
  formulario.addEventListener('pointerup', manterSelecaoAoSoltar);
  formulario.addEventListener('mouseup', manterSelecaoAoSoltar);

  $('restaurar').addEventListener('click', () => { preencherPadroes(); atualizar(); });
  $('imprimir').addEventListener('click', () => window.print());

  // A linha inteira escolhe a data; o botão da linha garante o mesmo pelo teclado.
  $('rolagem-tabela').addEventListener('click', (evento) => {
    const linha = evento.target.closest('tbody tr');
    if (!linha || !ultimo) return;
    anoSelecionado = Number(linha.dataset.ano);
    desenharAno();
  });

  // No celular, a barra fixa some quando o resultado entra na tela, para não cobrir os valores.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([item]) => {
      document.body.classList.toggle('resultado-visivel', item.isIntersecting);
    }).observe($('resultado'));
  }

  atualizar();
}

iniciar();
