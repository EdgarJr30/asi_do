# Experience Ownership

The source tree is split into three top-level product experiences:

```text
src/experiences/
  institutional/  ASI institutional portal under `/`
  storefront/     product marketing and member-gated job entry under `/platform`
  app/            authenticated application experience
```

Inside `app/`, the runtime is still divided by route surface:

```text
auth/       access and account recovery flows under `/auth/*`
candidate/  user account talent workflows under `/account/*`
workspace/  employer tenant workflows under `/workspace/*`
admin/      restricted platform console under `/admin/*`
```

Rule:
- experience ownership lives in `src/experiences/*`
- shared business logic lives in `src/features/*`
- shared platform layers stay in `src/app`, `src/components`, `src/lib`, and `src/shared`
