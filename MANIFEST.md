# Vishnu — Hour 3

Asset directory UI. List with filters/search, register dialog with per-field validation, and asset detail with lifecycle history. Routes for /assets and /assets/:id go live; other domain screens stay placeholders.

## Files

- `frontend/src/features/assets/AssetsPage.tsx`
- `frontend/src/features/assets/AssetDetailPage.tsx`
- `frontend/src/routes/index.tsx`

## Suggested commit message

```
feat(assets-ui): asset directory list, register form, asset detail page
```

## Smoke test

1. Open /assets as Asset Manager → register an asset → appears with auto tag
2. Search by name or tag; filter by status
3. Open detail page from a row; validation errors show per field on bad submit
