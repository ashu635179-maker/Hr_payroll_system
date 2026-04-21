import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import employeesRouter from "./employees";
import departmentsRouter from "./departments";
import payrollRouter from "./payroll";
import leavesRouter from "./leaves";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(employeesRouter);
router.use(departmentsRouter);
router.use(payrollRouter);
router.use(leavesRouter);
router.use(dashboardRouter);

export default router;
