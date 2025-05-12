const CARDAPIO = {
  pizzas: [
    {
      id: "p001",
      nome: "Calabresa",
      categoria: "Pizzas Tradicionais",
      tamanhos: {
        pequena: { descricao: "Pequena (4 fatias)", preco: 25.9 },
        media: { descricao: "Média (6 fatias)", preco: 35.9 },
        grande: { descricao: "Grande (8 fatias)", preco: 45.9 },
      },
    },
    {
      id: "p002",
      nome: "Frango com Catupiry",
      categoria: "Pizzas Tradicionais",
      tamanhos: {
        pequena: { descricao: "Pequena (4 fatias)", preco: 28.5 },
        media: { descricao: "Média (6 fatias)", preco: 38.5 },
        grande: { descricao: "Grande (8 fatias)", preco: 48.5 },
      },
    },
    {
      id: "p003",
      nome: "Margherita",
      categoria: "Pizzas Tradicionais",
      tamanhos: {
        pequena: { descricao: "Pequena (4 fatias)", preco: 22.0 },
        media: { descricao: "Média (6 fatias)", preco: 32.0 },
        grande: { descricao: "Grande (8 fatias)", preco: 42.0 },
      },
    },
    {
      id: "p004",
      nome: "Portuguesa",
      categoria: "Pizzas Especiais",
      tamanhos: {
        pequena: { descricao: "Pequena (4 fatias)", preco: 27.5 },
        media: { descricao: "Média (6 fatias)", preco: 37.5 },
        grande: { descricao: "Grande (8 fatias)", preco: 47.5 },
      },
    },
  ],
  bebidas: [
    {
      id: "b001",
      nome: "Refrigerante Lata 350ml",
      opcoes: ["Coca-Cola", "Guaraná Antarctica", "Fanta Laranja", "Sprite"],
      preco: 5.5,
    },
    {
      id: "b002",
      nome: "Refrigerante 2L",
      opcoes: ["Coca-Cola", "Guaraná Antarctica", "Fanta Laranja", "Sprite"],
      preco: 12.0,
    },
    {
      id: "b003",
      nome: "Água Mineral 500ml",
      opcoes: ["Sem gás", "Com gás"],
      preco: 3.5,
    },
    {
      id: "b004",
      nome: "Suco Natural Laranja 500ml",
      opcoes: ["Com açúcar", "Sem açúcar"],
      preco: 8.0,
    },
  ],
  ofertas: [
    {
      id: "o001",
      nome: "Combo Família",
      descricao:
        "1 Pizza Grande (Calabresa ou Frango c/ Catupiry) + 1 Refrigerante 2L",
      preco: 55.0,
    },
  ],
};

module.exports = CARDAPIO;