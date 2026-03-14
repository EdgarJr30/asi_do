# Feature Convention

Each feature folder should stay cohesive and may contain:

```text
components/
hooks/
pages/
services/
tests/
```

Keep business logic close to the owning domain and avoid leaking feature-specific concerns into global folders unless they are truly shared.
