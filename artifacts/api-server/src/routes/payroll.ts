import { Router, type IRouter } from "express";
import { db, payrollTable, employeesTable, activityTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/session";
import {
  CreatePayrollBody,
  UpdatePayrollParams,
  UpdatePayrollBody,
  DeletePayrollParams,
  ListPayrollQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/payroll", authMiddleware, async (req, res): Promise<void> => {
  const query = ListPayrollQueryParams.safeParse(req.query);

  let conditions: ReturnType<typeof and>[] = [];
  if (query.success) {
    if (query.data.employeeId) conditions.push(eq(payrollTable.employeeId, query.data.employeeId));
    if (query.data.month) conditions.push(eq(payrollTable.month, query.data.month));
    if (query.data.year) conditions.push(eq(payrollTable.year, query.data.year));
  }

  const records = await db
    .select({
      id: payrollTable.id,
      employeeId: payrollTable.employeeId,
      employeeName: sql<string>`concat(${employeesTable.firstName}, ' ', ${employeesTable.lastName})`,
      month: payrollTable.month,
      year: payrollTable.year,
      basicSalary: payrollTable.basicSalary,
      bonuses: payrollTable.bonuses,
      deductions: payrollTable.deductions,
      netSalary: payrollTable.netSalary,
      status: payrollTable.status,
      processedAt: payrollTable.processedAt,
      createdAt: payrollTable.createdAt,
    })
    .from(payrollTable)
    .leftJoin(employeesTable, eq(payrollTable.employeeId, employeesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(payrollTable.year, payrollTable.month);

  res.json(records.map(r => ({
    ...r,
    basicSalary: parseFloat(r.basicSalary as string),
    bonuses: parseFloat(r.bonuses as string),
    deductions: parseFloat(r.deductions as string),
    netSalary: parseFloat(r.netSalary as string),
    processedAt: r.processedAt ? (r.processedAt as Date).toISOString() : null,
    createdAt: (r.createdAt as Date).toISOString(),
    status: r.status as "pending" | "processed" | "paid",
  })));
});

router.post("/payroll", authMiddleware, async (req, res): Promise<void> => {
  const parsed = CreatePayrollBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const netSalary = parsed.data.basicSalary + parsed.data.bonuses - parsed.data.deductions;

  const [record] = await db.insert(payrollTable).values({
    ...parsed.data,
    basicSalary: String(parsed.data.basicSalary),
    bonuses: String(parsed.data.bonuses),
    deductions: String(parsed.data.deductions),
    netSalary: String(netSalary),
    processedAt: parsed.data.status === "processed" || parsed.data.status === "paid" ? new Date() : null,
  }).returning();

  await db.insert(activityTable).values({
    type: "payroll_created",
    description: `Payroll record created for month ${parsed.data.month}/${parsed.data.year}`,
    actor: req.username,
  });

  res.status(201).json({
    ...record,
    basicSalary: parseFloat(record.basicSalary as string),
    bonuses: parseFloat(record.bonuses as string),
    deductions: parseFloat(record.deductions as string),
    netSalary: parseFloat(record.netSalary as string),
    processedAt: record.processedAt ? (record.processedAt as Date).toISOString() : null,
    createdAt: (record.createdAt as Date).toISOString(),
    status: record.status as "pending" | "processed" | "paid",
    employeeName: null,
  });
});

router.put("/payroll/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdatePayrollParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePayrollBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.basicSalary !== undefined) updateData.basicSalary = String(parsed.data.basicSalary);
  if (parsed.data.bonuses !== undefined) updateData.bonuses = String(parsed.data.bonuses);
  if (parsed.data.deductions !== undefined) updateData.deductions = String(parsed.data.deductions);

  if (parsed.data.basicSalary !== undefined || parsed.data.bonuses !== undefined || parsed.data.deductions !== undefined) {
    const [existing] = await db.select().from(payrollTable).where(eq(payrollTable.id, params.data.id));
    if (existing) {
      const basic = parsed.data.basicSalary ?? parseFloat(existing.basicSalary as string);
      const bonuses = parsed.data.bonuses ?? parseFloat(existing.bonuses as string);
      const deductions = parsed.data.deductions ?? parseFloat(existing.deductions as string);
      updateData.netSalary = String(basic + bonuses - deductions);
    }
  }

  if ((parsed.data.status === "processed" || parsed.data.status === "paid")) {
    updateData.processedAt = new Date();
  }

  const [record] = await db
    .update(payrollTable)
    .set(updateData)
    .where(eq(payrollTable.id, params.data.id))
    .returning();

  if (!record) {
    res.status(404).json({ error: "Payroll record not found" });
    return;
  }

  res.json({
    ...record,
    basicSalary: parseFloat(record.basicSalary as string),
    bonuses: parseFloat(record.bonuses as string),
    deductions: parseFloat(record.deductions as string),
    netSalary: parseFloat(record.netSalary as string),
    processedAt: record.processedAt ? (record.processedAt as Date).toISOString() : null,
    createdAt: (record.createdAt as Date).toISOString(),
    status: record.status as "pending" | "processed" | "paid",
    employeeName: null,
  });
});

router.delete("/payroll/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeletePayrollParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [record] = await db
    .delete(payrollTable)
    .where(eq(payrollTable.id, params.data.id))
    .returning();

  if (!record) {
    res.status(404).json({ error: "Payroll record not found" });
    return;
  }

  res.json({ message: "Payroll record deleted" });
});

export default router;
