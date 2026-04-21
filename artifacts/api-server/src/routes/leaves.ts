import { Router, type IRouter } from "express";
import { db, leavesTable, employeesTable, activityTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/session";
import {
  CreateLeaveBody,
  UpdateLeaveParams,
  UpdateLeaveBody,
  DeleteLeaveParams,
  ListLeavesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/leaves", authMiddleware, async (req, res): Promise<void> => {
  const query = ListLeavesQueryParams.safeParse(req.query);

  let conditions: ReturnType<typeof and>[] = [];
  if (query.success) {
    if (query.data.employeeId) conditions.push(eq(leavesTable.employeeId, query.data.employeeId));
    if (query.data.status) conditions.push(eq(leavesTable.status, query.data.status));
  }

  const records = await db
    .select({
      id: leavesTable.id,
      employeeId: leavesTable.employeeId,
      employeeName: sql<string>`concat(${employeesTable.firstName}, ' ', ${employeesTable.lastName})`,
      leaveType: leavesTable.leaveType,
      startDate: leavesTable.startDate,
      endDate: leavesTable.endDate,
      reason: leavesTable.reason,
      status: leavesTable.status,
      reviewedBy: leavesTable.reviewedBy,
      reviewNote: leavesTable.reviewNote,
      createdAt: leavesTable.createdAt,
    })
    .from(leavesTable)
    .leftJoin(employeesTable, eq(leavesTable.employeeId, employeesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(leavesTable.createdAt);

  res.json(records.map(r => ({
    ...r,
    createdAt: (r.createdAt as Date).toISOString(),
    leaveType: r.leaveType as "annual" | "sick" | "maternity" | "paternity" | "unpaid",
    status: r.status as "pending" | "approved" | "rejected",
  })));
});

router.post("/leaves", authMiddleware, async (req, res): Promise<void> => {
  const parsed = CreateLeaveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [record] = await db.insert(leavesTable).values(parsed.data).returning();

  await db.insert(activityTable).values({
    type: "leave_submitted",
    description: `Leave request submitted for ${parsed.data.leaveType} from ${parsed.data.startDate} to ${parsed.data.endDate}`,
    actor: req.username,
  });

  res.status(201).json({
    ...record,
    createdAt: (record.createdAt as Date).toISOString(),
    leaveType: record.leaveType as "annual" | "sick" | "maternity" | "paternity" | "unpaid",
    status: record.status as "pending" | "approved" | "rejected",
    employeeName: null,
  });
});

router.put("/leaves/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateLeaveParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateLeaveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [record] = await db
    .update(leavesTable)
    .set({
      status: parsed.data.status,
      reviewNote: parsed.data.reviewNote ?? null,
      reviewedBy: req.userId,
    })
    .where(eq(leavesTable.id, params.data.id))
    .returning();

  if (!record) {
    res.status(404).json({ error: "Leave request not found" });
    return;
  }

  await db.insert(activityTable).values({
    type: "leave_updated",
    description: `Leave request #${record.id} ${parsed.data.status}`,
    actor: req.username,
  });

  res.json({
    ...record,
    createdAt: (record.createdAt as Date).toISOString(),
    leaveType: record.leaveType as "annual" | "sick" | "maternity" | "paternity" | "unpaid",
    status: record.status as "pending" | "approved" | "rejected",
    employeeName: null,
  });
});

router.delete("/leaves/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteLeaveParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [record] = await db
    .delete(leavesTable)
    .where(eq(leavesTable.id, params.data.id))
    .returning();

  if (!record) {
    res.status(404).json({ error: "Leave request not found" });
    return;
  }

  res.json({ message: "Leave request deleted" });
});

export default router;
