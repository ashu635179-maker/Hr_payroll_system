import { Router, type IRouter } from "express";
import { db, employeesTable, departmentsTable, activityTable } from "@workspace/db";
import { eq, ilike, and, or, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/session";
import {
  CreateEmployeeBody,
  UpdateEmployeeBody,
  GetEmployeeParams,
  UpdateEmployeeParams,
  DeleteEmployeeParams,
  UploadEmployeePhotoParams,
  UploadEmployeePhotoBody,
  ListEmployeesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/employees", authMiddleware, async (req, res): Promise<void> => {
  const query = ListEmployeesQueryParams.safeParse(req.query);

  let conditions: ReturnType<typeof and>[] = [];
  if (query.success) {
    if (query.data.search) {
      const s = `%${query.data.search}%`;
      conditions.push(
        or(
          ilike(employeesTable.firstName, s),
          ilike(employeesTable.lastName, s),
          ilike(employeesTable.email, s),
          ilike(employeesTable.position, s)
        ) as ReturnType<typeof and>
      );
    }
    if (query.data.departmentId) {
      conditions.push(eq(employeesTable.departmentId, query.data.departmentId));
    }
    if (query.data.status) {
      conditions.push(eq(employeesTable.status, query.data.status));
    }
  }

  const employees = await db
    .select({
      id: employeesTable.id,
      firstName: employeesTable.firstName,
      lastName: employeesTable.lastName,
      email: employeesTable.email,
      phone: employeesTable.phone,
      position: employeesTable.position,
      departmentId: employeesTable.departmentId,
      departmentName: departmentsTable.name,
      hireDate: employeesTable.hireDate,
      salary: employeesTable.salary,
      status: employeesTable.status,
      photoUrl: employeesTable.photoUrl,
      address: employeesTable.address,
      createdAt: employeesTable.createdAt,
    })
    .from(employeesTable)
    .leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(employeesTable.createdAt);

  const result = employees.map(e => ({
    ...e,
    salary: parseFloat(e.salary as string),
    hireDate: e.hireDate,
    createdAt: (e.createdAt as Date).toISOString(),
    status: e.status as "active" | "inactive",
  }));

  res.json(result);
});

router.post("/employees", authMiddleware, async (req, res): Promise<void> => {
  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [emp] = await db.insert(employeesTable).values({
    ...parsed.data,
    salary: String(parsed.data.salary),
  }).returning();

  await db.insert(activityTable).values({
    type: "employee_created",
    description: `New employee ${parsed.data.firstName} ${parsed.data.lastName} added as ${parsed.data.position}`,
    actor: req.username,
  });

  const [dept] = parsed.data.departmentId
    ? await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, parsed.data.departmentId))
    : [{ name: null }];

  res.status(201).json({
    ...emp,
    salary: parseFloat(emp.salary as string),
    hireDate: emp.hireDate,
    createdAt: (emp.createdAt as Date).toISOString(),
    status: emp.status as "active" | "inactive",
    departmentName: dept?.name ?? null,
  });
});

router.get("/employees/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetEmployeeParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [emp] = await db
    .select({
      id: employeesTable.id,
      firstName: employeesTable.firstName,
      lastName: employeesTable.lastName,
      email: employeesTable.email,
      phone: employeesTable.phone,
      position: employeesTable.position,
      departmentId: employeesTable.departmentId,
      departmentName: departmentsTable.name,
      hireDate: employeesTable.hireDate,
      salary: employeesTable.salary,
      status: employeesTable.status,
      photoUrl: employeesTable.photoUrl,
      address: employeesTable.address,
      createdAt: employeesTable.createdAt,
    })
    .from(employeesTable)
    .leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id))
    .where(eq(employeesTable.id, params.data.id));

  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  res.json({
    ...emp,
    salary: parseFloat(emp.salary as string),
    hireDate: emp.hireDate,
    createdAt: (emp.createdAt as Date).toISOString(),
    status: emp.status as "active" | "inactive",
  });
});

router.put("/employees/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateEmployeeParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.salary !== undefined) {
    updateData.salary = String(parsed.data.salary);
  }

  const [emp] = await db
    .update(employeesTable)
    .set(updateData)
    .where(eq(employeesTable.id, params.data.id))
    .returning();

  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  await db.insert(activityTable).values({
    type: "employee_updated",
    description: `Employee ${emp.firstName} ${emp.lastName} record updated`,
    actor: req.username,
  });

  const [dept] = emp.departmentId
    ? await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, emp.departmentId))
    : [{ name: null }];

  res.json({
    ...emp,
    salary: parseFloat(emp.salary as string),
    hireDate: emp.hireDate,
    createdAt: (emp.createdAt as Date).toISOString(),
    status: emp.status as "active" | "inactive",
    departmentName: dept?.name ?? null,
  });
});

router.delete("/employees/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteEmployeeParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [emp] = await db
    .delete(employeesTable)
    .where(eq(employeesTable.id, params.data.id))
    .returning();

  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  await db.insert(activityTable).values({
    type: "employee_deleted",
    description: `Employee ${emp.firstName} ${emp.lastName} removed from system`,
    actor: req.username,
  });

  res.json({ message: "Employee deleted successfully" });
});

router.post("/employees/:id/upload-photo", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UploadEmployeePhotoParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UploadEmployeePhotoBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [emp] = await db
    .update(employeesTable)
    .set({ photoUrl: body.data.photoUrl })
    .where(eq(employeesTable.id, params.data.id))
    .returning();

  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  const [dept] = emp.departmentId
    ? await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, emp.departmentId))
    : [{ name: null }];

  res.json({
    ...emp,
    salary: parseFloat(emp.salary as string),
    hireDate: emp.hireDate,
    createdAt: (emp.createdAt as Date).toISOString(),
    status: emp.status as "active" | "inactive",
    departmentName: dept?.name ?? null,
  });
});

export default router;
