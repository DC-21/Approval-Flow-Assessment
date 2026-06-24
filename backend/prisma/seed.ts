import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const USERS = [
  {
    email: "alice@test.com",
    name: "Alice Nguyen",
    password: "applicant-alice-9f2k",
    role: "APPLICANT" as const,
  },
  {
    email: "bob@test.com",
    name: "Bob Okafor",
    password: "applicant-bob-7m3p",
    role: "APPLICANT" as const,
  },
  {
    email: "reviewer@test.com",
    name: "Carol Reviewer",
    password: "reviewer-carol-4x8w",
    role: "REVIEWER" as const,
  },
];

async function main() {
  for (const u of USERS) {
    const hashed = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, password: hashed, role: u.role },
    });
  }

  console.log("Seeded users:");
  for (const u of USERS) {
    console.log(`  ${u.role.padEnd(10)} ${u.email.padEnd(25)} ${u.password}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
