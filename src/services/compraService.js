const sequelize = require("../database");
const {
  Fornecedor,
  Produto,
  PedidoCompra,
  ItemCompra,
  EstoqueMovimentacao,
  ContaPagar
} = require("../models");
const ProdutoService = require("./produtoService");
const ContabilidadeService = require("./contabilidadeService");

function calcularCustoMedio(estoqueAtual, custoAtual, quantidadeEntrada, custoEntrada) {
  const saldoAtual = Number(estoqueAtual || 0);
  const custoMedioAtual = Number(custoAtual || 0);
  const quantidade = Number(quantidadeEntrada || 0);
  const custo = Number(custoEntrada || 0);
  const novoSaldo = saldoAtual + quantidade;

  if (novoSaldo <= 0) {
    return custo;
  }

  return Number((((saldoAtual * custoMedioAtual) + (quantidade * custo)) / novoSaldo).toFixed(2));
}

class CompraService {
  static adicionarHistorico(textoAtual, novoEvento) {
    return textoAtual ? `${textoAtual} | ${novoEvento}` : novoEvento;
  }

  static async registrarCompra(dados, usuario) {
    const {
      fornecedor_id,
      itens,
      desconto = 0,
      confirmar_recebimento = true,
      nf_entrada,
      forma_pagamento,
      observacao,
      data_vencimento
    } = dados;

    if (!fornecedor_id || !Array.isArray(itens) || itens.length === 0) {
      throw {
        status: 400,
        message: "Fornecedor e itens da compra sao obrigatorios."
      };
    }

    return sequelize.transaction(async (transaction) => {
      const fornecedor = await Fornecedor.findByPk(fornecedor_id, { transaction });

      if (!fornecedor) {
        throw { status: 404, message: "Fornecedor nao encontrado." };
      }

      const itensProcessados = [];
      let subtotal = 0;

      for (const item of itens) {
        if (!item.produto_id || !item.quantidade || item.preco === undefined) {
          throw {
            status: 400,
            message: "Cada item da compra deve informar produto_id, quantidade e preco."
          };
        }

        const quantidade = Number(item.quantidade);
        const preco = Number(item.preco);

        if (!Number.isFinite(quantidade) || quantidade <= 0 || !Number.isFinite(preco) || preco < 0) {
          throw {
            status: 400,
            message: "Quantidade deve ser numerica e maior que zero, e preco deve ser numerico e nao negativo."
          };
        }

        const produto = await Produto.findByPk(item.produto_id, {
          transaction,
          lock: transaction.LOCK.UPDATE
        });

        if (!produto) {
          throw { status: 404, message: `Produto ${item.produto_id} nao encontrado.` };
        }

        subtotal += quantidade * preco;
        itensProcessados.push({
          produto,
          produto_id: item.produto_id,
          quantidade,
          preco
        });
      }

      const descontoNumerico = Number(desconto || 0);
      if (!Number.isFinite(descontoNumerico) || descontoNumerico < 0 || descontoNumerico > subtotal) {
        throw { status: 400, message: "Desconto da compra invalido." };
      }

      const total = Number((subtotal - descontoNumerico).toFixed(2));
      const status = confirmar_recebimento === false ? "EMITIDO" : "RECEBIDO";

      const pedido = await PedidoCompra.create(
        {
          fornecedor_id,
          subtotal,
          desconto: descontoNumerico,
          total,
          status,
          nf_entrada: status === "RECEBIDO" ? nf_entrada || null : null,
          forma_pagamento: forma_pagamento || null,
          recebido_em: status === "RECEBIDO" ? new Date() : null,
          observacao: observacao || null
        },
        { transaction }
      );

      for (const item of itensProcessados) {
        await ItemCompra.create(
          {
            pedido_id: pedido.id,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            preco: item.preco
          },
          { transaction }
        );
      }

      let contaPagar = null;

      if (status === "RECEBIDO") {
        contaPagar = await this.processarRecebimento({
          pedido,
          itensProcessados,
          usuario,
          forma_pagamento,
          data_vencimento,
          nf_entrada,
          transaction
        });
      }

      return {
        pedido,
        contaPagar
      };
    });
  }

  static async confirmarRecebimento(dados, usuario) {
    const { pedido_id, nf_entrada, forma_pagamento, data_vencimento } = dados;

    if (!pedido_id) {
      throw { status: 400, message: "Informe o pedido_id para confirmar o recebimento." };
    }

    return sequelize.transaction(async (transaction) => {
      const pedido = await PedidoCompra.findByPk(pedido_id, {
        include: [{ model: ItemCompra, as: "itens" }],
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!pedido) {
        throw { status: 404, message: "Pedido de compra nao encontrado." };
      }

      if (pedido.status === "RECEBIDO") {
        throw { status: 400, message: "Este pedido ja foi recebido." };
      }

      const itensProcessados = [];

      for (const item of pedido.itens) {
        const produto = await Produto.findByPk(item.produto_id, {
          transaction,
          lock: transaction.LOCK.UPDATE
        });

        if (!produto) {
          throw { status: 404, message: `Produto ${item.produto_id} nao encontrado.` };
        }

        itensProcessados.push({
          produto,
          produto_id: item.produto_id,
          quantidade: Number(item.quantidade),
          preco: Number(item.preco)
        });
      }

      pedido.status = "RECEBIDO";
      pedido.nf_entrada = nf_entrada || pedido.nf_entrada;
      pedido.forma_pagamento = forma_pagamento || pedido.forma_pagamento;
      pedido.recebido_em = new Date();
      await pedido.save({ transaction });

      const contaPagar = await this.processarRecebimento({
        pedido,
        itensProcessados,
        usuario,
        forma_pagamento: pedido.forma_pagamento,
        data_vencimento,
        nf_entrada: pedido.nf_entrada,
        transaction
      });

      return {
        pedido,
        contaPagar
      };
    });
  }

  static async processarRecebimento({ pedido, itensProcessados, usuario, forma_pagamento, data_vencimento, nf_entrada, transaction }) {
    for (const item of itensProcessados) {
      const novoCustoMedio = calcularCustoMedio(
        item.produto.estoque,
        item.produto.preco_custo,
        item.quantidade,
        item.preco
      );

      item.produto.estoque += item.quantidade;
      item.produto.preco_custo = novoCustoMedio;
      item.produto.margem_lucro = ProdutoService.calcularMargemLucro(novoCustoMedio, item.produto.preco_venda);
      await item.produto.save({ transaction });

      await EstoqueMovimentacao.create(
        {
          produto_id: item.produto_id,
          usuario_id: usuario?.id || null,
          pedido_compra_id: pedido.id,
          tipo: "ENTRADA",
          quantidade: item.quantidade,
          motivo: `Recebimento de compra${nf_entrada ? ` NF ${nf_entrada}` : ""}`
        },
        { transaction }
      );
    }

    const contaPagar = await ContaPagar.create(
      {
        pedido_compra_id: pedido.id,
        valor: pedido.total,
        data_vencimento: data_vencimento || null,
        forma_pagamento: forma_pagamento || null,
        historico: `Conta gerada pela compra ${pedido.id}`,
        status: "PENDENTE"
      },
      { transaction }
    );

    await ContabilidadeService.lancarCompraRecebida({
      pedido,
      transaction
    });

    return contaPagar;
  }

  static async baixarContaPagar(contaPagarId, dados = {}) {
    if (!contaPagarId) {
      throw { status: 400, message: "Informe o id da conta a pagar." };
    }

    return sequelize.transaction(async (transaction) => {
      const contaPagar = await ContaPagar.findByPk(contaPagarId, { transaction });

      if (!contaPagar) {
        throw { status: 404, message: "Conta a pagar nao encontrada." };
      }

      if (contaPagar.status === "PAGO") {
        throw { status: 400, message: "Nao e permitido editar uma conta a pagar com status PAGO." };
      }

      contaPagar.status = "PAGO";
      contaPagar.data_liquidacao = dados.data_liquidacao || new Date();
      contaPagar.data_estorno = null;
      contaPagar.forma_pagamento = dados.forma_pagamento || contaPagar.forma_pagamento;
      contaPagar.historico = this.adicionarHistorico(
        dados.historico || contaPagar.historico,
        `Pagamento registrado em ${new Date(contaPagar.data_liquidacao).toLocaleDateString("pt-BR")}`
      );
      await contaPagar.save({ transaction });

      await ContabilidadeService.lancarPagamento({
        contaPagar,
        transaction
      });

      return contaPagar;
    });
  }

  static async estornarContaPagar(contaPagarId, dados = {}) {
    if (!contaPagarId) {
      throw { status: 400, message: "Informe o id da conta a pagar." };
    }

    return sequelize.transaction(async (transaction) => {
      const contaPagar = await ContaPagar.findByPk(contaPagarId, { transaction });

      if (!contaPagar) {
        throw { status: 404, message: "Conta a pagar nao encontrada." };
      }

      if (contaPagar.status !== "PAGO") {
        throw { status: 400, message: "Apenas contas pagas podem ser estornadas." };
      }

      const dataBaixaAnterior = contaPagar.data_liquidacao;
      contaPagar.status = "PENDENTE";
      contaPagar.data_liquidacao = null;
      contaPagar.data_estorno = dados.data_estorno || new Date();
      contaPagar.historico = this.adicionarHistorico(
        dados.historico || contaPagar.historico,
        `Estorno do pagamento de ${dataBaixaAnterior ? new Date(dataBaixaAnterior).toLocaleDateString("pt-BR") : "data nao informada"}`
      );
      await contaPagar.save({ transaction });

      await ContabilidadeService.estornarPagamento({
        contaPagar,
        transaction
      });

      return contaPagar;
    });
  }
}

module.exports = CompraService;
