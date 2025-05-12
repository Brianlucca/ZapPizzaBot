# Projeto Bot de Pedidos de Pizzaria via WhatsApp com Painel de Controlo

Este projeto demonstra um sistema completo para receber pedidos de pizza via WhatsApp, com um bot para interagir com o cliente e um painel de controlo (dashboard) para a pizzaria visualizar e gerir os pedidos em tempo real.

## Funcionalidades Principais

* **Bot Interativo no WhatsApp:**
    * Menu principal com opções de ementa, ofertas e bebidas.
    * Fluxo de conversa guiado para seleção de itens, tamanhos, opções e quantidades.
    * Cálculo de subtotal e valor total do pedido.
    * Confirmação do pedido com resumo (formato "nota fiscal").
    * Notificações ao cliente sobre atualizações de estado do pedido (ex: "Em preparação", "A caminho").
* **Painel de Controlo (Dashboard) para a Pizzaria:**
    * Visualização de pedidos em colunas separadas por estado: Recebidos, Em Preparação, A caminho, Entregues, Cancelados.
    * Atualização de estado dos pedidos com botões.
    * Atualizações em tempo real de novos pedidos e mudanças de estado via WebSockets (Socket.IO).
    * Persistência dos pedidos no navegador usando \`localStorage\` para que não se percam ao fechar o separador.
    * Relatório diário básico (pedidos entregues/cancelados no dia e receita).
* **Comunicação Integrada:**
    * Bot envia pedidos confirmados para o Backend.
    * Backend notifica o Painel sobre novos pedidos e atualizações de estado.
    * Backend notifica o Bot sobre mudanças de estado feitas no Painel, para que o Bot avise o cliente no WhatsApp.

## Arquitetura do Sistema

O sistema é dividido em três componentes principais:

1.  **Frontend (Painel da Pizzaria):**
    * Desenvolvido com HTML, CSS puro e JavaScript.
    * Responsável por exibir os pedidos para a pizzaria.
    * Permite que a pizzaria altere o estado de um pedido.
    * Comunica-se com o Backend via HTTP (para buscar dados iniciais e enviar atualizações de estado) e WebSockets (Socket.IO para receber atualizações em tempo real).
    * Armazena os pedidos localmente no navegador (\`localStorage\`).

2.  **Backend (Servidor):**
    * Desenvolvido com Node.js e Express.js.
    * Serve como a API central do sistema.
    * Recebe pedidos do Bot do WhatsApp.
    * Recebe atualizações de estado do Frontend.
    * Envia atualizações em tempo real para o Frontend via Socket.IO.
    * Envia notificações para o Bot do WhatsApp (via HTTP) quando um estado é alterado no Frontend, para que o Bot possa notificar o cliente.
    * **Importante:** Nesta versão, os pedidos são armazenados apenas na memória do servidor e são perdidos se o servidor for reiniciado. Não utiliza base de dados.

3.  **Bot do WhatsApp:**
    * Desenvolvido com Node.js e a biblioteca \`venom-bot\`.
    * Interage com os clientes via WhatsApp.
    * Gere o fluxo de pedidos (ementa, seleção de itens, confirmação).
    * Envia os pedidos confirmados para o Backend via HTTP (usando \`axios\`).
    * Possui um pequeno servidor Express interno para receber notificações de atualização de estado do Backend e, então, enviar mensagens para o cliente no WhatsApp.

## Tecnologias Utilizadas

* **Frontend:**
    * HTML5
    * CSS3 (Puro)
    * JavaScript
    * Socket.IO Client
    * Google Fonts (Inter)
* **Backend:**
    * Node.js
    * Express.js
    * Socket.IO
    * Axios
    * CORS
* **Bot do WhatsApp:**
    * Node.js
    * Venom Bot
    * Axios
    * Express.js (para o servidor de notificações interno)

## Estrutura de Pastas do Projeto

```
/nome-do-seu-projeto/
├── /backend/
│   ├── node_modules/
│   ├── package.json
│   ├── package-lock.json
│   └── server.js           # Lógica do servidor backend
├── /frontend/
│   ├── index.html          # Estrutura do painel
│   ├── style.css           # Estilos do painel
│   └── script.js           # Lógica JavaScript do painel
└── /whatsapp-bot/
    ├── node_modules/
    ├── tokens/             # Criada pelo Venom para guardar a sessão
    ├── package.json
    ├── package-lock.json
    ├── cardapio.js         # Definição da ementa do bot
    └── index.js            # Lógica principal do bot WhatsApp
```
## Configuração e Instalação

Certifique-se de ter o [Node.js](https://nodejs.org/) (que inclui o npm) instalado na sua máquina.

### 1. Backend

```bash
# Navegue até à pasta do backend
cd caminho/para/seu/projeto/backend

# Instale as dependências
npm install
```

### 2. Bot do WhatsApp

```bash
# Navegue até à pasta do bot
cd caminho/para/seu/projeto/whatsapp-bot

# Instale as dependências
npm install
```

### 3. Frontend

Nenhuma instalação é necessária além de ter os ficheiros \`index.html\`, \`style.css\` e \`script.js\` na mesma pasta (a pasta \`frontend/\`).

## Como Executar o Projeto

É crucial iniciar os componentes na ordem correta devido às suas dependências de comunicação.

**Ordem de Inicialização:**

1.  **Backend:**
    ```bash
    # Dentro da pasta /backend/
    node server.js
    ```
    Deverá ver logs a indicar que o servidor está a ser executado na porta 3001 (ou a configurada) e o URL para notificar o bot.

2.  **Bot do WhatsApp:**
    ```bash
    # Dentro da pasta /whatsapp-bot/
    node index.js
    ```
    Um código QR aparecerá no terminal. Digitalize este código QR com o WhatsApp do celular que será usado pelo bot. Após digitalizar, verá logs a indicar que o bot está pronto e o servidor de notificações interno do bot está a ser executado na porta 3002.

3.  **Frontend:**
    * Abra o ficheiro \`frontend/index.html\` diretamente no seu navegador de internet (ex: Google Chrome, Firefox).
    * Pode fazer isto clicando duas vezes no ficheiro ou usando uma extensão como "Live Server" no VS Code (que geralmente serve o ficheiro num endereço como \`http://127.0.0.1:5500\`). O backend já está configurado para aceitar conexões dessa origem para o Socket.IO.

## Fluxo de um Novo Pedido

1.  **Cliente (WhatsApp):** Envia uma mensagem como "Olá" ou "Pizza" para o número do bot.
2.  **Bot do WhatsApp:** Responde com o menu principal. O cliente navega, escolhe itens, informa dados.
3.  **Bot do WhatsApp:** No final, apresenta um resumo ("nota fiscal") e pede confirmação.
4.  **Cliente (WhatsApp):** Digita "Confirmar".
5.  **Bot do WhatsApp:**
    * Envia uma mensagem de confirmação para o cliente.
    * Envia os dados completos do pedido (via HTTP POST com \`axios\`) para a API do **Backend** (\`http://localhost:3001/api/pedidos\`).
6.  **Backend:**
    * Recebe o novo pedido na rota \`/api/pedidos\`.
    * Adiciona o pedido à sua lista em memória.
    * Emite um evento \`novoPedido\` via **Socket.IO** com os dados do pedido.
7.  **Frontend (Painel):**
    * Está conectado ao Socket.IO do Backend.
    * Recebe o evento \`novoPedido\`.
    * Adiciona o novo pedido à coluna "Recebidos" e atualiza o \`localStorage\`.

## Fluxo de Atualização de Estado

1.  **Pizzaria (Frontend):** Clica num botão de estado num card de pedido (ex: "Em Preparação").
2.  **Frontend:**
    * Desabilita os botões do card temporariamente.
    * Envia uma requisição HTTP \`PATCH\` para a API do **Backend** (\`http://localhost:3001/api/pedidos/:id/status\`) com o novo estado.
3.  **Backend:**
    * Recebe a atualização na rota \`/api/pedidos/:id/status\`.
    * Atualiza o estado do pedido correspondente na sua lista em memória.
    * Emite um evento \`statusPedidoAtualizado\` via **Socket.IO** com os dados do pedido atualizado.
    * Envia uma requisição HTTP \`POST\` (via \`axios\`) para o servidor interno do **Bot do WhatsApp** (\`http://localhost:3002/api/notificar-cliente\`) contendo o \`chatId\` do cliente, \`pedidoId\` e o \`novoEstado\`.
4.  **Frontend (Painel):**
    * Recebe o evento \`statusPedidoAtualizado\` do Backend.
    * Move o card do pedido para a coluna correta e atualiza visualmente o estado.
    * Atualiza o \`localStorage\`.
5.  **Bot do WhatsApp:**
    * Recebe a notificação do Backend na sua rota \`/api/notificar-cliente\`.
    * Envia uma mensagem para o cliente no WhatsApp a informar sobre a mudança de estado (ex: "O seu pedido #123 está em preparação!").

## Notas Importantes

* **Persistência de Dados:**
    * **Backend:** Os pedidos são armazenados **apenas na memória**. Se o \`server.js\` for reiniciado, todos os dados de pedidos no backend são perdidos. Para um sistema de produção, uma base de dados é essencial.
    * **Frontend:** Os pedidos são guardados em cache no \`localStorage\` do navegador. Isto significa que se fechar e reabrir o separador do painel, os pedidos ainda estarão lá. No entanto, esta é uma persistência local ao navegador e não substitui uma base de dados no backend.
* **Venom Bot e WhatsApp:**
    * O \`venom-bot\` automatiza o WhatsApp Web. Não é uma API oficial do WhatsApp.
    * Atualizações no WhatsApp Web pela Meta podem quebrar a funcionalidade do \`venom-bot\` até que a biblioteca seja atualizada pela comunidade.
    * Existe um risco (geralmente baixo para uso moderado e de testes) de a conta do WhatsApp ser sinalizada ou banida por usar automação não oficial, pois isso vai contra os Termos de Serviço do WhatsApp. Para fins de estudo e desenvolvimento pessoal, o risco é menor.
* **Configuração de Portas:**
    * Backend: \`3001\` (Socket.IO e API HTTP)
    * Servidor de Notificação do Bot: \`3002\` (API HTTP interna)
    * Frontend (Live Server): Geralmente \`5500\` ou similar.
    * Certifique-se de que estas portas não estão em uso por outras aplicações.
`;
