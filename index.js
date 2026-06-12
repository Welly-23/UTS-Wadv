// Nama: Willy Alfalfa Suwarno
// NIM: 24110400021

require("dotenv/config");

const express = require("express");
const { PrismaClient } = require("@prisma/client");

const app = express();

const prisma = new PrismaClient();

const PORT = 3000;

app.use(express.json());

// GET /wallets
app.get("/wallets", async (req, res) => {
  const wallets = await prisma.wallet.findMany({
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json(wallets);
});

// POST /wallets
app.post("/wallets", async (req, res) => {
  const { name, currency } = req.body;

  if (!name) {
    return res.status(400).json({ error: "name wajib diisi" });
  }

  const wallet = await prisma.wallet.create({
    data: {
      name,
      currency: currency || "IDR",
    },
  });

  res.status(201).json(wallet);
});

// DELETE /wallets/:id
app.delete("/wallets/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  const wallet = await prisma.wallet.findUnique({
    where: { id },
  });

  if (!wallet) {
    return res.status(404).json({ error: "Wallet tidak ditemukan" });
  }

  await prisma.transaction.deleteMany({
    where: { walletId: id },
  });

  await prisma.wallet.delete({
    where: { id },
  });

  res.status(204).send();
});

// GET /wallets/:id/transactions
app.get("/wallets/:id/transactions", async (req, res) => {
  const id = parseInt(req.params.id);

  const wallet = await prisma.wallet.findUnique({
    where: { id },
  });

  if (!wallet) {
    return res.status(404).json({ error: "Wallet tidak ditemukan" });
  }

  const transactions = await prisma.transaction.findMany({
    where: { walletId: id },
    orderBy: { date: "desc" },
  });

  res.status(200).json(transactions);
});

// POST /wallets/:id/transactions
app.post("/wallets/:id/transactions", async (req, res) => {
  const walletId = parseInt(req.params.id);
  const { amount, type, category, date, note } = req.body;

  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
  });

  if (!wallet) {
    return res.status(404).json({ error: "Wallet tidak ditemukan" });
  }

  if (!amount || !type || !category || !date) {
    return res.status(400).json({
      error: "amount, type, category, dan date wajib diisi",
    });
  }

  if (type !== "income" && type !== "expense") {
    return res.status(400).json({
      error: 'type harus "income" atau "expense"',
    });
  }

  if (amount <= 0) {
    return res.status(400).json({
      error: "amount harus lebih dari 0",
    });
  }

  const transaction = await prisma.transaction.create({
    data: {
      amount,
      type,
      category,
      note: note || null,
      date: new Date(date),
      walletId,
    },
  });

  res.status(201).json(transaction);
});

// DELETE /transactions/:id
app.delete("/transactions/:id", async (req, res) => {
  const id = parseInt(req.params.id);

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      wallet: {
        select: { name: true },
      },
    },
  });

  if (!transaction) {
    return res.status(404).json({ error: "Transaksi tidak ditemukan" });
  }

  await prisma.transaction.delete({
    where: { id },
  });

  // Bonus: response 200 berisi data yang dihapus
  res.status(200).json({
    deleted: transaction,
  });
});

// GET /wallets/:id/balance
app.get("/wallets/:id/balance", async (req, res) => {
  const id = parseInt(req.params.id);

  const wallet = await prisma.wallet.findUnique({
    where: { id },
    include: { transactions: true },
  });

  if (!wallet) {
    return res.status(404).json({ error: "Wallet tidak ditemukan" });
  }

  let totalIncome = 0;
  let totalExpense = 0;

  wallet.transactions.forEach((trx) => {
    if (trx.type === "income") {
      totalIncome += trx.amount;
    } else if (trx.type === "expense") {
      totalExpense += trx.amount;
    }
  });

  res.status(200).json({
    walletId: wallet.id,
    walletName: wallet.name,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
  });
});

// GET /wallets/:id/summary
app.get("/wallets/:id/summary", async (req, res) => {
  const id = parseInt(req.params.id);

  const wallet = await prisma.wallet.findUnique({
    where: { id },
    include: { transactions: true },
  });

  if (!wallet) {
    return res.status(404).json({ error: "Wallet tidak ditemukan" });
  }

  const groups = {};

  wallet.transactions.forEach((trx) => {
    if (!groups[trx.category]) {
      groups[trx.category] = {
        category: trx.category,
        count: 0,
        totalAmount: 0,
        types: {
          income: 0,
          expense: 0,
        },
      };
    }

    groups[trx.category].count++;
    groups[trx.category].totalAmount += trx.amount;

    if (trx.type === "income") {
      groups[trx.category].types.income++;
    } else if (trx.type === "expense") {
      groups[trx.category].types.expense++;
    }
  });

  const summary = Object.values(groups).map((item) => ({
    category: item.category,
    count: item.count,
    totalAmount: item.totalAmount,
    avgAmount: Number((item.totalAmount / item.count).toFixed(2)),
    types: item.types,
  }));

  res.status(200).json({
    walletId: wallet.id,
    walletName: wallet.name,
    summary,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});