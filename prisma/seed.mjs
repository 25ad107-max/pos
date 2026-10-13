import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const materials = [
  ["River Sand", "Load", false],
  ["M-Sand", "Load", false],
  ["P-Sand", "Load", false],
  ["Jelly", "Load", false],
  ["Savudu", "Load", false],
  ["Rubble/Debris", "Load", false],
  ["Road Milling Material", "Load", false],
  ["Building Demolition", "Job", true],
  ["Land Filling", "Job", true],
  ["Land Cleaning", "Job", true],
  ["Other Transport Services", "Trip", true],
];

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Maruthi Admin";
  if (!email || !password || password.length < 12) {
    throw new Error("Set ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 12 characters before seeding.");
  }

  const existingAdmin = await prisma.user.findUnique({ where: { email } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await bcrypt.hash(password, 12),
        role: "SUPER_ADMIN",
      },
    });
    console.log(`Created the initial administrator account for ${email}.`);
  } else {
    console.log(`Administrator ${email} already exists; existing credentials and role were not changed.`);
  }

  for (const [materialName, unit, isService] of materials) {
    await prisma.material.upsert({
      where: { name: materialName },
      update: {},
      create: {
        name: materialName,
        unit,
        isService,
        rate: 0,
      },
    });
  }
  console.log(`Seeded ${materials.length} materials and services with editable zero rates.`);
}

main()
  .catch((error) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
