const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.purchase.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.book.deleteMany();
  await prisma.user.deleteMany();

  const user1 = await prisma.user.create({
    data: { name: "Ika", email: "ika@test.com" },
  });

  const user2 = await prisma.user.create({
    data: { name: "Budi", email: "budi@test.com" },
  });

  const book1 = await prisma.book.create({
    data: {
      title: "Cerita Kelinci",
      description: "Tentang kelinci kecil yang mencari teman baru.",
      content: "Pada suatu pagi, Kiko si kelinci berjalan ke hutan kecil...",
      price: 20000,
      status: "PUBLISHED",
    },
  });

  const book2 = await prisma.book.create({
    data: {
      title: "Cerita Bulan",
      description: "Cerita pengantar tidur tentang bulan dan bintang.",
      content: "Malam itu, Nara melihat bulan besar di atas rumah...",
      price: 25000,
      status: "PUBLISHED",
    },
  });

  await prisma.book.create({
    data: {
      title: "Draft Buku Admin",
      description: "Ini buku draft.",
      content: "Belum dipublikasikan.",
      price: 15000,
      status: "DRAFT",
    },
  });

  console.log("Seed berhasil");
  console.log({
    user1Id: user1.id,
    user2Id: user2.id,
    book1Id: book1.id,
    book2Id: book2.id,
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });