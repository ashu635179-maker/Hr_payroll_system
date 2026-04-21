# HR & Payroll Management System — NexusHR

## Overview

Full-stack HR & Payroll Management System (NexusHR) built with React + Vite frontend and Express 5 backend, following MVC architecture principles.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Recharts + Wouter
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Authentication**: Session-based (in-memory sessions + Bearer tokens)
- **Build**: esbuild (CJS bundle)

## Architecture (MVC)

- **Model**: Drizzle ORM tables in `lib/db/src/schema/` (Users, Employees, Departments, Payroll, Leaves, Activity)
- **Controller**: Express route handlers in `artifacts/api-server/src/routes/` 
- **View**: React pages in `artifacts/hr-payroll/src/pages/`

## Key Features

- **CRUD**: Full Create/Read/Update/Delete for Employees, Departments, Payroll, and Leaves
- **Authentication**: Username/password login with SHA-256 hashed passwords, in-memory sessions, Bearer token auth
- **Authorization**: Role-based access control (admin, hr_manager, employee)
- **Session Management**: Server-side session store via Map; cookie-based "Last Login" timestamp on client
- **File Upload**: Employee profile photo URL upload endpoint
- **Real-time Validation**: Client-side JS validation (email format, salary > 0)
- **Leave Management**: Full leave request workflow with approval/rejection
- **Dashboard**: Summary stats, payroll-by-department chart, recent activity feed

## Default Credentials

- **Admin**: username `admin`, password `admin123`
- **HR Manager**: username `hr_manager`, password `hr123`
- **Employee**: username `john.doe`, password `emp123`

## Database Schema (ER Diagram)

Four main tables:
- **users**: id, username, email, password_hash, role, last_login, created_at
- **employees**: id, first_name, last_name, email, phone, position, department_id (FK→departments), hire_date, salary, status, photo_url, address, created_at
- **departments**: id, name, description, manager_id, created_at
- **payroll**: id, employee_id (FK→employees), month, year, basic_salary, bonuses, deductions, net_salary, status, processed_at, created_at
- **leaves**: id, employee_id (FK→employees), leave_type, start_date, end_date, reason, status, reviewed_by, review_note, created_at
- **activity**: id, type, description, actor, timestamp

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes

## API Routes

All routes under `/api`:
- `POST /api/auth/login` — login (returns token + user)
- `POST /api/auth/logout` — logout
- `GET /api/auth/me` — get current user
- `GET/POST /api/employees` — list/create employees
- `GET/PUT/DELETE /api/employees/:id` — get/update/delete employee
- `POST /api/employees/:id/upload-photo` — update employee photo
- `GET/POST /api/departments` — list/create departments
- `PUT/DELETE /api/departments/:id` — update/delete department
- `GET/POST /api/payroll` — list/create payroll records
- `PUT/DELETE /api/payroll/:id` — update/delete payroll
- `GET/POST /api/leaves` — list/create leave requests
- `PUT/DELETE /api/leaves/:id` — update/delete leave
- `GET /api/dashboard/summary` — dashboard stats
- `GET /api/dashboard/payroll-by-department` — payroll by dept chart
- `GET /api/dashboard/recent-activity` — activity feed
