const SOCKET_SERVER_URL = 'http://localhost:3001';
const API_BASE_URL = 'http://localhost:3001/api';
const STORAGE_KEY = 'pizzariaDashboardPedidos';

const colunas = {
    recebidos: document.getElementById('pedidos-recebidos'),
    emPreparo: document.getElementById('pedidos-em-preparo'),
    aCaminho: document.getElementById('pedidos-a-caminho'),
    entregues: document.getElementById('pedidos-entregues'),
    cancelados: document.getElementById('pedidos-cancelados')
};

const btnRelatorio = document.getElementById('btn-relatorio');
const relatorioContainer = document.getElementById('relatorio-container');
const relatorioConteudo = document.getElementById('relatorio-conteudo');

let pedidosCache = [];
let socket = null;

function formatarMoeda(valor) {
    if (typeof valor !== 'number') return 'R$ -';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(isoString) {
    if (!isoString) return '-';
    try { return new Date(isoString).toLocaleString('pt-BR'); }
    catch (e) { return '-'; }
}

function getStatusKey(status) {
    if (!status) return 'recebidos';
    const s = status.toLowerCase();
    if (s === 'recebido') return 'recebidos';
    if (s === 'em preparo') return 'emPreparo';
    if (s === 'a caminho') return 'aCaminho';
    if (s === 'saiu para entrega') return 'aCaminho'; // Compatibilidade com status antigo
    if (s === 'entregue') return 'entregues';
    if (s === 'cancelado') return 'cancelados';
    return 'recebidos';
}

function criarCardPedido(pedido) {
    const card = document.createElement('div');
    const statusOriginal = pedido.status || 'Desconhecido';
    const statusNormalizado = statusOriginal.toLowerCase() === 'saiu para entrega' ? 'A caminho' : statusOriginal;
    const statusLimpo = statusNormalizado.toLowerCase().replace(/\s+/g, '-') || 'desconhecido';

    card.className = `pedido-card status-${statusLimpo} fade-in`;
    card.id = `pedido-${pedido.id}`;
    card.draggable = true;

    let itensHtml = '<ul class="itens-lista">';
    if (pedido.itensPedido && Array.isArray(pedido.itensPedido)) {
         pedido.itensPedido.forEach(item => {
            itensHtml += `<li>${item.quantidade || 1}x ${item.nome || '?'} (${formatarMoeda(item.precoUnitario || 0)})</li>`;
         });
    } else {
        itensHtml += '<li>Itens não detalhados.</li>';
    }
    itensHtml += '</ul>';

    card.innerHTML = `
        <h3>Pedido #${pedido.id}</h3>
        <p><strong>Cliente:</strong> ${pedido.clienteWhatsappPedido?.split('@')[0] || 'N/I'}</p>
        <p><strong>Endereço:</strong> ${pedido.enderecoEntregaPedido || 'N/I'}</p>
        <p><strong>Data/Hora:</strong> ${formatarData(pedido.dataPedido)}</p>
        ${itensHtml}
        <p><strong>Valor Total:</strong> ${formatarMoeda(pedido.valorTotalPedido)}</p>
        <p><strong>Status:</strong> <span class="status-tag tag-${statusLimpo}">${statusNormalizado}</span></p>
        <div class="status-actions">
            <button class="btn-em-preparo" data-id="${pedido.id}" data-status="Em preparo" ${statusNormalizado === 'Em preparo' ? 'disabled' : ''}>Preparo</button>
            <button class="btn-a-caminho" data-id="${pedido.id}" data-status="A caminho" ${statusNormalizado === 'A caminho' ? 'disabled' : ''}>A Caminho</button>
            <button class="btn-entregue" data-id="${pedido.id}" data-status="Entregue" ${statusNormalizado === 'Entregue' ? 'disabled' : ''}>Entregue</button>
            <button class="btn-cancelado" data-id="${pedido.id}" data-status="Cancelado" ${statusNormalizado === 'Cancelado' || statusNormalizado === 'Entregue' ? 'disabled' : ''}>Cancelar</button>
        </div>
    `;
    return card;
}

function limparColunas() {
     Object.values(colunas).forEach(col => {
        const nomeColunaOriginal = col.id.split('-').slice(1).join(' '); // ex: "recebidos", "em preparo", "a caminho"
        col.innerHTML = `<p class="mensagem-vazio">Nenhum pedido ${nomeColunaOriginal}.</p>`;
     });
}

function renderizarPedidos(listaPedidos) {
    limparColunas();
    listaPedidos.sort((a,b) => new Date(b.dataPedido) - new Date(a.dataPedido));

    listaPedidos.forEach(pedido => {
        const statusKey = getStatusKey(pedido.status);
        const colunaDestino = colunas[statusKey];
        if (colunaDestino) {
            const msgVazio = colunaDestino.querySelector('.mensagem-vazio');
            if (msgVazio) {
                colunaDestino.removeChild(msgVazio);
            }
            const card = criarCardPedido(pedido);
            colunaDestino.appendChild(card);
        } else {
            console.warn(`Coluna não encontrada para status: ${pedido.status}`);
        }
    });
}

function salvarPedidosLocalStorage(listaPedidos) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(listaPedidos));
    } catch (e) {
        console.error("Erro ao salvar pedidos no localStorage:", e);
    }
}

function carregarPedidosLocalStorage() {
    try {
        const dadosSalvos = localStorage.getItem(STORAGE_KEY);
        return dadosSalvos ? JSON.parse(dadosSalvos) : [];
    } catch (e) {
        console.error("Erro ao carregar pedidos do localStorage:", e);
        return [];
    }
}

async function buscarPedidosIniciais() {
    try {
        const response = await fetch(`${API_BASE_URL}/pedidos`);
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        const pedidos = await response.json();
        pedidosCache = pedidos;
        salvarPedidosLocalStorage(pedidosCache);
        renderizarPedidos(pedidosCache);
    } catch (error) {
        console.error('Erro ao buscar pedidos iniciais:', error);
         Object.values(colunas).forEach(col => {
             if(col.querySelector('.pedido-card')) return;
             col.innerHTML = `<p class="mensagem-vazio" style="color: red;">Falha ao buscar novos pedidos.</p>`;
         });
    }
}

async function atualizarStatusPedido(idPedido, novoStatus) {
    console.log(`Atualizando ${idPedido} para ${novoStatus}`);
    try {
        const response = await fetch(`${API_BASE_URL}/pedidos/${idPedido}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: novoStatus }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP ${response.status}: ${errorData.message}`);
        }
        const resultado = await response.json();
        console.log('Sucesso ao atualizar:', resultado.message);
    } catch (error) {
        console.error(`Erro ao atualizar status ${idPedido}:`, error);
        alert(`Falha ao atualizar status: ${error.message}`);
         renderizarPedidos(pedidosCache);
    }
}

function gerarRelatorioDia() {
    const hoje = new Date().toISOString().split('T')[0];
    const pedidosDeHoje = pedidosCache.filter(p => p.dataPedido?.startsWith(hoje));

    const entreguesHoje = pedidosDeHoje.filter(p => p.status === 'Entregue');
    const canceladosHoje = pedidosDeHoje.filter(p => p.status === 'Cancelado');
    const totalEntregues = entreguesHoje.length;
    const totalCancelados = canceladosHoje.length;
    const receitaEntregues = entreguesHoje.reduce((soma, p) => soma + (p.valorTotalPedido || 0), 0);

    relatorioConteudo.innerHTML = `
        <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
        <p><strong>Pedidos Entregues Hoje:</strong> ${totalEntregues}</p>
        <p><strong>Receita dos Pedidos Entregues:</strong> ${formatarMoeda(receitaEntregues)}</p>
        <p><strong>Pedidos Cancelados Hoje:</strong> ${totalCancelados}</p>
        <hr style="margin: 1rem 0;">
        <p><strong>Lista de Pedidos Entregues Hoje:</strong></p>
        <ul>
            ${entreguesHoje.map(p => `<li>#${p.id} - Cliente: ${p.clienteWhatsappPedido?.split('@')[0] || 'N/I'} - Valor: ${formatarMoeda(p.valorTotalPedido)}</li>`).join('') || '<li>Nenhum</li>'}
        </ul>
         <p><strong>Lista de Pedidos Cancelados Hoje:</strong></p>
        <ul>
            ${canceladosHoje.map(p => `<li>#${p.id} - Cliente: ${p.clienteWhatsappPedido?.split('@')[0] || 'N/I'}</li>`).join('') || '<li>Nenhum</li>'}
        </ul>
    `;
    relatorioContainer.style.display = 'block';
}

function conectarSocket() {
     if (socket && socket.connected) return;

     socket = io(SOCKET_SERVER_URL);

     socket.on('connect', () => console.log('Conectado ao Socket.IO:', socket.id));
     socket.on('disconnect', () => console.log('Desconectado do Socket.IO'));
     socket.on('connect_error', (err) => console.error('Erro conexão Socket.IO:', err));

     socket.on('novoPedido', (novoPedido) => {
        console.log('WS: Novo pedido:', novoPedido);
        pedidosCache = [novoPedido, ...pedidosCache.filter(p => p.id !== novoPedido.id)];
        salvarPedidosLocalStorage(pedidosCache);
        renderizarPedidos(pedidosCache);
     });

     socket.on('statusPedidoAtualizado', (pedidoAtualizado) => {
        console.log('WS: Status atualizado:', pedidoAtualizado);
        const index = pedidosCache.findIndex(p => p.id === pedidoAtualizado.id);
        if (index !== -1) {
            pedidosCache[index] = pedidoAtualizado;
        } else {
            pedidosCache.unshift(pedidoAtualizado);
        }
         salvarPedidosLocalStorage(pedidosCache);
         renderizarPedidos(pedidosCache);
     });
}

document.addEventListener('DOMContentLoaded', () => {
    pedidosCache = carregarPedidosLocalStorage();
    renderizarPedidos(pedidosCache);
    buscarPedidosIniciais();
    conectarSocket();

    const mainContent = document.getElementById('main-content');
    mainContent.addEventListener('click', (event) => {
        if (event.target.tagName === 'BUTTON' && event.target.dataset.id && event.target.dataset.status) {
            const id = event.target.dataset.id;
            const status = event.target.dataset.status;
            event.target.closest('.pedido-card').querySelectorAll('.status-actions button').forEach(btn => btn.disabled = true);
            atualizarStatusPedido(id, status);
        }
    });

     btnRelatorio.addEventListener('click', () => {
        if (relatorioContainer.style.display === 'block') {
            relatorioContainer.style.display = 'none';
            btnRelatorio.textContent = 'Relatório do Dia';
        } else {
            gerarRelatorioDia();
            btnRelatorio.textContent = 'Esconder Relatório';
        }
     });
});
