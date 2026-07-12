# Karthik — Hour 2

Real auth and org APIs. JWT access/refresh tokens, bcrypt password hashing, zod-validated env, shared pagination/validation helpers, auth + RBAC + rate-limit middleware, and full department/employee CRUD. App mounts auth, departments, and employees only; other domains land later hours. Shared `Actor` type lives in `lib/actor.ts` so later modules can import it without circular timing issues. Server boots Ann's notification scheduler (same-hour collaboration).

## Files

- `backend/package.json`
- `backend/src/config/env.ts`
- `backend/src/lib/prisma.ts`
- `backend/src/lib/jwt.ts`
- `backend/src/lib/password.ts`
- `backend/src/lib/validation.ts`
- `backend/src/lib/pagination.ts`
- `backend/src/lib/actor.ts`
- `backend/src/middleware/auth.ts`
- `backend/src/middleware/rbac.ts`
- `backend/src/middleware/rate-limit.ts`
- `backend/src/middleware/request-logger.ts`
- `backend/src/middleware/error-handler.ts`
- `backend/src/types/express.d.ts`
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.routes.ts`
- `backend/src/modules/auth/auth.schemas.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/departments/department.controller.ts`
- `backend/src/modules/departments/department.routes.ts`
- `backend/src/modules/departments/department.schemas.ts`
- `backend/src/modules/departments/department.service.ts`
- `backend/src/modules/employees/employee.controller.ts`
- `backend/src/modules/employees/employee.routes.ts`
- `backend/src/modules/employees/employee.schemas.ts`
- `backend/src/modules/employees/employee.service.ts`
- `backend/src/server.ts`
- `backend/src/app.ts`

## Suggested commit message

```
feat(auth): JWT auth, RBAC middleware, departments and employees APIs
```

## Smoke test

1. In backend/: `npm install && npx prisma migrate dev && npx prisma db seed && npm run dev`
2. POST /api/v1/auth/login with admin@assetflow.io / Admin@123 returns tokens; GET /api/v1/departments with Bearer token returns departments
3. POST /api/v1/auth/signup creates EMPLOYEE only; employee token gets 403 on role-changing routes
