import { Router, RequestHandler } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.middleware";
import { authenticate } from "../middleware/auth.middleware";
import * as applicationController from "../controllers/application.controller";

const router = Router();

const applicationSchema = z.object({
  title: z.string().min(1, "Title is required"),
  category: z.enum(["BUDGET_REQUEST", "LEAVE_REQUEST", "EQUIPMENT_REQUEST", "OTHER"]),
  description: z.string().min(1, "Description is required"),
  amount: z.number().positive().optional(),
});

const transitionSchema = z.object({
  action: z.enum(["submit", "start_review", "approve", "reject", "return_for_changes"]),
  comment: z.string().optional(),
});

const auth = authenticate as unknown as RequestHandler;
const ctrl = applicationController as unknown as Record<string, RequestHandler>;

router.use(auth);

router.get("/", ctrl.list);
router.post("/", validate(applicationSchema), ctrl.create);
router.get("/:id", ctrl.getOne);
router.put("/:id", validate(applicationSchema), ctrl.update);
router.delete("/:id", ctrl.remove);
router.post("/:id/transitions", validate(transitionSchema), ctrl.performTransition);

export default router;
