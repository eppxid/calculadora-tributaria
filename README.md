# Calculadora da Reforma Tributária

Página estática que compara o imposto de hoje com o de cada ano da transição para CBS e IBS (2026 a 2033).
O cálculo roda no navegador. A página não usa servidor, banco, cookies, armazenamento local nem analytics.

## Rodar

Sirva a pasta em qualquer servidor estático. Exemplo: `npx serve .`

## Testar

`npm test`

## Atualizar alíquotas

- Referências, grupos, MEI e ICMS: `dados/regras.js`.
- Tabelas do Simples: `dados/simples.js` é gerado. Baixe o PDF atualizado da LC 214 no portal da Câmara e rode:

```
python -I ferramentas/gerar_dados.py <lc214.pdf> dados/simples.js
```

O gerador recusa a saída se alguma linha de partilha não somar 100%.

## Publicar

Endereço: https://calculadora-cbs-ibs.vercel.app

`npx vercel deploy --prod --scope pis-ystem`

Os cabeçalhos de segurança ficam em `vercel.json`. Regras de cálculo: `ESPECS/2026-10-30-calculadora-design.md`.
