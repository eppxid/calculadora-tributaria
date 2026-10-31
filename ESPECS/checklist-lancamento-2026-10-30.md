# Checklist de lançamento — Calculadora da Reforma Tributária — 30/10/2026

Classificação: público sem login · sem venda · sem controlador identificado na página · dados pessoais: nenhum no site; IP nos logs técnicos da Vercel.

| # | Item | Situação | Evidência | Ação |
|---|------|----------|-----------|------|
| 1 | Política de privacidade | ⚠️ | Aviso visível no rodapé `#metodo` desde o redesenho de 30/10/2026; ainda sem contato | Citar um contato |
| 2 | Termos de uso | N/A | Sem cadastro, contrato ou aceite | Nenhuma |
| 3 | Consentimento de cookies | N/A | Navegador: `document.cookie` vazio, `localStorage` e `sessionStorage` com 0 itens | Nenhuma |
| 4 | Finalidade nos formulários | N/A | Campos financeiros ficam no navegador; não há nome, CPF, e-mail ou telefone | Nenhuma |
| 5 | Cancelamento e reembolso | N/A | Não há venda | Nenhuma |
| 6 | Coletar só o necessário | ✅ | Nada é enviado: `connect-src 'none'` em `vercel.json`; zero requisições externas | Nenhuma |
| 7 | Direitos do titular e contato | ⚠️ | Site não guarda dado; IP fica com a Vercel; a página não traz contato | Citar contato junto com o item 1 |
| 8 | Google Analytics | N/A | Busca por `gtag` e `googletagmanager`: nada; CSP bloquearia | Nenhuma |
| 9 | Scripts de rastreamento | ✅ | Só scripts próprios; CSP `script-src 'self'` conferida na URL publicada | Nenhuma |
| 10 | Terceiros que recebem dado | ⚠️ | Vercel é citada no aviso; o aviso não diz que a hospedagem pode ficar fora do Brasil | Acrescentar uma frase no aviso |
| — | Segurança e logs | ✅ | HTTPS na URL publicada; sem senha; CSP, `nosniff` e `no-referrer` conferidos | Revisar guarda de 6 meses se o site passar a ter fim econômico (Marco Civil, art. 15) |
| 11 | Auditoria de acessibilidade | ✅ | Teste na URL publicada: 0 campos sem nome, 0 saltos de título, 0 `tabindex` positivo | Nenhuma |
| 12 | Texto alternativo | ✅ | 0 `<img>` sem `alt`; barras têm texto alternativo com os valores | Nenhuma |
| 13 | Contraste 4.5:1 | ⚠️ | Conferido por script do agente da tela; não refiz a medição | Medir de novo quando a tela mudar |
| 14 | Teclado e foco visível | ✅ | `estilo.css:87`, `estilo.css:156`; `.opcao:has(input:focus-visible)` | Nenhuma |
| 15 | Botões com nome claro | ✅ | Botões com texto; 0 controles sem nome | Nenhuma |
| 16 | Depoimento falso | N/A | Busca por `depoimento`: nada | Nenhuma |
| 17 | Promessa sem prova | ✅ | Busca por `o melhor`, `garantido`, `100%`: nada; a página diz que o resultado é estimativa | Nenhuma |
| 18 | Direito de uso | ✅ | Fonte do sistema; ícone próprio em `icone.svg`; sem imagens de terceiros | Nenhuma |
| 19 | Dados legais da empresa | N/A | Sem oferta nem contratação; Decreto 7.962/2013 não se aplica. Se ganhar marca ou anúncio, passa a valer | Revisar se o site ganhar marca |
| 20 | Leis do ramo | ⚠️ | Conteúdo fiscal: aviso de estimativa em `index.html` e no resultado; nenhum contador revisou as regras | Revisão de um contador antes de divulgar |

## Bloqueia o go-live

Nada bloqueia. Não há ❌.

## Pode ir depois

1. Incluir um contato no aviso de privacidade (itens 1 e 7). O contato real vem do usuário.
2. Citar possível transferência internacional pela hospedagem (item 10).
3. Pedir a revisão de um contador antes de divulgar (item 20).

## Rascunhos

RASCUNHO — revisão jurídica obrigatória antes de publicar

> Privacidade. O cálculo roda no seu navegador. A página não grava nem envia o que você digita. A Vercel hospeda o site e registra logs técnicos de acesso, como endereço IP, e pode processá-los fora do Brasil. Contato: {contato informado pelo responsável}.
