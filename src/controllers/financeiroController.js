const FinanceiroService = require("../services/financeiroService");
const CompraService = require("../services/compraService");

class FinanceiroController {
  static async listarContasReceber(req, res, next) {
    try {
      const contas = await FinanceiroService.listarContasReceber();
      return res.json(contas);
    } catch (error) {
      return next(error);
    }
  }

  static async listarContasPagar(req, res, next) {
    try {
      const contas = await FinanceiroService.listarContasPagar();
      return res.json(contas);
    } catch (error) {
      return next(error);
    }
  }

  static async baixarContaReceber(req, res, next) {
    try {
      const { conta_receber_id, ...dados } = req.body;
      const conta = await FinanceiroService.baixarContaReceber(conta_receber_id, dados);
      return res.json(conta);
    } catch (error) {
      return next(error);
    }
  }

  static async estornarContaReceber(req, res, next) {
    try {
      const { conta_receber_id, ...dados } = req.body;
      const conta = await FinanceiroService.estornarContaReceber(conta_receber_id, dados);
      return res.json(conta);
    } catch (error) {
      return next(error);
    }
  }

  static async fluxoCaixa(req, res, next) {
    try {
      const fluxo = await FinanceiroService.fluxoCaixa();
      return res.json(fluxo);
    } catch (error) {
      return next(error);
    }
  }

  static async baixarContaPagar(req, res, next) {
    try {
      const { conta_pagar_id, ...dados } = req.body;
      const conta = await CompraService.baixarContaPagar(conta_pagar_id, dados);
      return res.json(conta);
    } catch (error) {
      return next(error);
    }
  }

  static async estornarContaPagar(req, res, next) {
    try {
      const { conta_pagar_id, ...dados } = req.body;
      const conta = await CompraService.estornarContaPagar(conta_pagar_id, dados);
      return res.json(conta);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = FinanceiroController;
