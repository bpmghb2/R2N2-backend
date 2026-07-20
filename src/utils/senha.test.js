// =============================================================
// Testes de hash/verificação de senha (bcrypt real).
// =============================================================

'use strict';

const { hashSenha, verificarSenha } = require('./senha');

describe('hashSenha', () => {
  test('gera um hash diferente do texto puro', async () => {
    const senha = 'S3nh@Forte!';
    const hash = await hashSenha(senha);
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe(senha);
    expect(hash.length).toBeGreaterThan(30);
    // Prefixo bcrypt ($2a$/$2b$) com 12 salt rounds.
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
  });

  test('gera hashes distintos para a mesma senha (salt aleatório)', async () => {
    const senha = 'mesmaSenha123';
    const h1 = await hashSenha(senha);
    const h2 = await hashSenha(senha);
    expect(h1).not.toBe(h2);
  });
});

describe('verificarSenha', () => {
  test('retorna true para a senha correta', async () => {
    const senha = 'correta-123';
    const hash = await hashSenha(senha);
    await expect(verificarSenha(senha, hash)).resolves.toBe(true);
  });

  test('retorna false para senha incorreta', async () => {
    const hash = await hashSenha('correta-123');
    await expect(verificarSenha('errada-999', hash)).resolves.toBe(false);
  });

  test('retorna false quando o hash armazenado é ausente', async () => {
    await expect(verificarSenha('qualquer', null)).resolves.toBe(false);
    await expect(verificarSenha('qualquer', undefined)).resolves.toBe(false);
    await expect(verificarSenha('qualquer', '')).resolves.toBe(false);
  });
});
