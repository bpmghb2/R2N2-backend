# Instruções para o GitHub Copilot — R2N2 Backend

## Padrão de mensagens de commit (Conventional Commits)

Este repositório usa versionamento automático baseado na mensagem do commit
(workflow `.github/workflows/release.yml`). Ao sugerir mensagens de commit,
siga sempre este padrão:

- `fix: <descrição>` → correção de bug. Gera bump de PATCH (ex.: 1.0.0 → 1.0.1).
- `feat: <descrição>` → nova funcionalidade. Gera bump de MINOR (ex.: 1.0.1 → 1.1.0).
- `feat!: <descrição>` ou corpo do commit contendo `BREAKING CHANGE:` → mudança
  que quebra compatibilidade. Gera bump de MAJOR (ex.: 1.1.0 → 2.0.0).
- Outros prefixos comuns (não versionam sozinhos, mas ajudam no changelog):
  `docs:`, `chore:`, `refactor:`, `test:`, `style:`, `perf:`.

Exemplos:
- `fix: corrige validação de CPF no cadastro de fornecedor`
- `feat: adiciona tela de aprovação de ordem de compra`
- `feat!: renomeia endpoint /api/pedidos para /api/ordens-compra`

Sempre gere a mensagem de commit em português, curta na primeira linha
(máx. ~72 caracteres), com detalhes adicionais no corpo se necessário.
