import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../db";
import { JwtPayload } from "../types";

export async function login(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return null;
  }

  const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role };
  const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "7d" });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

export async function getMe(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
}
