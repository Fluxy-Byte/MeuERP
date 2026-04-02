const { DataTypes } = require("sequelize");
const sequelize = require("../database");

const ContaReceber = sequelize.define("ContaReceber", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  pedido_venda_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  valor: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      isDecimal: { msg: "O valor da conta a receber deve ser numerico." },
      min: { args: [0], msg: "O valor da conta a receber nao pode ser negativo." }
    }
  },
  data_vencimento: {
    type: DataTypes.DATE,
    allowNull: true
  },
  data_liquidacao: {
    type: DataTypes.DATE,
    allowNull: true
  },
  data_estorno: {
    type: DataTypes.DATE,
    allowNull: true
  },
  forma_pagamento: {
    type: DataTypes.STRING,
    allowNull: true
  },
  historico: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM("PENDENTE", "PAGO"),
    allowNull: false,
    defaultValue: "PENDENTE"
  }
});

module.exports = ContaReceber;
