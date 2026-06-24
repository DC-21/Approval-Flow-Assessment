import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { AuthenticatedRequest } from "../types";

const COOKIE_NAME = "token";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body.email, req.body.password);
  if (!result) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  res.cookie(COOKIE_NAME, result.token, COOKIE_OPTS);
  res.json({ user: result.user });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production" });
  res.json({ ok: true });
}

export async function me(req: AuthenticatedRequest, res: Response) {
  const user = await authService.getMe(req.user.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
}
