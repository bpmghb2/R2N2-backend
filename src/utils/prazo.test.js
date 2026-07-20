// =============================================================
// Testes da lógica de prazos em dias úteis (função pura).
// Datas construídas via `new Date(ano, mes, dia)` (horário local) para
// evitar deslocamento de fuso ao comparar dias da semana.
// Referência julho/2026: 13=Seg 14=Ter 16=Qui 17=Sex 18=Sab 19=Dom 20=Seg 21=Ter
// =============================================================

'use strict';

const {
  adicionarDiasUteis,
  getDiasRestantes,
  getInicioAjustadoPosDescongelamento
} = require('./prazo');

// Helper local: cria data no horário local (mês 0-indexado -> 6 = julho).
const jul = (dia, h = 0) => new Date(2026, 6, dia, h);

describe('adicionarDiasUteis', () => {
  test('soma dias úteis pulando o fim de semana', () => {
    // Seg 13 + 5 dias úteis: Ter14, Qua15, Qui16, Sex17, (pula Sab/Dom) Seg20
    const r = adicionarDiasUteis(jul(13), 5);
    expect(r.getFullYear()).toBe(2026);
    expect(r.getMonth()).toBe(6);
    expect(r.getDate()).toBe(20);
    expect(r.getDay()).toBe(1); // segunda-feira
  });

  test('sexta + 1 dia útil cai na segunda seguinte', () => {
    const r = adicionarDiasUteis(jul(17), 1);
    expect(r.getDate()).toBe(20);
    expect(r.getDay()).toBe(1);
  });

  test('dias negativos retrocedem pulando o fim de semana', () => {
    // Seg 13 - 1 dia útil: pula Dom12/Sab11 -> Sex10
    const r = adicionarDiasUteis(jul(13), -1);
    expect(r.getDate()).toBe(10);
    expect(r.getDay()).toBe(5); // sexta-feira
  });

  test('zero dias úteis retorna a mesma data (nova instância)', () => {
    const base = jul(13);
    const r = adicionarDiasUteis(base, 0);
    expect(r.getTime()).toBe(base.getTime());
    expect(r).not.toBe(base); // não mutou a original
  });

  test('não muta a data base', () => {
    const base = jul(13);
    const antes = base.getTime();
    adicionarDiasUteis(base, 3);
    expect(base.getTime()).toBe(antes);
  });
});

describe('getDiasRestantes', () => {
  test('sem data de origem retorna o total de dias úteis (default 5)', () => {
    expect(getDiasRestantes(null)).toBe(5);
    expect(getDiasRestantes(undefined, 7)).toBe(7);
  });

  test('no início da contagem retorna o prazo cheio (positivo)', () => {
    // criação Seg13, prazo 5 -> deadline Seg20; alvo=Seg13 -> 5 dias úteis restantes
    expect(getDiasRestantes(jul(13), 5, jul(13))).toBe(5);
  });

  test('na data do deadline retorna zero', () => {
    // deadline = Seg20
    expect(getDiasRestantes(jul(13), 5, jul(20))).toBe(0);
  });

  test('após o deadline retorna valor negativo (atraso)', () => {
    // alvo Ter21, deadline Seg20 -> -1
    expect(getDiasRestantes(jul(13), 5, jul(21))).toBe(-1);
  });

  test('a contagem ignora sábados e domingos', () => {
    // criação Qui16, prazo 2 -> Sex17, (pula Sab/Dom) Seg20 = deadline
    // alvo Qui16 -> restam Sex17 e Seg20 = 2 dias úteis (fim de semana não conta)
    expect(getDiasRestantes(jul(16), 2, jul(16))).toBe(2);
  });

  test('aceita string ISO como data de origem', () => {
    // usa string ISO; alvo como Date. Deadline de Seg13+5 = Seg20.
    const restante = getDiasRestantes(jul(13).toISOString(), 5, jul(18));
    // alvo Sab18 -> conta até Seg20: Seg20 (Sab/Dom não contam) = 1
    expect(restante).toBe(1);
  });
});

describe('getInicioAjustadoPosDescongelamento', () => {
  // Congela o "agora" numa segunda-feira para tornar o cálculo determinístico.
  const HOJE = new Date(2026, 6, 13, 10, 30, 0); // Seg 13/07 10:30

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(HOJE);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('retorna uma string ISO válida', () => {
    const iso = getInicioAjustadoPosDescongelamento(3, 5);
    expect(typeof iso).toBe('string');
    expect(new Date(iso).toISOString()).toBe(iso);
  });

  test('preserva os dias restantes congelados (round-trip)', () => {
    const frozen = 3;
    const total = 5;
    const novoInicio = getInicioAjustadoPosDescongelamento(frozen, total);
    // Recalculando a partir do novo início, com "hoje" = a segunda congelada,
    // deve restar exatamente o número de dias congelados.
    const restante = getDiasRestantes(novoInicio, total, HOJE);
    expect(restante).toBe(frozen);
  });
});
