# Vishnu — Hour 4

Allocations UI and first analytics cut. Allocate/return/transfer flows with conflict modal, utilization + maintenance-frequency charts (Recharts now in package.json), and live routes for allocations and reports. Heatmap, department chart, attention lists, and CSV export land next hours.

## Files

- `frontend/src/features/allocations/AllocationsPage.tsx`
- `frontend/src/features/reports/ReportsPage.tsx`
- `frontend/src/routes/index.tsx`
- `frontend/package.json`

## Suggested commit message

```
feat(allocations-ui,reports): allocation workflows and initial report charts
```

## Smoke test

1. Open /allocations → allocate asset; conflict on double-hold shows modal with holder
2. Transfer approve/reject from the transfers tab
3. /reports shows utilization and maintenance charts for manager roles
