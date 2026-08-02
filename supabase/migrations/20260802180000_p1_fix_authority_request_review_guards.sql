-- ─────────────────────────────────────────────────────────────────────────────
-- P1 TASK-263 — RBAC de las solicitudes de autoridad.
--
-- Los guards de pastor y regional estaban montados como `BEFORE INSERT OR
-- UPDATE` y exigían `auth.uid() = requester_user_id` en ambos casos. Como
-- `SECURITY DEFINER` cambia el rol de base de datos pero **no** el `auth.uid()`
-- del llamante, el `UPDATE` que hace el RPC de revisión disparaba el guard con
-- el uid del revisor y siempre fallaba con «You can only submit your own …».
--
-- Efecto: **aprobar o rechazar una solicitud pastoral o regional era imposible**
-- para cualquier revisor, sin importar sus permisos. La revisión de recruiter no
-- estaba afectada porque su guard ya contemplaba al revisor.
--
-- Y en sentido contrario: la política RLS de UPDATE permite al solicitante
-- editar su propia fila, y estos guards no impedían que tocara `status`,
-- `reviewed_by_user_id`, `reviewed_at`, `review_notes` ni `approved_scope_id`.
-- Es decir, podía manipular el estado de su propia solicitud por PATCH directo.
--
-- Se adopta el patrón que ya usaba `guard_recruiter_request_update`: separar
-- INSERT de UPDATE, dar salida temprana a quien tiene el permiso de revisión y,
-- para el solicitante, dejar fuera de su alcance los campos de revisión.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Solicitud de autoridad pastoral ──────────────────────────────────────────

create or replace function public.guard_pastor_authority_request_submission()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if TG_OP = 'INSERT' then
    if auth.uid() <> new.requester_user_id then
      raise exception 'You can only submit your own pastor authority request';
    end if;

    if not new.pastor_status_attestation then
      raise exception 'Pastor status attestation is required';
    end if;

    if new.union_id is null or new.association_id is null or new.district_id is null then
      raise exception 'Union, association, and district are required';
    end if;

    return new;
  end if;

  -- UPDATE. El revisor autorizado pasa: es quien debe cambiar estado y metadata.
  if public.has_platform_permission('pastor_authority_request:review') then
    return new;
  end if;

  if old.requester_user_id <> auth.uid() then
    raise exception 'You can only update your own pastor authority request';
  end if;

  -- El solicitante no decide sobre su propia solicitud.
  if new.status is distinct from old.status
    or new.reviewed_at is distinct from old.reviewed_at
    or new.reviewed_by_user_id is distinct from old.reviewed_by_user_id
    or new.review_notes is distinct from old.review_notes
    or new.approved_scope_id is distinct from old.approved_scope_id then
    raise exception 'Only authorized reviewers can change the review outcome';
  end if;

  return new;
end;
$$;

-- ── Solicitud de autoridad regional ──────────────────────────────────────────

create or replace function public.guard_regional_authority_request_submission()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if TG_OP = 'INSERT' then
    if auth.uid() <> new.requester_user_id then
      raise exception 'You can only submit your own regional authority request';
    end if;

    if new.admin_scope_type not in ('union', 'association') then
      raise exception 'Regional administrators must request union or association scope';
    end if;

    if new.union_id is null then
      raise exception 'Union is required';
    end if;

    if new.admin_scope_type = 'association' and new.association_id is null then
      raise exception 'Association scope requires an association id';
    end if;

    return new;
  end if;

  if public.has_platform_permission('regional_authority_request:review') then
    return new;
  end if;

  if old.requester_user_id <> auth.uid() then
    raise exception 'You can only update your own regional authority request';
  end if;

  if new.status is distinct from old.status
    or new.reviewed_at is distinct from old.reviewed_at
    or new.reviewed_by_user_id is distinct from old.reviewed_by_user_id
    or new.review_notes is distinct from old.review_notes
    or new.approved_scope_id is distinct from old.approved_scope_id then
    raise exception 'Only authorized reviewers can change the review outcome';
  end if;

  return new;
end;
$$;
