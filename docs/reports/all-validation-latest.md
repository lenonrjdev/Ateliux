# Ateliux all Validation Report

- Date: 2026-07-01T14:00:36.548Z
- Mode: all
- Branch: main
- Commit: 8b5e6f8
- Result: passed

## Steps

| Step | Status | Duration |
| --- | --- | --- |
| Backend prisma generate | passed | 5.9s |
| Backend migrate status | passed | 5.9s |
| Backend typecheck | passed | 15.1s |
| Backend lint | passed | 20.4s |
| Backend build | passed | 22.4s |
| Backend tests | passed | 12.8s |
| Backend audit | passed | 2.7s |
| Admin typecheck | passed | 4.8s |
| Admin lint | passed | 19.6s |
| Admin build | passed | 31.1s |
| Admin audit | passed | 3.0s |
| Frontend typecheck | passed | 7.3s |
| Frontend lint | passed | 26.3s |
| Frontend build | passed | 43.3s |
| Frontend audit | passed | 3.0s |
| Root audit | passed | 2.5s |
| Playwright E2E | passed | 73.4s |

## Warnings

- None recorded by the orchestrator.

## Known Warnings

- Prisma warns that package.json#prisma will be removed in Prisma 7.
- Admin and frontend may still report Next.js no-img-element warnings where dynamic images use <img>.
- Next.js may warn about multiple lockfiles because the repository has root, admin and frontend package-lock files.

## Pending

- Expand browser E2E coverage to blog, uploads, inbox, finance and notifications.
- Run strict environment validation in the real staging/production provider with VALIDATION_STRICT_ENV=true.

## Security Notes

- This report intentionally does not include environment values or secrets.
- E2E production targets require explicit E2E_ALLOW_PRODUCTION=true.
