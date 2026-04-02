const sequelize = require("../database");
const {
  Cliente,
  Produto,
  PedidoVenda,
  ItemVenda,
  EstoqueMovimentacao,
  ContaReceber
} = require("../models");
const ContabilidadeService = require("./contabilidadeService");

class VendaService {
  static async obterComprovanteVenda(id) {
    const pedido = await PedidoVenda.findByPk(id, {
      include: [
        { model: Cliente, as: "cliente" },
        {
          model: ItemVenda,
          as: "itens",
          include: [{ model: Produto, as: "produto" }]
        },
        { model: ContaReceber, as: "contaReceber" }
      ]
    });

    if (!pedido) {
      throw { status: 404, message: "Pedido de venda nao encontrado." };
    }

    const itens = pedido.itens.map((item) => ({
      produto: item.produto?.nome || `Produto ${item.produto_id}`,
      quantidade: Number(item.quantidade),
      preco_unitario: Number(item.preco_unitario),
      subtotal: Number(item.quantidade) * Number(item.preco_unitario)
    }));

    return {
      pedido_id: pedido.id,
      emitido_em: pedido.createdAt,
      cliente: pedido.cliente,
      itens,
      resumo: {
        subtotal: Number(pedido.subtotal),
        desconto: Number(pedido.desconto),
        imposto_percentual: Number(pedido.imposto_percentual),
        imposto_valor: Number(pedido.imposto_valor),
        total: Number(pedido.total)
      },
      conta_receber: pedido.contaReceber
    };
  }

  static async registrarVenda(dados, usuario) {
    const { cliente_id, itens, desconto = 0 } = dados;

    if (!cliente_id || !Array.isArray(itens) || itens.length === 0) {
      throw {
        status: 400,
        message: "Cliente e itens da venda sao obrigatorios."
      };
    }

    return sequelize.transaction(async (transaction) => {
      const cliente = await Cliente.findByPk(cliente_id, { transaction });

      if (!cliente) {
        throw { status: 404, message: "Cliente nao encontrado." };
      }

      let subtotal = 0;
      let custoMercadoria = 0;
      const itensProcessados = [];
      const quantidadePorProduto = new Map();
      const permitirSemEstoque = String(process.env.ALLOW_SALE_WITHOUT_STOCK || "false") === "true";

      for (const item of itens) {
        if (!item.produto_id || !item.quantidade) {
          throw {
            status: 400,
            message: "Cada item da venda deve informar produto_id e quantidade."
          };
        }

        const quantidade = Number(item.quantidade);

        if (!Number.isFinite(quantidade) || quantidade <= 0) {
          throw {
            status: 400,
            message: "A quantidade do item da venda deve ser numerica e maior que zero."
          };
        }

        const produto = await Produto.findByPk(item.produto_id, {
          transaction,
          lock: transaction.LOCK.UPDATE
        });

        if (!produto) {
          throw { status: 404, message: `Produto ${item.produto_id} nao encontrado.` };
        }

        const quantidadeAcumulada = (quantidadePorProduto.get(item.produto_id) || 0) + quantidade;
        quantidadePorProduto.set(item.produto_id, quantidadeAcumulada);

        if (!permitirSemEstoque && Number(produto.estoque) < quantidadeAcumulada) {
          throw {
            status: 400,
            message: `Estoque insuficiente para o produto ${produto.nome}.`
          };
        }

        const precoUnitario = Number(produto.preco_venda);
        const custoUnitario = Number(produto.preco_custo || 0);

        subtotal += quantidade * precoUnitario;
        custoMercadoria += quantidade * custoUnitario;
        itensProcessados.push({
          produto,
          produto_id: item.produto_id,
          quantidade,
          preco_unitario: precoUnitario,
          custo_unitario: custoUnitario
        });
      }

      const descontoNumerico = Number(desconto || 0);
      if (!Number.isFinite(descontoNumerico) || descontoNumerico < 0 || descontoNumerico > subtotal) {
        throw { status: 400, message: "Desconto da venda invalido." };
      }

      const total = Number((subtotal - descontoNumerico).toFixed(2));
      const impostoPercentual = Number(process.env.SALES_TAX_PERCENT || 10);
      const impostoValor = Number(((total * impostoPercentual) / 100).toFixed(2));

      const pedido = await PedidoVenda.create(
        {
          cliente_id,
          subtotal,
          desconto: descontoNumerico,
          imposto_percentual: impostoPercentual,
          imposto_valor: impostoValor,
          total
        },
        { transaction }
      );

      for (const item of itensProcessados) {
        await ItemVenda.create(
          {
            pedido_id: pedido.id,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
            custo_unitario: item.custo_unitario
          },
          { transaction }
        );

        item.produto.estoque -= item.quantidade;
        await item.produto.save({ transaction });

        await EstoqueMovimentacao.create(
          {
            produto_id: item.produto_id,
            usuario_id: usuario?.id || null,
            pedido_venda_id: pedido.id,
            tipo: "SAIDA",
            quantidade: item.quantidade,
            motivo: "Baixa por venda"
          },
          { transaction }
        );
      }

      const contaReceber = await ContaReceber.create(
        {
          pedido_venda_id: pedido.id,
          valor: total,
          historico: `Conta gerada pela venda ${pedido.id}`,
          status: "PENDENTE"
        },
        { transaction }
      );

      await ContabilidadeService.lancarVenda({
        pedido,
        custoMercadoria,
        transaction
      });

      return {
        pedido,
        contaReceber
      };
    });
  }
}

module.exports = VendaService;
