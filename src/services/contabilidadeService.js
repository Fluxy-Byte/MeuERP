const { PlanoConta, LancamentoContabil } = require("../models");

const CONTAS_PADRAO = [
  { codigo: "1", nome: "ATIVO", tipo: "ATIVO" },
  { codigo: "1.1", nome: "CIRCULANTE", tipo: "ATIVO" },
  { codigo: "1.1.1", nome: "Disponivel", tipo: "ATIVO" },
  { codigo: "1.1.1.1", nome: "Caixa", tipo: "ATIVO" },
  { codigo: "1.1.3.1", nome: "Duplicatas a Receber de Clientes", tipo: "ATIVO" },
  { codigo: "1.1.5.1", nome: "Produtos Acabados ou Mercadorias", tipo: "ATIVO" },
  { codigo: "2", nome: "PASSIVO", tipo: "PASSIVO" },
  { codigo: "2.1", nome: "CIRCULANTE", tipo: "PASSIVO" },
  { codigo: "2.1.2", nome: "Contas a Pagar", tipo: "PASSIVO" },
  { codigo: "2.1.5", nome: "Impostos a Pagar", tipo: "PASSIVO" },
  { codigo: "3", nome: "CONTAS DE RESULTADO", tipo: "RECEITA" },
  { codigo: "3.1", nome: "Receita Bruta de Vendas e Servicos", tipo: "RECEITA" },
  { codigo: "3.3", nome: "Impostos sobre Vendas e Servicos", tipo: "DESPESA" },
  { codigo: "3.4", nome: "Custo da Mercadoria/Produto e Servicos Prestados", tipo: "DESPESA" }
];

class ContabilidadeService {
  static async ensureDefaultPlanAccounts() {
    for (const conta of CONTAS_PADRAO) {
      const existente = await PlanoConta.findOne({ where: { codigo: conta.codigo } });
      if (!existente) {
        await PlanoConta.create({
          codigo: conta.codigo,
          nome: conta.nome,
          tipo: conta.tipo
        });
      }
    }
  }

  static async getContaByCodigo(codigo, transaction) {
    const conta = await PlanoConta.findOne({
      where: { codigo },
      transaction
    });

    if (!conta) {
      throw { status: 500, message: `Conta contabil ${codigo} nao configurada.` };
    }

    return conta;
  }

  static async lancarPartidas({ origemTipo, origemId, historico, data, itens, transaction }) {
    const lote = `${origemTipo}-${origemId}-${Date.now()}`;

    for (const item of itens) {
      const conta = await this.getContaByCodigo(item.codigoConta, transaction);
      await LancamentoContabil.create(
        {
          lote,
          plano_conta_id: conta.id,
          natureza: item.natureza,
          valor: item.valor,
          data: data || new Date(),
          historico,
          origem_tipo: origemTipo,
          origem_id: origemId
        },
        { transaction }
      );
    }
  }

  static async lancarCompraRecebida({ pedido, transaction }) {
    await this.lancarPartidas({
      origemTipo: "COMPRA",
      origemId: pedido.id,
      historico: `Compra recebida do pedido ${pedido.id}`,
      transaction,
      itens: [
        { codigoConta: "1.1.5.1", natureza: "DEBITO", valor: pedido.total },
        { codigoConta: "2.1.2", natureza: "CREDITO", valor: pedido.total }
      ]
    });
  }

  static async lancarVenda({ pedido, custoMercadoria, transaction }) {
    const itens = [
      { codigoConta: "1.1.3.1", natureza: "DEBITO", valor: pedido.total },
      { codigoConta: "3.1", natureza: "CREDITO", valor: pedido.total }
    ];

    if (Number(pedido.imposto_valor || 0) > 0) {
      itens.push({ codigoConta: "3.3", natureza: "DEBITO", valor: pedido.imposto_valor });
      itens.push({ codigoConta: "2.1.5", natureza: "CREDITO", valor: pedido.imposto_valor });
    }

    if (Number(custoMercadoria || 0) > 0) {
      itens.push({ codigoConta: "3.4", natureza: "DEBITO", valor: custoMercadoria });
      itens.push({ codigoConta: "1.1.5.1", natureza: "CREDITO", valor: custoMercadoria });
    }

    await this.lancarPartidas({
      origemTipo: "VENDA",
      origemId: pedido.id,
      historico: `Venda registrada no pedido ${pedido.id}`,
      transaction,
      itens
    });
  }

  static async lancarRecebimento({ contaReceber, transaction }) {
    await this.lancarPartidas({
      origemTipo: "RECEBIMENTO",
      origemId: contaReceber.id,
      historico: `Recebimento da conta ${contaReceber.id}`,
      data: contaReceber.data_liquidacao,
      transaction,
      itens: [
        { codigoConta: "1.1.1.1", natureza: "DEBITO", valor: contaReceber.valor },
        { codigoConta: "1.1.3.1", natureza: "CREDITO", valor: contaReceber.valor }
      ]
    });
  }

  static async lancarPagamento({ contaPagar, transaction }) {
    await this.lancarPartidas({
      origemTipo: "PAGAMENTO",
      origemId: contaPagar.id,
      historico: `Pagamento da conta ${contaPagar.id}`,
      data: contaPagar.data_liquidacao,
      transaction,
      itens: [
        { codigoConta: "2.1.2", natureza: "DEBITO", valor: contaPagar.valor },
        { codigoConta: "1.1.1.1", natureza: "CREDITO", valor: contaPagar.valor }
      ]
    });
  }

  static async estornarRecebimento({ contaReceber, transaction }) {
    await this.lancarPartidas({
      origemTipo: "ESTORNO_RECEBIMENTO",
      origemId: contaReceber.id,
      historico: `Estorno do recebimento da conta ${contaReceber.id}`,
      data: contaReceber.data_estorno || new Date(),
      transaction,
      itens: [
        { codigoConta: "1.1.3.1", natureza: "DEBITO", valor: contaReceber.valor },
        { codigoConta: "1.1.1.1", natureza: "CREDITO", valor: contaReceber.valor }
      ]
    });
  }

  static async estornarPagamento({ contaPagar, transaction }) {
    await this.lancarPartidas({
      origemTipo: "ESTORNO_PAGAMENTO",
      origemId: contaPagar.id,
      historico: `Estorno do pagamento da conta ${contaPagar.id}`,
      data: contaPagar.data_estorno || new Date(),
      transaction,
      itens: [
        { codigoConta: "1.1.1.1", natureza: "DEBITO", valor: contaPagar.valor },
        { codigoConta: "2.1.2", natureza: "CREDITO", valor: contaPagar.valor }
      ]
    });
  }
}

module.exports = ContabilidadeService;
