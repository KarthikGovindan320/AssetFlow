# Karthik — Hour 4

Allocations and transfers, and the full API surface (minus dashboard). Allocate/return with conflict envelope, transfer request approve/reject (atomic reallocation), allocation guard migration, and app.ts mounting allocations, transfers, bookings, maintenance, audits, notifications, activity, and reports.

## Files

- `backend/src/modules/allocations/allocation.controller.ts`
- `backend/src/modules/allocations/allocation.routes.ts`
- `backend/src/modules/allocations/allocation.schemas.ts`
- `backend/src/modules/allocations/allocation.service.ts`
- `backend/src/modules/transfers/transfer.controller.ts`
- `backend/src/modules/transfers/transfer.routes.ts`
- `backend/src/modules/transfers/transfer.schemas.ts`
- `backend/src/modules/transfers/transfer.service.ts`
- `backend/prisma/migrations/20260712091847_allocation_guards/migration.sql`
- `backend/src/app.ts`

## Suggested commit message

```
feat(allocations): allocate/return, transfers, mount remaining domain routes
```

## Smoke test

1. `npx prisma migrate dev` applies allocation_guards
2. Allocate an already-held asset → exact conflict envelope with holder details
3. Approve a pending transfer → old allocation closed, new opened; return sets AVAILABLE
