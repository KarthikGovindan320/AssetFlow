# Karthik — Hour 3

Asset directory and lifecycle. Category CRUD, asset registration with auto-generated AF-#### tags (DB sequence migration), search/filter, and the asset status state machine + transition service used by allocations, bookings, maintenance, and audits.

## Files

- `backend/src/lib/asset-status-machine.ts`
- `backend/src/modules/categories/category.controller.ts`
- `backend/src/modules/categories/category.routes.ts`
- `backend/src/modules/categories/category.schemas.ts`
- `backend/src/modules/categories/category.service.ts`
- `backend/src/modules/assets/asset.controller.ts`
- `backend/src/modules/assets/asset.routes.ts`
- `backend/src/modules/assets/asset.schemas.ts`
- `backend/src/modules/assets/asset.service.ts`
- `backend/src/modules/assets/asset-status.service.ts`
- `backend/prisma/migrations/20260712083015_asset_tag_sequence/migration.sql`
- `backend/src/app.ts`

## Suggested commit message

```
feat(assets): categories, asset CRUD, tag sequence, lifecycle state machine
```

## Smoke test

1. `npx prisma migrate dev` applies asset_tag_sequence; register an asset → tag AF-00xx auto-assigned
2. GET /api/v1/assets supports search by name/tag and status filters
3. Illegal status transition via service returns 409 with INVALID_STATUS_TRANSITION
