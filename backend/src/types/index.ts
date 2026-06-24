import { Request } from "express";
import { Role } from "../generated/prisma/client";

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
