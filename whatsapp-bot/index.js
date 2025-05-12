const venom = require("venom-bot");
const axios = require("axios");
const express = require("express");
const CARDAPIO = require("./cardapio");

const BACKEND_API_URL = "http://localhost:3001/api/pedidos";
const BOT_NOTIFICATION_PORT = 3002;

let venomClientInstance = null;

venom
  .create(
    "pizza-ordering-session-v4",
    (base64Qr, asciiQR, attempts, urlCode) => {
      console.log("Tentativas QR:", attempts);
      console.log("--------------------------------------------------");
      console.log("Escaneie o QR Code com seu WhatsApp:");
      console.log(asciiQR);
      console.log("--------------------------------------------------");
    },
    (statusSession, session) => {
      console.log("Status da Sessão:", statusSession);
    },
    {
      headless: "new",
      devtools: false,
      useChrome: true,
      debug: false,
      logQR: true,
      browserArgs: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
      autoClose: 120000,
      createPathFileToken: true,
    }
  )
  .then((client) => {
    venomClientInstance = client;
    startMainBotLogic(client);
    startNotificationListener(client);
  })
  .catch((erro) => {
    console.error("Erro ao criar sessão Venom:", erro);
    process.exit(1);
  });

const sessoesClientes = {};

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function gerarMenuPrincipal() {
  return `Olá! Bem-vindo(a) à Pizzaria TOP! 🍕\n\nComo posso te ajudar hoje?\n1. 📋 Ver Cardápio Completo\n2. 🔥 Ver Ofertas do Dia\n3. 🥤 Ver Bebidas\n4. 🛒 Ver meu carrinho/Finalizar Pedido\n5. ❓ Ajuda / Falar com Atendente\n\nDigite o número da opção desejada:`;
}

function gerarMenuCategoria(categoriaNome, itens) {
  let menu = `Ok! Aqui estão nossas opções de ${categoriaNome}:\n\n`;
  itens.forEach((item, index) => {
    menu += `${index + 1}. ${item.nome}\n`;
    if (item.tamanhos) {
      menu += `   (P: ${formatarMoeda(
        item.tamanhos.pequena.preco
      )} / M: ${formatarMoeda(item.tamanhos.media.preco)} / G: ${formatarMoeda(
        item.tamanhos.grande.preco
      )})\n`;
    } else if (item.preco) {
      menu += `   (${formatarMoeda(item.preco)})\n`;
    }
  });
  menu += `\nDigite o número do item ou "V" para Voltar.`;
  return menu;
}

function startMainBotLogic(client) {
  console.log("BOT DO WHATSAPP INICIADO! Cliente Venom está pronto.");

  client.onMessage(async (message) => {
    if (
      message.isGroupMsg ||
      !message.body ||
      message.from === "status@broadcast"
    ) {
      return;
    }

    const chatId = message.from;
    const mensagemRecebida = message.body.trim();
    const agora = new Date().toLocaleTimeString();

    console.log(`[${agora}] Mensagem de ${chatId}: "${mensagemRecebida}"`);

    if (!sessoesClientes[chatId]) {
      sessoesClientes[chatId] = {
        etapa: "inicio",
        pedido: { itens: [], valorTotal: 0.0 },
        itemAtual: null,
        categoriaAtual: null,
      };
    }

    const sessao = sessoesClientes[chatId];

    if (
      mensagemRecebida.toLowerCase() === "cancelar" &&
      sessao.etapa !== "inicio"
    ) {
      delete sessoesClientes[chatId];
      await client.sendText(
        chatId,
        'Seu pedido e interação foram cancelados. Se quiser começar de novo, é só mandar um "Oi"! 👋'
      );
      return;
    }

    try {
      switch (sessao.etapa) {
        case "inicio":
          await client.sendText(chatId, gerarMenuPrincipal());
          sessao.etapa = "aguardando_opcao_menu_principal";
          break;

        case "aguardando_opcao_menu_principal":
          if (mensagemRecebida === "1") {
            sessao.categoriaAtual = "pizzas";
            await client.sendText(
              chatId,
              gerarMenuCategoria("Pizzas", CARDAPIO.pizzas)
            );
            sessao.etapa = "selecionando_item_categoria";
          } else if (mensagemRecebida === "2") {
            sessao.categoriaAtual = "ofertas";
            await client.sendText(
              chatId,
              gerarMenuCategoria("Ofertas do Dia", CARDAPIO.ofertas)
            );
            sessao.etapa = "selecionando_item_categoria";
          } else if (mensagemRecebida === "3") {
            sessao.categoriaAtual = "bebidas";
            await client.sendText(
              chatId,
              gerarMenuCategoria("Bebidas", CARDAPIO.bebidas)
            );
            sessao.etapa = "selecionando_item_categoria";
          } else if (mensagemRecebida === "4") {
            if (sessao.pedido.itens.length === 0) {
              await client.sendText(
                chatId,
                "Seu carrinho está vazio.\n" + gerarMenuPrincipal()
              );
              sessao.etapa = "aguardando_opcao_menu_principal";
            } else {
              sessao.etapa = "informar_endereco";
              await client.sendText(
                chatId,
                "Para finalizar, informe nome e endereço completo."
              );
            }
          } else if (mensagemRecebida === "5") {
            await client.sendText(
              chatId,
              "Para falar com um atendente, aguarde ou ligue para (XX) XXXX-XXXX. Para voltar ao menu, digite 'menu'."
            );
            sessao.etapa = "falar_atendente_ou_menu";
          } else {
            await client.sendText(
              chatId,
              "Opção inválida.\n" + gerarMenuPrincipal()
            );
          }
          break;

        case "falar_atendente_ou_menu":
          if (mensagemRecebida.toLowerCase() === "menu") {
            await client.sendText(chatId, gerarMenuPrincipal());
            sessao.etapa = "aguardando_opcao_menu_principal";
          } else {
            await client.sendText(
              chatId,
              "Para voltar ao menu, digite 'menu'."
            );
          }
          break;

        case "selecionando_item_categoria":
          if (mensagemRecebida.toLowerCase() === "v") {
            await client.sendText(chatId, gerarMenuPrincipal());
            sessao.etapa = "aguardando_opcao_menu_principal";
            sessao.categoriaAtual = null;
            break;
          }
          const indiceSelecionado = parseInt(mensagemRecebida) - 1;
          let itensDaCategoria;
          if (sessao.categoriaAtual === "pizzas")
            itensDaCategoria = CARDAPIO.pizzas;
          else if (sessao.categoriaAtual === "bebidas")
            itensDaCategoria = CARDAPIO.bebidas;
          else if (sessao.categoriaAtual === "ofertas")
            itensDaCategoria = CARDAPIO.ofertas;

          if (
            itensDaCategoria &&
            indiceSelecionado >= 0 &&
            indiceSelecionado < itensDaCategoria.length
          ) {
            sessao.itemAtual = {
              ...itensDaCategoria[indiceSelecionado],
              quantidade: 1,
            };

            if (sessao.categoriaAtual === "pizzas") {
              let msgTamanhos = `Selecionado: ${sessao.itemAtual.nome}. Escolha o tamanho:\n`;
              Object.keys(sessao.itemAtual.tamanhos).forEach((tamKey, idx) => {
                msgTamanhos += `${idx + 1}. ${
                  sessao.itemAtual.tamanhos[tamKey].descricao
                } - ${formatarMoeda(
                  sessao.itemAtual.tamanhos[tamKey].preco
                )}\n`;
              });
              await client.sendText(
                chatId,
                msgTamanhos + "\nDigite o número do tamanho."
              );
              sessao.etapa = "selecionando_tamanho_pizza";
            } else if (
              sessao.categoriaAtual === "bebidas" &&
              sessao.itemAtual.opcoes
            ) {
              let msgOpcoes = `Selecionado: ${sessao.itemAtual.nome}. Qual opção?\n`;
              sessao.itemAtual.opcoes.forEach((opcao, idx) => {
                msgOpcoes += `${idx + 1}. ${opcao}\n`;
              });
              await client.sendText(
                chatId,
                msgOpcoes + "\nDigite o número da opção."
              );
              sessao.etapa = "selecionando_opcao_bebida";
            } else {
              sessao.pedido.itens.push({
                nome: sessao.itemAtual.nome,
                precoUnitario: sessao.itemAtual.preco,
                quantidade: 1,
                subtotal: sessao.itemAtual.preco,
              });
              sessao.pedido.valorTotal += sessao.itemAtual.preco;
              await client.sendText(
                chatId,
                `${sessao.itemAtual.nome} adicionado! Carrinho: ${formatarMoeda(
                  sessao.pedido.valorTotal
                )}\n\nAdicionar mais? (Ou "N" para endereço)\n` +
                  gerarMenuPrincipal()
              );
              sessao.etapa = "aguardando_opcao_menu_principal";
              sessao.itemAtual = null;
            }
          } else {
            await client.sendText(
              chatId,
              "Opção inválida. Escolha um número da lista ou 'V'."
            );
          }
          break;

        case "selecionando_tamanho_pizza":
          const indiceTamanho = parseInt(mensagemRecebida) - 1;
          const tamanhosKeys = Object.keys(sessao.itemAtual.tamanhos);
          if (indiceTamanho >= 0 && indiceTamanho < tamanhosKeys.length) {
            const tamanhoSelecionadoKey = tamanhosKeys[indiceTamanho];
            const tamanhoInfo =
              sessao.itemAtual.tamanhos[tamanhoSelecionadoKey];
            sessao.pedido.itens.push({
              nome: `${sessao.itemAtual.nome} (${tamanhoInfo.descricao})`,
              precoUnitario: tamanhoInfo.preco,
              quantidade: sessao.itemAtual.quantidade,
              subtotal: tamanhoInfo.preco,
            });
            sessao.pedido.valorTotal += tamanhoInfo.preco;
            await client.sendText(
              chatId,
              `${sessao.itemAtual.nome} (${
                tamanhoInfo.descricao
              }) adicionado! Carrinho: ${formatarMoeda(
                sessao.pedido.valorTotal
              )}\n\nAdicionar mais? (Ou "N" para endereço)\n` +
                gerarMenuPrincipal()
            );
            sessao.etapa = "aguardando_opcao_menu_principal";
            sessao.itemAtual = null;
          } else {
            await client.sendText(chatId, "Tamanho inválido.");
          }
          break;

        case "selecionando_opcao_bebida":
          const indiceOpcao = parseInt(mensagemRecebida) - 1;
          if (
            sessao.itemAtual.opcoes &&
            indiceOpcao >= 0 &&
            indiceOpcao < sessao.itemAtual.opcoes.length
          ) {
            const opcaoSelecionada = sessao.itemAtual.opcoes[indiceOpcao];
            sessao.pedido.itens.push({
              nome: `${sessao.itemAtual.nome} (${opcaoSelecionada})`,
              precoUnitario: sessao.itemAtual.preco,
              quantidade: sessao.itemAtual.quantidade,
              subtotal: sessao.itemAtual.preco,
            });
            sessao.pedido.valorTotal += sessao.itemAtual.preco;
            await client.sendText(
              chatId,
              `${
                sessao.itemAtual.nome
              } (${opcaoSelecionada}) adicionado! Carrinho: ${formatarMoeda(
                sessao.pedido.valorTotal
              )}\n\nAdicionar mais? (Ou "N" para endereço)\n` +
                gerarMenuPrincipal()
            );
            sessao.etapa = "aguardando_opcao_menu_principal";
            sessao.itemAtual = null;
          } else {
            await client.sendText(chatId, "Opção inválida.");
          }
          break;

        case "informar_endereco":
          if (
            mensagemRecebida.toLowerCase() === "n" &&
            sessao.pedido.itens.length === 0
          ) {
            await client.sendText(
              chatId,
              "Carrinho vazio. Adicione itens.\n" + gerarMenuPrincipal()
            );
            sessao.etapa = "aguardando_opcao_menu_principal";
            break;
          }
          if (
            mensagemRecebida.toLowerCase() === "n" &&
            sessao.pedido.itens.length > 0
          ) {
            sessao.etapa = "informar_endereco";
            await client.sendText(chatId, "Informe nome e endereço completo.");
            break;
          }

          sessao.pedido.endereco = mensagemRecebida;
          let notaFiscal = `🧾 *NOTA DO PEDIDO* 🧾\n\nEndereço: ${sessao.pedido.endereco}\n\n------------------------------------\nITENS:\n`;
          sessao.pedido.itens.forEach((item) => {
            notaFiscal += `${item.quantidade}x ${item.nome} - ${formatarMoeda(
              item.precoUnitario
            )} (un.) = ${formatarMoeda(item.subtotal)}\n`;
          });
          notaFiscal += `------------------------------------\n*VALOR TOTAL: ${formatarMoeda(
            sessao.pedido.valorTotal
          )}*\n\nDigite *"Confirmar"*, *"Voltar"* ou *"Cancelar"*.`;
          await client.sendText(chatId, notaFiscal);
          sessao.etapa = "confirmacao_final";
          break;

        case "confirmacao_final":
          if (mensagemRecebida.toLowerCase() === "confirmar") {
            await client.sendText(
              chatId,
              "Pedido confirmado! 🎉 Preparando..."
            );

            const dadosParaBackend = {
              itens: sessao.pedido.itens,
              valorTotal: sessao.pedido.valorTotal,
              enderecoEntrega: sessao.pedido.endereco,
              clienteWhatsapp: chatId,
              dataHora: new Date().toISOString(),
            };

            try {
              const response = await axios.post(
                BACKEND_API_URL,
                dadosParaBackend
              );
              console.log(
                `[${agora}] Pedido ${response.data.pedido?.id} enviado p/ backend.`
              );
              await client.sendText(
                chatId,
                `Oba! Pedido #${
                  response.data.pedido?.id || ""
                } recebido! Obrigado! 😊`
              );
            } catch (error) {
              const errorMsg = error.response
                ? JSON.stringify(error.response.data)
                : error.message;
              console.error(
                `[${agora}] ERRO ao enviar pedido p/ backend: ${errorMsg}`
              );
              await client.sendText(
                chatId,
                "Ops! 😥 Problema ao registrar seu pedido. Tente mais tarde."
              );
            }
            delete sessoesClientes[chatId];
          } else if (mensagemRecebida.toLowerCase() === "voltar") {
            await client.sendText(
              chatId,
              "Ok, voltando. Você quer:\n1. Alterar endereço\n2. Adicionar mais itens"
            );
            sessao.etapa = "corrigir_pedido";
          } else if (mensagemRecebida.toLowerCase() === "cancelar") {
            delete sessoesClientes[chatId];
            await client.sendText(
              chatId,
              'Pedido cancelado. Mande um "Oi" para começar de novo! 👋'
            );
          } else {
            await client.sendText(
              chatId,
              'Digite "Confirmar", "Voltar" ou "Cancelar".'
            );
          }
          break;

        case "corrigir_pedido":
          if (mensagemRecebida === "1") {
            sessao.etapa = "informar_endereco";
            await client.sendText(chatId, "Informe o novo nome e endereço.");
          } else if (mensagemRecebida === "2") {
            await client.sendText(chatId, gerarMenuPrincipal());
            sessao.etapa = "aguardando_opcao_menu_principal";
          } else {
            await client.sendText(chatId, "Escolha 1 ou 2.");
          }
          break;

        default:
          delete sessoesClientes[chatId];
          await client.sendText(
            chatId,
            'Algo deu errado. Recomeçando... Mande um "Oi"!'
          );
          break;
      }
    } catch (e) {
      console.error(`[${agora}] Erro CRÍTICO para ${chatId}:`, e);
      await client.sendText(
        chatId,
        "Ops! Erro inesperado. 😵 Recomeçando... Mande um 'Oi'."
      );
      delete sessoesClientes[chatId];
    }
  });

  client.onStateChange((state) => {
    console.log("Bot: Estado da conexão:", state);
    if (
      ["CONFLICT", "UNLAUNCHED", "UNPAIRED", "DISCONNECTED"].includes(state)
    ) {
      console.log("Bot: Conexão perdida. Tentando reconectar...");
      client.forceRefocus().catch((err) => console.error("Erro refocus:", err));
    }
  });
}

function startNotificationListener(client) {
  const app = express();
  app.use(express.json());

  app.post("/api/notificar-cliente", async (req, res) => {
    const { chatId, pedidoId, novoStatus } = req.body;
    const agora = new Date().toLocaleTimeString();
    console.log(
      `[${agora}] Bot: Recebida notificação para ${chatId}, Pedido ${pedidoId}, Status: ${novoStatus}`
    );

    if (!chatId || !novoStatus || !pedidoId) {
      console.error("Bot: Dados incompletos na notificação recebida.");
      return res.status(400).json({
        message:
          "Dados incompletos (chatId, pedidoId, novoStatus são obrigatórios).",
      });
    }

    if (!client) {
      console.error(
        "Bot: Instância do cliente Venom não está pronta para enviar notificação."
      );
      return res
        .status(500)
        .json({ message: "Instância do bot não inicializada." });
    }

    let mensagemStatus = "";
    switch (novoStatus.toLowerCase()) {
      case "em preparo":
        mensagemStatus = `Seu pedido #${pedidoId} está sendo preparado com carinho! 👨‍🍳`;
        break;
      case "a caminho": // Alterado de "saiu para entrega"
        mensagemStatus = `Boas notícias! Seu pedido #${pedidoId} está a caminho! 🚀`;
        break;
      case "entregue":
        mensagemStatus = `Pedido #${pedidoId} entregue! Esperamos que goste! Bom apetite! 😄`;
        break;
      case "cancelado":
        mensagemStatus = `Atenção: O status do seu pedido #${pedidoId} foi alterado para Cancelado. Se tiver dúvidas, entre em contato.`;
        break;
      default:
        console.log(
          `Bot: Status '${novoStatus}' não mapeado para notificação.`
        );
        return res
          .status(200)
          .json({ message: "Status não requer notificação ao cliente." });
    }

    try {
      await client.sendText(chatId, mensagemStatus);
      console.log(
        `[${agora}] Bot: Notificação de status '${novoStatus}' enviada para ${chatId}.`
      );
      res.status(200).json({ message: "Notificação enviada ao cliente." });
    } catch (error) {
      console.error(
        `[${agora}] Bot: ERRO ao enviar notificação de status para ${chatId}:`,
        error
      );
      res
        .status(500)
        .json({ message: "Erro ao enviar mensagem via WhatsApp." });
    }
  });

  app.listen(BOT_NOTIFICATION_PORT, () => {
    console.log(
      `Bot: Servidor de notificações rodando na porta ${BOT_NOTIFICATION_PORT}`
    );
    console.log(
      `Bot: Aguardando notificações do backend em http://localhost:${BOT_NOTIFICATION_PORT}/api/notificar-cliente`
    );
  });
}
