// Formatação e leitura de números no padrão brasileiro. Funções puras: sem DOM e sem rede.

const finito = (n) => (Number.isFinite(n) ? n : 0);

// Arredonda antes de formatar para que -0,001 não vire "-R$ 0,00". O `|| 0` troca o -0 por 0.
const arredondar = (n, casas) => {
  const f = 10 ** casas;
  return Math.round(finito(n) * f) / f || 0;
};

const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const reaisComSinal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', signDisplay: 'exceptZero' });

/** "R$ 1.234,50". O Intl separa o símbolo com espaço sem quebra; aqui vira espaço comum. */
export function moeda(n, { sinal = false } = {}) {
  return (sinal ? reaisComSinal : reais).format(arredondar(n, 2)).replace(/[  ]/g, ' ');
}

/** Número com milhar e vírgula, sem símbolo: "15.000,50". Serve para a máscara dos campos. */
export function decimal(n, casas = 2) {
  return arredondar(n, casas).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** "12,3%". O valor já vem em pontos percentuais (12,3 e não 0,123). */
export function percentual(n, { sinal = false, casas = 1 } = {}) {
  const v = arredondar(n, casas);
  const texto = v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  return `${sinal && v > 0 ? '+' : ''}${texto}%`;
}

/**
 * Lê o texto de um campo no formato brasileiro e devolve número. Vazio ou ilegível vale 0.
 * Com vírgula, os pontos são milhar ("15.000,50"). Sem vírgula, ponto seguido de três dígitos
 * em grupos é milhar ("15.000") e ponto isolado é decimal ("15.5").
 */
export function lerNumero(texto) {
  const limpo = String(texto ?? '').replace(/[^\d.,-]/g, '');
  const negativo = limpo.startsWith('-');
  let corpo = limpo.replace(/-/g, '');
  if (corpo.includes(',')) {
    const [inteiro, ...decimais] = corpo.split(',');
    corpo = `${inteiro.replace(/\./g, '')}.${decimais.join('')}`;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(corpo)) {
    corpo = corpo.replace(/\./g, '');
  }
  const n = Number(corpo);
  if (!Number.isFinite(n)) return 0;
  return (negativo ? -n : n) || 0;
}
