# Meu ERP

Micro-ERP acadêmico desenvolvido para a disciplina de Sistemas de Informações Gerenciais.

O projeto implementa o ciclo operacional de uma pequena empresa comercial:

- cadastros mestres
- compras
- estoque
- vendas
- financeiro
- contabilidade básica

Além do backend em Node.js com Express e Sequelize, o sistema também possui uma interface web simples servida pelo próprio servidor.

## Stack

- Node.js
- Express
- MySQL
- Sequelize ORM
- JavaScript
- HTML, CSS e JavaScript no frontend

## Arquitetura

O backend segue estrutura em camadas:

```text
src/
  controllers/
  services/
  models/
  routes/
  database/
  middlewares/
  utils/
public/
server.js
package.json
```

Fluxo principal:

```text
Route -> Controller -> Service -> Model
```

## Funcionalidades Implementadas

### Cadastros

- cadastro, consulta, edição, exclusão e desabilitação de clientes
- cadastro, consulta, edição, exclusão e desabilitação de fornecedores
- cadastro, consulta, edição, exclusão e desabilitação de produtos
- SKU único por produto através do campo `codigo`
- cálculo e armazenamento de margem de lucro
- controle de estoque mínimo
- cadastro e gestão de usuários
- login com autenticação por token
- perfis de acesso `ADMIN` e `VENDEDOR`
- cadastro e consulta de plano de contas com estrutura hierárquica

### Compras

- emissão de pedido de compra
- confirmação de recebimento
- desconto por compra
- registro de NF de entrada
- forma de pagamento
- geração automática de conta a pagar
- atualização automática de estoque
- atualização de custo médio
- lançamento contábil da compra recebida

### Estoque

- entrada automática por compra
- saída automática por venda
- bloqueio de estoque negativo por padrão
- log de movimentações com produto, tipo, quantidade, usuário e motivo
- relatório de necessidade de compra

### Vendas

- emissão de pedido de venda com múltiplos itens
- baixa imediata de estoque
- gravação do preço e custo unitário nos itens da venda
- geração automática de conta a receber
- cálculo simples de imposto sobre venda
- comprovante simples da venda em JSON ou HTML

### Financeiro

- listagem de contas a receber
- listagem de contas a pagar
- baixa de títulos
- estorno de baixa
- fluxo de caixa resumido

### Contabilidade

- lançamentos contábeis automáticos para:
  - compra recebida
  - venda
  - recebimento
  - pagamento
  - estorno de recebimento
  - estorno de pagamento
- relatórios de:
  - lucratividade
  - impostos
  - balanço patrimonial
  - DRE

## Regras de Negócio

- venda reduz estoque automaticamente
- compra aumenta estoque automaticamente
- o sistema grava o preço unitário da venda no item vendido
- não é permitido editar ou baixar novamente uma conta já paga sem estorno
- o estorno devolve a conta para `PENDENTE`
- toda compra e venda gera movimentação de estoque
- o vendedor tem acesso apenas ao necessário para operação comercial
- o administrador possui acesso total

## Perfis de Acesso

### ADMIN

- acesso total ao sistema
- gerencia usuários, produtos, fornecedores, compras, financeiro, relatórios e plano de contas

### VENDEDOR

- consulta produtos
- consulta, cria e edita clientes
- registra vendas
- acessa dashboard

## Requisitos

Antes de rodar o projeto, você precisa ter instalado:

- Node.js
- MySQL Server 8

## Configuração do Ambiente

Crie um arquivo `.env` na raiz do projeto com base no exemplo abaixo:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=micro_erp_academico
DB_USER=root
DB_PASSWORD=123456
AUTH_SECRET=meu-segredo
DEFAULT_ADMIN_EMAIL=admin@microerp.local
DEFAULT_ADMIN_PASSWORD=admin123
SALES_TAX_PERCENT=10
ALLOW_SALE_WITHOUT_STOCK=false
```

## Instalação

```bash
npm install
```

## Execução

Modo normal:

```bash
npm start
```

Modo desenvolvimento:

```bash
npm run dev
```

Depois disso, acesse:

- frontend: [http://localhost:3000](http://localhost:3000)
- health check: [http://localhost:3000/health](http://localhost:3000/health)

## Banco de Dados

O projeto usa `sequelize.sync()` para criar e ajustar as tabelas automaticamente.

Se o banco ainda não existir, crie no MySQL:

```sql
CREATE DATABASE micro_erp_academico;
```

## Usuário Padrão

Se o banco estiver vazio, o sistema cria automaticamente um administrador padrão:

- email: `admin@microerp.local`
- senha: `admin123`

Esses valores podem ser alterados pelas variáveis:

- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PASSWORD`

## Principais Rotas

Todas as rotas, exceto login, exigem autenticação com token Bearer.

### Autenticação

- `POST /auth/login`
- `GET /auth/me`

### Produtos

- `POST /produtos`
- `GET /produtos`
- `GET /produtos/:id`
- `PUT /produtos/:id`
- `PATCH /produtos/:id/desabilitar`
- `DELETE /produtos/:id`

### Clientes

- `POST /clientes`
- `GET /clientes`
- `GET /clientes/:id`
- `PUT /clientes/:id`
- `PATCH /clientes/:id/desabilitar`
- `DELETE /clientes/:id`

### Fornecedores

- `POST /fornecedores`
- `GET /fornecedores`
- `GET /fornecedores/:id`
- `PUT /fornecedores/:id`
- `PATCH /fornecedores/:id/desabilitar`
- `DELETE /fornecedores/:id`

### Usuários

- `POST /usuarios`
- `GET /usuarios`
- `GET /usuarios/:id`
- `PUT /usuarios/:id`
- `PATCH /usuarios/:id/desabilitar`
- `DELETE /usuarios/:id`

### Plano de Contas

- `POST /plano-contas`
- `GET /plano-contas`
- `GET /plano-contas/:id`
- `PUT /plano-contas/:id`
- `PATCH /plano-contas/:id/desabilitar`
- `DELETE /plano-contas/:id`

### Compras

- `POST /compras`
- `POST /compras/receber`
- `POST /compras/contas-pagar/baixar`

### Vendas

- `POST /vendas`
- `GET /vendas/:id/comprovante`
- `GET /vendas/:id/comprovante?formato=html`

### Financeiro

- `GET /contas-receber`
- `POST /contas-receber/baixar`
- `POST /contas-receber/estornar`
- `GET /contas-pagar`
- `POST /contas-pagar/baixar`
- `POST /contas-pagar/estornar`
- `GET /fluxo-caixa`

### Relatórios

- `GET /relatorios/necessidade-compra`
- `GET /relatorios/lucratividade`
- `GET /relatorios/impostos`
- `GET /relatorios/balanco`
- `GET /relatorios/dre`

## Exemplo de Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@microerp.local",
  "senha": "admin123"
}
```

## Exemplo de Cadastro de Produto

```http
POST /produtos
Authorization: Bearer SEU_TOKEN
Content-Type: application/json

{
  "nome": "Notebook",
  "codigo": "SKU-001",
  "preco_custo": 2500,
  "preco_venda": 3200,
  "estoque": 10,
  "estoque_minimo": 2
}
```

## Exemplo de Venda

```http
POST /vendas
Authorization: Bearer SEU_TOKEN
Content-Type: application/json

{
  "cliente_id": 1,
  "desconto": 50,
  "itens": [
    {
      "produto_id": 1,
      "quantidade": 2
    }
  ]
}
```

## Observações

- o frontend é servido localmente pela pasta `public/`
- as permissões variam conforme o perfil do usuário autenticado
- o banco pode ser ajustado automaticamente ao reiniciar o servidor
- o sistema foi construído com foco acadêmico e demonstrativo

## Autor

Projeto acadêmico do sistema **Meu ERP**.
