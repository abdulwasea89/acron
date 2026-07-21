# ADR 015: File Storage

**Status:** Accepted

## Context
The platform stores receipt images (member-uploaded), processed receipt images (AI pipeline), pay stub PDFs, and CSV export files. These need to be durable, accessible via signed URLs, and isolated by tenant.

## Decision
Use cloud object storage with tenant-prefixed paths:

- **Primary:** AWS S3 (production)
- **Alternative:** Cloudflare R2 (S3-compatible, no egress fees)
- Path pattern: `{org_id}/{entity_type}/{entity_id}_{timestamp}.{ext}`
- All uploads go through a presigned URL — files upload directly to S3, not through the backend
- Access controlled via signed URLs with configurable TTL (1 hour default)
- Images are auto-compressed and converted to JPEG on upload

## Consequences
- Backend never handles file bytes directly — lower memory usage
- S3/R2 provides durable storage with 99.999999999% durability
- Tenant isolation via path prefix
- Signed URLs prevent unauthorized access
- CDN (CloudFront) can be added for faster global delivery
