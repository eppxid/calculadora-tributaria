# Calculadora da Reforma Tributária: plano

**Objetivo:** página estática que compara o imposto de hoje com o de cada ano até 2033.
**Arquitetura:** `calc.js` puro, `dados/` com as tabelas, `app.js` só com a tela.
**Tecnologia:** HTML, CSS e JavaScript (módulos ES). Testes com `node --test`. Sem dependência de execução.
**Especificação:** `ESPECS/2026-10-30-calculadora-design.md`.

## Restrições globais

- Sem banco, login, cookies, armazenamento local, analytics ou script externo.
- CSP com `connect-src 'none'`.
- Sem marca de empresa.

## Tarefas

| # | Tarefa | Arquivos | Modelo | Pronto quando |
|---|---|---|---|---|
| 1 | Dados | `dados/simples.js`, `dados/regras.js` | Opus | Todas as linhas somam 100% |
| 2 | Testes do cálculo | `testes/calc.test.js` | Opus | Testes falham por falta de `calc.js` |
| 3 | Cálculo | `calc.js` | Opus | `node --test testes/` sem falha |
| 4 | O que interfere | `calc.js`, `testes/interferencias.test.js` | Opus | Testes sem falha |
| 5 | Tela | `index.html`, `app.js`, `estilo.css` | Sonnet (`executor`) | Formulário completo e resultado por ano |
| 6 | Publicação local | `vercel.json`, `package.json`, `README.md`, `.gitignore` | Opus | CSP ativa e sem requisição externa |
| 7 | Verificação em navegador | Playwright | Opus | Console limpo e exemplos batem |
| 8 | Deploy | Vercel | Opus | URL pública no ar (exige login do usuário) |

## Interface entre as tarefas

```js
calcular(entrada) // { entrada, avisos, anexoPorAno, anos: [Linha], comparativo: [Linha] | null }
interferencias(entrada, ano) // { base, itens: [{ fator, frase, dif, difCredito }], semEfeito: [frase] }
REGRAS // dados/regras.js
SIMPLES // dados/simples.js
```

`Linha`: `{ ano, status, itens, antigos, cbs, ibs, outros, total, precoCliente, liquido, creditoCliente, difHoje, difHojePct }`.
