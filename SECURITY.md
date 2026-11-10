# Security Policy

TaskFlow is a portfolio project. Do not use it for sensitive or production workloads without an independent security review.

## Reporting a vulnerability

Please avoid publishing credentials, personal data or exploit details in a public issue. Contact the repository owner privately through the contact details on the GitHub profile with a concise description, impact and reproduction steps.

## Current safeguards

- Passwords are hashed with bcrypt.
- Session tokens are stored in signed HTTP-only cookies.
- Authentication endpoints are rate limited.
- Request payloads are validated with Zod.
- Security headers are configured with Helmet.
- Task queries are scoped to the workspace in the verified session.

## Known production work

Before production use, implement CSRF protection suited to the deployment, email verification, password recovery, account/session revocation, audit logging, monitoring, backup/restore procedures and a formal security review. Use HTTPS and a managed secret store.
