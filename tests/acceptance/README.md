# Mapa de aceptación ejecutable

Este directorio contiene únicamente reglas y recorridos que negocio, QA y desarrollo necesitan comprender juntos. No replica cada prueba técnica del repositorio.

| Feature | Reglas de negocio | Evidencia ejecutable |
| --- | --- | --- |
| `permission-access.feature` | capacidades públicas/protegidas y permisos explícitos | guards RBAC de producción |
| `authentication-and-access.feature` | redirección segura, onboarding y acceso ASI vigente | helpers de callback, onboarding, rutas y acceso ASI |
| `membership-lifecycle.feature` | inactivación administrativa, retiro de acceso y auditoría | RPC versionado `deactivate_member` |
| `opportunities-and-applications.feature` | compensación, requisitos por tipo, duplicados, entrada al pipeline y estado candidato | esquema de oportunidad, filtros y RPC `submit_application` |
| `pipeline-and-governance.feature` | aislamiento de etapas, permisos, límites de plan y moderación auditada | RPC y triggers versionados de pipeline/plataforma |
| `notifications-and-offline.feature` | normalización de destinos y continuidad PWA sin red | resolver de notificaciones, service worker y banner offline |

## Relación con las demás suites

- Gherkin explica y ejecuta la regla compartida.
- Vitest verifica decisiones, componentes y contratos con mayor detalle.
- Playwright verifica recorridos reales, especialmente membresía, aislamiento territorial, realtime y PWA.
- Las migraciones y RLS siguen siendo la autoridad para aislamiento y autorización del backend.

Ejecutar el mapa completo:

```bash
npm run test:acceptance
```

Una regla nueva entra aquí sólo si una persona de negocio o QA puede revisarla y si representa un resultado observable o una política crítica. Helpers, detalles de renderizado y casos puramente técnicos permanecen en Vitest o Playwright.
