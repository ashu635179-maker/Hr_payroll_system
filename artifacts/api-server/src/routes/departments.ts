import { Router, type IRouter } from "express";
import { db, departmentsTable, employeesTable, activityTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/session";
import {
  CreateDepartmentBody,
  UpdateDepartmentParams,
  UpdateDepartmentBody,
  DeleteDepartmentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/departments", authMiddleware, async (req, res): Promise<void> => {
  const depts = await db
    .select({
      id: departmentsTable.id,
      name: departmentsTable.name,
      description: departmentsTable.description,
      managerId: departmentsTable.managerId,
      createdAt: departmentsTable.createdAt,
      employeeCount: sql<number>`(select count(*) from employees where department_id = ${departmentsTable.id})`,
    })
    .from(departmentsTable)
    .orderBy(departmentsTable.name);

  res.json(depts.map(d => ({
    ...d,
    createdAt: (d.createdAt as Date).toISOString(),
    employeeCount: Number(d.employeeCount),
  })));
});

router.post("/departments", authMiddleware, async (req, res): Promise<void> => {
  const parsed = CreateDepartmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [dept] = await db.insert(departmentsTable).values(parsed.data).returning();

  await db.insert(activityTable).values({
    type: "department_created",
    description: `Department "${parsed.data.name}" created`,
    actor: req.username,
  });

  res.status(201).json({
    ...dept,
    createdAt: (dept.createdAt as Date).toISOString(),
    employeeCount: 0,
  });
});

router.put("/departments/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateDepartmentParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDepartmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [dept] = await db
    .update(departmentsTable)
    .set(parsed.data)
    .where(eq(departmentsTable.id, params.data.id))
    .returning();

  if (!dept) {
    res.status(404).json({ error: "Department not found" });
    return;
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(employeesTable)
    .where(eq(employeesTable.departmentId, dept.id));

  res.json({
    ...dept,
    createdAt: (dept.createdAt as Date).toISOString(),
    employeeCount: Number(count),
  });
});

router.delete("/departments/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteDepartmentParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [dept] = await db
    .delete(departmentsTable)
    .where(eq(departmentsTable.id, params.data.id))
    .returning();

  if (!dept) {
    res.status(404).json({ error: "Department not found" });
    return;
  }

  await db.insert(activityTable).values({
    type: "department_deleted",
    description: `Department "${dept.name}" removed`,
    actor: req.username,
  });

  res.json({ message: "Department deleted successfully" });
});

export default router;
