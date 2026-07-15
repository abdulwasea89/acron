# Infrastructure

Environment-specific infrastructure-as-code and configs.

```
infra/
├── staging/          # Staging environment configs + README
└── prod/             # Production environment configs + README
```

Each environment folder contains its own Terraform/Pulumi files, k8s manifests, or deployment scripts.
