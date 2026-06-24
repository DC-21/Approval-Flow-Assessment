import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.middleware";
import { authenticate } from "../middleware/auth.middleware";
import * as authController from "../controllers/auth.controller";
import { RequestHandler } from "express";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", validate(loginSchema), authController.login);
router.post("/logout", authController.logout as unknown as RequestHandler);
router.get("/me", authenticate as unknown as RequestHandler, authController.me as unknown as RequestHandler);

export default router;
