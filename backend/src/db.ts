import { PrismaClient } from "./generated/prisma/client";

const db = new PrismaClient();

export default db;
