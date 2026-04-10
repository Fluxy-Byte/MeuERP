# Imagem base
FROM node:20-alpine

WORKDIR /usr/app

COPY package.json ./

# Instala dependências do Node
RUN npm install --legacy-peer-deps

COPY . .

# Expõe a porta da aplicação
EXPOSE 5951

# Comando de inicialização
CMD ["npm", "start"]