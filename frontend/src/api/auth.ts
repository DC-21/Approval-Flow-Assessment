import api from "./client";
import type { User } from "../types";

export async function login(email: string, password: string) {
  const { data } = await api.post<{ user: User }>("/auth/login", { email, password });
  return data.user;
}

export async function logout() {
  await api.post("/auth/logout");
}

export async function getMe() {
  const { data } = await api.get<User>("/auth/me");
  return data;
}
