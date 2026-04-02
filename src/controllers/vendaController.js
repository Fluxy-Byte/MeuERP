const VendaService = require("../services/vendaService");

class VendaController {
  static async registrar(req, res, next) {
    try {
      const resultado = await VendaService.registrarVenda(req.body, req.usuario);
      return res.status(201).json(resultado);
    } catch (error) {
      return next(error);
    }
  }

  static async comprovante(req, res, next) {
    try {
      const comprovante = await VendaService.obterComprovanteVenda(req.params.id);
      const desejaHtml = req.query.formato === "html" || String(req.headers.accept || "").includes("text/html");

      if (!desejaHtml) {
        return res.json(comprovante);
      }

      const linhasItens = comprovante.itens
        .map(
          (item) => `
            <tr>
              <td>${item.produto}</td>
              <td>${item.quantidade}</td>
              <td>R$ ${item.preco_unitario.toFixed(2)}</td>
              <td>R$ ${item.subtotal.toFixed(2)}</td>
            </tr>`
        )
        .join("");

      return res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Comprovante da venda ${comprovante.pedido_id}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #1f2937; }
    h1, h2 { margin-bottom: 8px; }
    .bloco { margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
    th { background: #f3f4f6; }
    .totais p { margin: 6px 0; }
  </style>
</head>
<body>
  <h1>Comprovante de Venda</h1>
  <div class="bloco">
    <p><strong>Pedido:</strong> ${comprovante.pedido_id}</p>
    <p><strong>Emitido em:</strong> ${new Date(comprovante.emitido_em).toLocaleString("pt-BR")}</p>
    <p><strong>Cliente:</strong> ${comprovante.cliente?.nome || "Nao informado"}</p>
    <p><strong>CPF:</strong> ${comprovante.cliente?.cpf || "Nao informado"}</p>
  </div>
  <div class="bloco">
    <h2>Itens</h2>
    <table>
      <thead>
        <tr>
          <th>Produto</th>
          <th>Quantidade</th>
          <th>Preco unitario</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>${linhasItens}</tbody>
    </table>
  </div>
  <div class="bloco totais">
    <p><strong>Subtotal:</strong> R$ ${comprovante.resumo.subtotal.toFixed(2)}</p>
    <p><strong>Desconto:</strong> R$ ${comprovante.resumo.desconto.toFixed(2)}</p>
    <p><strong>Imposto (${comprovante.resumo.imposto_percentual}%):</strong> R$ ${comprovante.resumo.imposto_valor.toFixed(2)}</p>
    <p><strong>Total:</strong> R$ ${comprovante.resumo.total.toFixed(2)}</p>
  </div>
</body>
</html>`);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = VendaController;
