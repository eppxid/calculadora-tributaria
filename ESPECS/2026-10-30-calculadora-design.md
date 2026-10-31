# Calculadora da Reforma Tributária: especificação

Data: 30/10/2026. Estado: aprovado para execução.

## Objetivo

Uma página pública mostra quanto uma empresa paga de imposto hoje e em cada ano da transição.
A saída segue este formato: "em 10/2026 paga R$ 1.000; em 01/2027 paga R$ 1.200, sendo CBS R$ X e IBS R$ Y".
A página também mostra o que mais interfere no resultado.

## Restrições

- Página estática. O cálculo roda no navegador.
- Sem banco, login, cookies, armazenamento local, analytics ou script externo.
- CSP restrita em `vercel.json`, com `connect-src 'none'`.
- Sem marca de empresa.
- Resultado é estimativa. A página diz isso e informa os logs técnicos da Vercel.

## Arquitetura

| Arquivo | Responsabilidade |
|---|---|
| `dados/simples.js` | Tabelas do Simples por período. Gerado do PDF oficial. Não editar à mão. |
| `dados/regras.js` | Alíquotas de referência, grupos, MEI, ICMS por UF, proporções da transição. |
| `calc.js` | Funções puras: `calcular(entrada)` e `interferencias(entrada, ano)`. Sem DOM. |
| `app.js` | Lê o formulário, chama `calc.js`, desenha o resultado. |
| `index.html`, `estilo.css` | Tela. |
| `vercel.json` | Cabeçalhos de segurança. |
| `testes/*.test.js` | Testes com `node --test`. |

Sem build e sem dependência de execução.

## Entrada

| Campo | Valores |
|---|---|
| `regime` | `mei`, `tradicional`, `hibrido`, `presumido`, `real` |
| `atividade` | `comercio`, `industria`, `servico` |
| `anexoServico` | `III`, `IV`, `V`, `fatorR` |
| `grupo` | `geral`, `r30`, `r40`, `r50`, `r60`, `r70`, `zero` |
| `faturamentoMes`, `receita12`, `folha12` | Reais. `receita12` vazio vale 12 × faturamento. |
| `compras` | Compras do mês de fornecedor do regime regular |
| `comprasSimples` | Compras do mês de fornecedor do Simples |
| `vendasEmpresasPct` | Parte das vendas para empresas que aproveitam crédito |
| `icmsPct`, `issPct`, `ipiPct` | Alíquotas. ICMS vem da UF e pode ser editado. |
| `margemPct` | Lucro estimado no Lucro Real |
| `ipiMantido` | Produto com IPI mantido pela regra da Zona Franca de Manaus |
| `incluirRenda` | Inclui IRPJ, CSLL e CPP fora do DAS |
| `repasse` | `liquido` (padrão) ou `preco` |
| `cbsRef`, `ibsRef` | Alíquotas por ano, editáveis |

## Saída por ano (2026 a 2033)

`{ ano, status, itens, antigos, cbs, ibs, outros, total, precoCliente, liquido, creditoCliente, difHoje, difHojePct }`

- `status`: `lei` (2026), `proposta` (2027), `projecao` (2028 em diante).
- `itens`: valor de cada tributo.
- `difHoje`: comparação com 2026.
- Simples mostra tradicional e híbrido lado a lado.

## Regras

### Comuns

- CBS de referência: 11,3% em 2027 (TCU, sujeita ao Senado). De 2028 a 2033 repete 11,3% como projeção.
- IBS pleno: 18,7% como projeção do Comitê Gestor.
- 2026: CBS 0,9% e IBS 0,1% só informativos, com recolhimento dispensado (LC 214, art. 348, § 1º). Não entram no total. Não se aplicam ao Simples (art. 348, III, "c").
- 2027 e 2028: CBS = (referência − 0,1) × fator do grupo. IBS = 0,1% × fator do grupo (arts. 344 e 347).
- 2029 a 2032: IBS = pleno × 10%, 20%, 30%, 40%. 2033: 100%.
- ICMS e ISS: 100% até 2028, depois 90%, 80%, 70%, 60%. Zero em 2033 (ADCT, art. 128).
- PIS e Cofins: zero a partir de 2027. IPI: zero a partir de 2027, salvo `ipiMantido`.
- Fator do grupo: geral 1; r30 0,7; r40 0,6; r50 0,5; r60 0,4; r70 0,3; zero 0.
- CBS e IBS não incidem sobre ICMS, ISS e IPI (art. 12, § 2º).

### Regime regular (Presumido e Real)

Hoje:

- ICMS = V × icms, com crédito sobre compras (comércio e indústria).
- ISS = V × iss (serviço).
- IPI = V × ipi por fora, sem somar no preço de referência.
- PIS e Cofins: Presumido 3,65% sobre (V − ICMS). Real 9,25% sobre (V − ICMS), menos 9,25% das compras.

De 2027 em diante:

- `liquido`: mantém o valor líquido de hoje. S = N / (1 − r − s), com r = icms × proporção e s = iss × proporção. Base CBS/IBS = N.
- `preco`: mantém o que o cliente paga hoje e resolve N.
- Crédito = compras × alíquota + comprasSimples × crédito do Simples.
- Crédito do Simples = 6% × (fatia CBS + fatia IBS) do Anexo I, 1ª faixa, no período.

IRPJ e CSLL (com `incluirRenda`):

- Presumido: base de 8% (comércio, indústria) ou 32% (serviço) para IRPJ; 12% ou 32% para CSLL.
- Parcela acima de R$ 5 milhões por ano: presunção 10% maior (LC 224/2025).
- IRPJ 15% mais adicional de 10% sobre a base mensal acima de R$ 20.000. CSLL 9%.
- Real: lucro = margem × receita sem tributos sobre consumo.
- CPP: 20% da folha mensal. Sem RAT e sem terceiros.

### Simples tradicional

- Período: 2026; 2027 vale para 2027 e 2028; depois 2029 a 2033.
- Alíquotas 2029 valem para 2033.
- Efetiva = (RBT12 × nominal − dedução) / RBT12. 1ª faixa = nominal.
- DAS = V × efetiva. Cada tributo = DAS × fatia.
- Anexos III e IV, 5ª faixa: se efetiva × fatia ISS passar do teto, ISS fica fixo no teto e o resto segue a linha `teto` da tabela.
- Indústria: Anexo II em 2026. De 2027 em diante Anexo I, salvo `ipiMantido` (LC 123, art. 18, §§ 4º e 5º).
- Fator R: folha12 / receita12 ≥ 28% usa Anexo III; abaixo usa Anexo V.
- Anexo IV: CPP fora do DAS.
- 6ª faixa: ICMS, ISS e IBS saem do DAS (LC 123, art. 13-A) e seguem as regras comuns.
- Reduções do grupo não alteram o DAS: as tabelas não preveem essa redução.
- Crédito ao cliente = (CBS + IBS do DAS) × vendasEmpresasPct.

### Simples híbrido

- Existe de 2027 em diante. Em 2026 repete o tradicional.
- DAS sem as fatias de CBS e IBS (LC 123, art. 13, § 9º).
- CBS e IBS pelas regras do regime regular, com grupo e crédito.
- `liquido`: S = (V − DAS de hoje) / (1 − efetiva × resto). Base = S − ICMS e ISS do DAS.
- Crédito ao cliente = (CBS + IBS brutos) × vendasEmpresasPct.

### MEI

- INSS = 5% do salário mínimo (R$ 1.621 em 2026, editável).
- Valores fixos do Anexo VII da LC 123, por período: ICMS para comércio e indústria, ISS para serviço, CBS e IBS para todos.

### Avisos

- Receita acima de R$ 81.000 no MEI ou R$ 4.800.000 no Simples.
- Receita acima de R$ 3.600.000 no Simples: ICMS, ISS e IBS fora do DAS.
- Grupo reduzido no Simples tradicional sem efeito no DAS.
- Janelas da opção híbrida: setembro e março (LC 123, art. 13, § 10).

## O que interfere

`interferencias(entrada, ano)` recalcula o resultado mudando um fator por vez e ordena pelo valor absoluto do impacto.

| Fator | Teste |
|---|---|
| Regime | Cada regime disponível para a receita |
| Compras com crédito | Compras + 20% do faturamento |
| Grupo | Grupo geral e grupo com redução de 60% |
| Referência da CBS | + 1 ponto |
| IBS pleno | + 1 ponto |
| ICMS ou ISS | + 1 ponto |
| Fator R | Troca Anexo III e V |
| Repasse | Troca `liquido` e `preco` |

Cada linha traz a frase, a diferença em reais e a direção.

## Layout (redesenho de 30/10/2026)

- Estilo de livro-razão: interface sem cor; azul só em CBS e IBS. Fonte Geist servida pelo próprio site, sem requisição externa.
- Coluna esquerda: faturamento, regime, atividade, anexo e tratamento. O restante fica em seções recolhidas que mostram o valor em uso.
- Direita: três colunas que se leem como a frase pedida (hoje, 01/2027, 01/2033), a tabela ano a ano com barra de composição e, abaixo, o que interfere e os tributos da data escolhida na tabela.
- A página abre com o faturamento vazio. O resultado aparece depois que a pessoa informa o valor.

## Estudo de mudança para o híbrido

`estudoHibrido(entrada, ano)` vale para o Simples, de 2027 em diante. O repasse do formulário não entra.

- Referência: Simples tradicional com o faturamento informado.
- Faturamento sugerido: valor em que o híbrido deixa o mesmo líquido do tradicional, com o crédito das compras.
- Preço aceito pelo cliente com crédito: valor em que preço menos crédito iguala o custo real de hoje.
- Cliente sem crédito: paga o preço atual.
- Preço médio aceito: média dos dois, pela parte das vendas para empresas.
- Compensa quando o preço médio aceito deixa líquido igual ou maior que o tradicional.
- Empates: vendas para empresas e compras com crédito que zeram o ganho.
- Possibilidades: matriz de ganho por mês, com vendas de 0% a 100% e compras de 0% a 60% do faturamento.
- Volume de vendas e receita de 12 meses ficam fixos. O estudo não prevê a reação dos clientes.

## Fora do escopo

Substituição tributária, DIFAL, benefícios estaduais, regimes específicos detalhados, Imposto Seletivo e simulação de fluxo de caixa do split payment.

## Testes

1. Cada linha de partilha soma 100% (validado na geração e em teste).
2. Exemplos conferidos à mão por regime.
3. Teto do ISS na 5ª faixa.
4. Página aberta em navegador real, sem erro de console e sem requisição externa.
