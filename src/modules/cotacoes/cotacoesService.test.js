// =============================================================
// Testes das REGRAS DE NEGÓCIO do service de Cotações.
// O acesso a dados (model, configuracoesModel, config/database) é
// totalmente mockado — nenhum banco real é tocado.
// =============================================================

'use strict';

// --- Mocks das dependências de dados (declarados antes do require do SUT) ---
jest.mock('./cotacoesModel', () => ({
  cotacoesModel: {
    listar: jest.fn(),
    contarTotal: jest.fn(),
    buscarCabecalho: jest.fn(),
    buscarCompleta: jest.fn(),
    criar: jest.fn(),
    atualizar: jest.fn(),
    adicionarHistorico: jest.fn(),
    deletarLogicamente: jest.fn()
  }
}));

jest.mock('../configuracoes/configuracoesModel', () => ({
  configuracoesModel: {
    proximoNumeroCotacao: jest.fn()
  }
}));

jest.mock('../../config/database', () => ({
  execute: jest.fn().mockResolvedValue([[], {}]),
  transacao: jest.fn()
}));

const { cotacoesService } = require('./cotacoesService');
const { cotacoesModel } = require('./cotacoesModel');
const { configuracoesModel } = require('../configuracoes/configuracoesModel');
const database = require('../../config/database');

const usuario = { id: 'user-1', email: 'gestor@rn.com' };

beforeEach(() => {
  jest.clearAllMocks();
  database.execute.mockResolvedValue([[], {}]);
});

describe('gerarNumero', () => {
  test('formata prefixo + sequência com 4 dígitos', async () => {
    configuracoesModel.proximoNumeroCotacao.mockResolvedValue({
      last_quote_number: 42, control_numbering_prefix: 'COT-'
    });
    await expect(cotacoesService.gerarNumero()).resolves.toBe('COT-0042');
  });

  test('usa prefixo padrão COT- quando não configurado', async () => {
    configuracoesModel.proximoNumeroCotacao.mockResolvedValue({
      last_quote_number: 7, control_numbering_prefix: null
    });
    await expect(cotacoesService.gerarNumero()).resolves.toBe('COT-0007');
  });
});

describe('aprovar', () => {
  test('exige fornecedor adquirido (erro de negócio sem approvedSupplierId)', async () => {
    cotacoesModel.buscarCabecalho.mockResolvedValue({ id: 'c1', status: 'Pendente' });

    await expect(
      cotacoesService.aprovar('c1', { approvedSupplierId: null }, usuario)
    ).rejects.toMatchObject({ tipo: 'NEGOCIO', message: expect.stringMatching(/fornecedor/i) });

    // Nada foi persistido.
    expect(database.execute).not.toHaveBeenCalled();
    expect(cotacoesModel.adicionarHistorico).not.toHaveBeenCalled();
  });

  test('cotação inexistente lança erro de "não encontrado"', async () => {
    cotacoesModel.buscarCabecalho.mockResolvedValue(null);
    await expect(
      cotacoesService.aprovar('inexistente', { approvedSupplierId: 'F1' }, usuario)
    ).rejects.toMatchObject({ tipo: 'NAO_ENCONTRADO' });
  });

  test('justificativa é obrigatória quando o fornecedor comprado difere do recomendado', async () => {
    cotacoesModel.buscarCabecalho.mockResolvedValue({
      id: 'c1', status: 'Pendente', manager_choice_supplier_ref: 'FORN-A'
    });

    await expect(
      cotacoesService.aprovar('c1', { approvedSupplierId: 'FORN-B' }, usuario)
    ).rejects.toMatchObject({ tipo: 'NEGOCIO', message: expect.stringMatching(/justificativa/i) });

    expect(database.execute).not.toHaveBeenCalled();
  });

  test('permite divergência quando há justificativa e persiste os dados', async () => {
    cotacoesModel.buscarCabecalho.mockResolvedValue({
      id: 'c1', status: 'Pendente', manager_choice_supplier_ref: 'FORN-A'
    });
    cotacoesModel.buscarCompleta.mockResolvedValue({ id: 'c1', status: 'Aprovado' });

    await cotacoesService.aprovar(
      'c1',
      { approvedSupplierId: 'FORN-B', justificativa: 'Melhor prazo de entrega.' },
      usuario
    );

    // UPDATE do cabeçalho realizado.
    expect(database.execute).toHaveBeenCalledTimes(1);
    const [sql, params] = database.execute.mock.calls[0];
    expect(sql).toMatch(/UPDATE cotacoes SET/i);
    expect(params[0]).toBe('Aprovado'); // status é o primeiro campo do patch

    // Histórico com justificativa registrado.
    expect(cotacoesModel.adicionarHistorico).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        type: 'approval',
        toStatus: 'Aprovado',
        justification: 'Melhor prazo de entrega.'
      })
    );
  });

  test('respeita o statusFinal informado', async () => {
    cotacoesModel.buscarCabecalho.mockResolvedValue({ id: 'c1', status: 'Pendente' });
    cotacoesModel.buscarCompleta.mockResolvedValue({ id: 'c1' });

    await cotacoesService.aprovar(
      'c1',
      { approvedSupplierId: 'FORN-X', statusFinal: 'Comprado' },
      usuario
    );

    const [, params] = database.execute.mock.calls[0];
    expect(params[0]).toBe('Comprado');
    expect(cotacoesModel.adicionarHistorico).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ toStatus: 'Comprado' })
    );
  });

  test('default de statusFinal é "Aprovado" e bloqueia (locked) a cotação', async () => {
    cotacoesModel.buscarCabecalho.mockResolvedValue({ id: 'c1', status: 'Pendente' });
    cotacoesModel.buscarCompleta.mockResolvedValue({ id: 'c1' });

    await cotacoesService.aprovar('c1', { approvedSupplierId: 'FORN-X' }, usuario);

    const [sql, params] = database.execute.mock.calls[0];
    expect(params[0]).toBe('Aprovado');
    // locked = true deve estar entre os valores persistidos.
    expect(params).toContain(true);
    expect(sql).toMatch(/locked = \$/);
  });
});

describe('clonar', () => {
  test('reseta lock/aprovação e gera novo rascunho com novo número', async () => {
    const origem = {
      id: 'c1', number: 'COT-0001', title: 'Compra X',
      status: 'Aprovado', locked: true,
      approvedSupplierId: 'FORN-A', approvedSupplierJustification: 'x',
      managerChoiceSupplierId: 'FORN-A', managerChoiceJustification: 'y',
      approvalDate: '2026-07-10', frozenAt: '2026-07-01T00:00:00.000Z',
      frozenRemainingDays: 2, emailSentAt: '2026-07-02T00:00:00.000Z',
      createdAt: '2026-06-30T00:00:00.000Z',
      history: [{ type: 'approval' }]
    };
    cotacoesModel.buscarCompleta
      .mockResolvedValueOnce(origem)          // buscarCompleta(id) origem
      .mockResolvedValueOnce({ id: 'c2', status: 'Rascunho' }); // buscarCompleta(novoId)
    configuracoesModel.proximoNumeroCotacao.mockResolvedValue({
      last_quote_number: 2, control_numbering_prefix: 'COT-'
    });
    cotacoesModel.criar.mockResolvedValue('c2');

    const resultado = await cotacoesService.clonar('c1', usuario);

    expect(cotacoesModel.criar).toHaveBeenCalledTimes(1);
    const clone = cotacoesModel.criar.mock.calls[0][0];

    expect(clone.number).toBe('COT-0002');
    expect(clone.status).toBe('Rascunho');
    expect(clone.locked).toBe(false);
    expect(clone.approvedSupplierId).toBeUndefined();
    expect(clone.approvedSupplierJustification).toBeUndefined();
    expect(clone.managerChoiceSupplierId).toBeUndefined();
    expect(clone.managerChoiceJustification).toBeUndefined();
    expect(clone.frozenAt).toBeUndefined();
    expect(clone.frozenRemainingDays).toBeUndefined();
    expect(clone.approvalDate).toBeUndefined();
    expect(clone.createdAt).toBeUndefined();
    expect(clone.id).toBeUndefined(); // id da origem removido
    // Histórico reiniciado com um único evento de criação/clonagem.
    expect(clone.history).toHaveLength(1);
    expect(clone.history[0].type).toBe('creation');
    expect(clone.history[0].message).toMatch(/COT-0001/);

    expect(resultado).toEqual({ id: 'c2', status: 'Rascunho' });
  });

  test('lança "não encontrado" quando a origem não existe', async () => {
    cotacoesModel.buscarCompleta.mockResolvedValue(null);
    await expect(cotacoesService.clonar('x', usuario))
      .rejects.toMatchObject({ tipo: 'NAO_ENCONTRADO' });
    expect(cotacoesModel.criar).not.toHaveBeenCalled();
  });
});

describe('alterarStatus (regras de timer/histórico)', () => {
  test('Rascunho -> Pendente exige responsável pelo preenchimento', async () => {
    cotacoesModel.buscarCabecalho.mockResolvedValue({
      id: 'c1', status: 'Rascunho', filled_by: null
    });

    await expect(
      cotacoesService.alterarStatus('c1', 'Pendente', usuario)
    ).rejects.toMatchObject({ tipo: 'NEGOCIO', message: expect.stringMatching(/Respons/i) });

    expect(cotacoesModel.adicionarHistorico).not.toHaveBeenCalled();
  });

  test('status igual ao atual é no-op (apenas retorna a cotação)', async () => {
    cotacoesModel.buscarCabecalho.mockResolvedValue({ id: 'c1', status: 'Pendente' });
    cotacoesModel.buscarCompleta.mockResolvedValue({ id: 'c1', status: 'Pendente' });

    const r = await cotacoesService.alterarStatus('c1', 'Pendente', usuario);

    expect(r).toEqual({ id: 'c1', status: 'Pendente' });
    expect(cotacoesModel.adicionarHistorico).not.toHaveBeenCalled();
    expect(database.execute).not.toHaveBeenCalled();
  });

  test('Rascunho -> Pendente com responsável inicia o timer e registra histórico', async () => {
    cotacoesModel.buscarCabecalho.mockResolvedValue({
      id: 'c1', status: 'Rascunho', filled_by: 'Fulano', format_type: 'Compras'
    });
    cotacoesModel.buscarCompleta.mockResolvedValue({ id: 'c1', status: 'Pendente' });

    await cotacoesService.alterarStatus('c1', 'Pendente', usuario, { comentario: 'go' });

    expect(cotacoesModel.adicionarHistorico).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ type: 'status_change', fromStatus: 'Rascunho', toStatus: 'Pendente' })
    );
    // Houve pelo menos um UPDATE (patch de origem_created_at e/ou status).
    expect(database.execute).toHaveBeenCalled();
  });
});

describe('calcularTotais (função pura)', () => {
  test('soma quantidade×preço por fornecedor e adiciona frete/impostos', () => {
    const cotacao = {
      suppliers: [
        { id: 'A', freight: 100, taxes: 50 },
        { id: 'B', freight: 0, taxes: 0 }
      ],
      items: [
        { quantity: 2, prices: { A: 10, B: 12 } }, // A:20  B:24
        { quantity: 3, prices: { A: 5 } }          // A:15  B:—
      ]
    };
    const totais = cotacoesService.calcularTotais(cotacao);
    expect(totais.A).toBe(20 + 15 + 100 + 50); // 185
    expect(totais.B).toBe(24 + 0 + 0);         // 24
  });

  test('trata cotação sem fornecedores/itens', () => {
    expect(cotacoesService.calcularTotais({})).toEqual({});
  });
});

describe('listar', () => {
  test('normaliza paginação e retorna registros + total', async () => {
    cotacoesModel.listar.mockResolvedValue([{ id: 'c1' }]);
    cotacoesModel.contarTotal.mockResolvedValue(1);

    const r = await cotacoesService.listar({ pagina: 0, limite: 999, filtros: {} });

    expect(r).toEqual({ registros: [{ id: 'c1' }], total: 1 });
    // pagina<1 vira 1 (offset 0); limite>200 é limitado a 200.
    expect(cotacoesModel.listar).toHaveBeenCalledWith(
      expect.objectContaining({ limite: 200, offset: 0 })
    );
  });
});
