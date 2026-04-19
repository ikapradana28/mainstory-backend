const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

function auth(req, res, next) {
  const userId = req.headers["x-user-id"];

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.userId = userId;
  next();
}

// Mock login
app.post("/auth/login", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "Login successful",
      user,
      token: user.id,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

// List books
app.get("/books", auth, async (req, res) => {
  try {
    const books = await prisma.book.findMany({
      where: {
        status: "PUBLISHED",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        userId: req.userId,
        status: "ACTIVE",
        endAt: { gt: new Date() },
      },
    });

    const purchases = await prisma.purchase.findMany({
      where: {
        userId: req.userId,
      },
      select: {
        bookId: true,
      },
    });

    const purchasedBookIds = new Set(purchases.map((p) => p.bookId));

    const result = books.map((book) => {
      const isAccessible =
        Boolean(activeSubscription) || purchasedBookIds.has(book.id);

      let accessType = "LOCKED";
      if (activeSubscription) accessType = "SUBSCRIPTION";
      else if (purchasedBookIds.has(book.id)) accessType = "PURCHASED";

      return {
        id: book.id,
        title: book.title,
        description: book.description,
        price: book.price,
        status: book.status,
        isAccessible,
        accessType,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
      };
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Book detail
app.get("/books/:id", auth, async (req, res) => {
  try {
    const book = await prisma.book.findUnique({
      where: { id: req.params.id },
    });

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        userId: req.userId,
        status: "ACTIVE",
        endAt: { gt: new Date() },
      },
    });

    const purchase = await prisma.purchase.findFirst({
      where: {
        userId: req.userId,
        bookId: book.id,
      },
    });

    const isAccessible = Boolean(activeSubscription) || Boolean(purchase);

    let accessType = "LOCKED";
    if (activeSubscription) accessType = "SUBSCRIPTION";
    else if (purchase) accessType = "PURCHASED";

    return res.json({
      id: book.id,
      title: book.title,
      description: book.description,
      content: book.content,
      price: book.price,
      status: book.status,
      isAccessible,
      accessType,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Read full book content
app.get("/books/:id/read", auth, async (req, res) => {
  try {
    const book = await prisma.book.findUnique({
      where: { id: req.params.id },
    });

    if (!book || book.status !== "PUBLISHED") {
      return res.status(404).json({ message: "Book not found" });
    }

    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        userId: req.userId,
        status: "ACTIVE",
        endAt: { gt: new Date() },
      },
    });

    const purchase = await prisma.purchase.findFirst({
      where: {
        userId: req.userId,
        bookId: book.id,
      },
    });

    const hasAccess = Boolean(activeSubscription) || Boolean(purchase);

    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    return res.json({
      id: book.id,
      title: book.title,
      content: book.content,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Create book
app.post("/books", auth, async (req, res) => {
  try {
    const { title, description, content, price, status } = req.body;

    if (!title || !description || !content) {
      return res.status(400).json({
        message: "title, description, and content are required",
      });
    }

    if (price == null || Number(price) < 0) {
      return res.status(400).json({
        message: "price must be a non-negative number",
      });
    }

    const book = await prisma.book.create({
      data: {
        title,
        description,
        content,
        price: Number(price),
        status: status || "PUBLISHED",
      },
    });

    return res.status(201).json(book);
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Update book
app.put("/books/:id", auth, async (req, res) => {
  try {
    const existingBook = await prisma.book.findUnique({
      where: { id: req.params.id },
    });

    if (!existingBook) {
      return res.status(404).json({ message: "Book not found" });
    }

    const { title, description, content, price, status } = req.body;

    const updatedBook = await prisma.book.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(price !== undefined ? { price: Number(price) } : {}),
        ...(status !== undefined ? { status } : {}),
      },
    });

    return res.json(updatedBook);
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Delete book
app.delete("/books/:id", auth, async (req, res) => {
  try {
    const existingBook = await prisma.book.findUnique({
      where: { id: req.params.id },
    });

    if (!existingBook) {
      return res.status(404).json({ message: "Book not found" });
    }

    await prisma.book.delete({
      where: { id: req.params.id },
    });

    return res.json({ message: "Book deleted successfully" });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Mock subscription purchase
app.post("/subscriptions/subscribe", auth, async (req, res) => {
  try {
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId: req.userId,
        status: "ACTIVE",
        endAt: { gt: new Date() },
      },
    });

    if (existingSubscription) {
      return res.status(400).json({
        message: "User already has an active subscription",
      });
    }

    const startAt = new Date();
    const endAt = new Date();
    endAt.setDate(endAt.getDate() + 30);

    const subscription = await prisma.subscription.create({
      data: {
        userId: req.userId,
        status: "ACTIVE",
        startAt,
        endAt,
      },
    });

    return res.status(201).json({
      message: "Subscription activated",
      subscription,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

// View current subscription
app.get("/subscriptions/me", auth, async (req, res) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: req.userId,
        status: "ACTIVE",
        endAt: { gt: new Date() },
      },
    });

    return res.json({ subscription: subscription || null });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Mock one-time purchase
app.post("/purchases/books/:bookId", auth, async (req, res) => {
  try {
    const book = await prisma.book.findUnique({
      where: { id: req.params.bookId },
    });

    if (!book || book.status !== "PUBLISHED") {
      return res.status(404).json({ message: "Book not found" });
    }

    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        userId: req.userId,
        bookId: book.id,
      },
    });

    if (existingPurchase) {
      return res.status(400).json({ message: "Book already purchased" });
    }

    const purchase = await prisma.purchase.create({
      data: {
        userId: req.userId,
        bookId: book.id,
        amount: book.price,
      },
    });

    return res.status(201).json({
      message: "Book purchased successfully",
      purchase,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

// View my purchases
app.get("/purchases/me", auth, async (req, res) => {
  try {
    const purchases = await prisma.purchase.findMany({
      where: { userId: req.userId },
      include: { book: true },
      orderBy: { purchasedAt: "desc" },
    });

    return res.json(purchases);
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Health check
app.get("/health", (_req, res) => {
  return res.json({ message: "OK" });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});