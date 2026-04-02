const express = require("express");
const FinanceiroController = require("../controllers/financeiroController");
const { requireRole } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/contas-receber", requireRole("ADMIN"), FinanceiroController.listarContasReceber);
router.get("/contas-pagar", requireRole("ADMIN"), FinanceiroController.listarContasPagar);
router.post("/contas-receber/baixar", requireRole("ADMIN"), FinanceiroController.baixarContaReceber);
router.post("/contas-receber/estornar", requireRole("ADMIN"), FinanceiroController.estornarContaReceber);
router.post("/contas-pagar/baixar", requireRole("ADMIN"), FinanceiroController.baixarContaPagar);
router.post("/contas-pagar/estornar", requireRole("ADMIN"), FinanceiroController.estornarContaPagar);
router.get("/fluxo-caixa", requireRole("ADMIN"), FinanceiroController.fluxoCaixa);

module.exports = router;
