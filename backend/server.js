const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:5500"],
    methods: ["GET", "POST", "PATCH"],
  },
});

const BOT_WEBHOOK_URL = "http://localhost:3002/api/notificar-cliente";

let pedidosEmMemoria = [];
let proximoIdPedido = 1;

app.post("/api/pedidos", (req, res) => {
  try {
    const novoPedidoDados = req.body;
    console.log(
      "Backend: Novo pedido recebido via API:",
      JSON.stringify(novoPedidoDados, null, 2)
    );

    if (
      !novoPedidoDados.itens ||
      novoPedidoDados.itens.length === 0 ||
      !novoPedidoDados.valorTotal ||
      !novoPedidoDados.enderecoEntrega ||
      !novoPedidoDados.clienteWhatsapp
    ) {
      return res.status(400).json({ message: "Dados do pedido incompletos." });
    }

    const pedidoCompleto = {
      id: proximoIdPedido++,
      itensPedido: novoPedidoDados.itens,
      valorTotalPedido: novoPedidoDados.valorTotal,
      enderecoEntregaPedido: novoPedidoDados.enderecoEntrega,
      clienteWhatsappPedido: novoPedidoDados.clienteWhatsapp,
      status: "Recebido",
      dataPedido: novoPedidoDados.dataHora || new Date().toISOString(),
    };

    pedidosEmMemoria.push(pedidoCompleto);
    console.log("Backend: Pedido adicionado à memória:", pedidoCompleto);

    io.emit("novoPedido", pedidoCompleto);

    res
      .status(201)
      .json({
        message: "Pedido recebido com sucesso!",
        pedido: pedidoCompleto,
      });
  } catch (error) {
    console.error("Backend: Erro ao processar novo pedido:", error);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
});

app.get("/api/pedidos", (req, res) => {
  try {
    res.json([...pedidosEmMemoria].reverse());
  } catch (error) {
    console.error("Backend: Erro ao buscar pedidos:", error);
    res.status(500).json({ message: "Erro interno no servidor." });
  }
});

app.patch("/api/pedidos/:id/status", async (req, res) => {
  try {
    const pedidoId = parseInt(req.params.id);
    const { status } = req.body;

    const pedidoIndex = pedidosEmMemoria.findIndex((p) => p.id === pedidoId);

    if (pedidoIndex === -1) {
      return res.status(404).json({ message: "Pedido não encontrado." });
    }

    if (!status) {
      return res.status(400).json({ message: "Novo status não fornecido." });
    }

    pedidosEmMemoria[pedidoIndex].status = status;
    const pedidoAtualizado = pedidosEmMemoria[pedidoIndex];

    console.log(
      `Backend: Status do pedido ${pedidoId} atualizado para: ${status}`
    );
    io.emit("statusPedidoAtualizado", pedidoAtualizado);

    if (pedidoAtualizado.clienteWhatsappPedido) {
      try {
        console.log(
          `Backend: Enviando notificação para o bot sobre pedido ${pedidoId} para ${pedidoAtualizado.clienteWhatsappPedido}`
        );
        await axios.post(BOT_WEBHOOK_URL, {
          chatId: pedidoAtualizado.clienteWhatsappPedido,
          pedidoId: pedidoAtualizado.id,
          novoStatus: pedidoAtualizado.status,
        });
        console.log(`Backend: Notificação para bot enviada com sucesso.`);
      } catch (botError) {
        console.error(
          `Backend: Falha ao notificar o bot sobre pedido ${pedidoId}:`,
          botError.response ? botError.response.data : botError.message
        );
      }
    } else {
      console.warn(
        `Backend: Pedido ${pedidoId} atualizado, mas sem clienteWhatsapp para notificar.`
      );
    }

    res.json({
      message: "Status atualizado com sucesso!",
      pedido: pedidoAtualizado,
    });
  } catch (error) {
    console.error(
      `Backend: Erro ao atualizar status do pedido ${req.params.id}:`,
      error
    );
    res.status(500).json({ message: "Erro interno no servidor." });
  }
});

io.on("connection", (socket) => {
  console.log("Backend: Usuário frontend conectou via Socket.IO:", socket.id);
  socket.on("disconnect", () => {
    console.log("Backend: Usuário frontend desconectou:", socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor backend rodando na porta ${PORT}`);
  console.log(`Backend tentará notificar o bot em ${BOT_WEBHOOK_URL}`);
});
