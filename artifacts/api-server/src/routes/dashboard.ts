import { Router, type IRouter } from "express";
import { db, employeesTable, departmentsTable, payrollTable, leavesTable, activityTable } from "@workspace/db";
import { eq, sql, gte, and } from "drizzle-orm";
import { authMiddleware } from "../middlewares/session";

const router: IRouter = Router();

router.get("/dashboard/summary", authMiddleware, async (req, res): Promise<void> => {
  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const thisYear = now.getFullYear();
  const monthStart = new Date(thisYear, now.getMonth(), 1);

  const [totalEmployees] = await db.select({ count: sql<number>`count(*)` }).from(employeesTable);
  const [activeEmployees] = await db.select({ count: sql<number>`count(*)` }).from(employeesTable).where(eq(employeesTable.status, "active"));
  const [totalDepts] = await db.select({ count: sql<number>`count(*)` }).from(departmentsTable);
  const [payrollSum] = await db.select({ total: sql<number>`coalesce(sum(net_salary), 0)` }).from(payrollTable).where(and(eq(payrollTable.month, thisMonth), eq(payrollTable.year, thisYear)));
  const [pendingLeaves] = await db.select({ count: sql<number>`count(*)` }).from(leavesTable).where(eq(leavesTable.status, "pending"));
  const [newHires] = await db.select({ count: sql<number>`count(*)` }).from(employeesTable).where(gte(employeesTable.createdAt, monthStart));

  res.json({
    totalEmployees: Number(totalEmployees.count),
    activeEmployees: Number(activeEmployees.count),
    totalDepartments: Number(totalDepts.count),
    totalPayrollThisMonth: parseFloat(String(payrollSum.total)),
    pendingLeaves: Number(pendingLeaves.count),
    newHiresThisMonth: Number(newHires.count),
  });
});

router.get("/dashboard/payroll-by-department", authMiddleware, async (req, res): Promise<void> => {
  const result = await db
    .select({
      departmentName: departmentsTable.name,
      totalSalary: sql<number>`coalesce(sum(${employeesTable.salary}), 0)`,
      employeeCount: sql<number>`count(${employeesTable.id})`,
    })
    .from(departmentsTable)
    .leftJoin(employeesTable, and(eq(employeesTable.departmentId, departmentsTable.id), eq(employeesTable.status, "active")))
    .groupBy(departmentsTable.id, departmentsTable.name)
    .orderBy(departmentsTable.name);

  res.json(result.map(r => ({
    departmentName: r.departmentName,
    totalSalary: parseFloat(String(r.totalSalary)),
    employeeCount: Number(r.employeeCount),
  })));
});

router.get("/dashboard/recent-activity", authMiddleware, async (req, res): Promise<void> => {
  const activities = await db
    .select()
    .from(activityTable)
    .orderBy(sql`${activityTable.timestamp} desc`)
    .limit(20);

  res.json(activities.map(a => ({
    id: a.id,
    type: a.type,
    description: a.description,
    timestamp: (a.timestamp as Date).toISOString(),
    actor: a.actor,
  })));
});

export default router;
