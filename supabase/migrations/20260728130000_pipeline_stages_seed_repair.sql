-- Repara el catálogo de etapas del ATS.
--
-- Síntoma: /workspace/pipeline mostraba el contador ("65 candidatos en proceso")
-- pero ninguna columna. La causa es que public.pipeline_stages quedó SIN filas de
-- sistema (tenant_id is null) en el proyecto remoto, así que el tablero no tenía
-- etapas que renderizar y todas las postulaciones quedaron con current_stage_id
-- nulo (la FK es "on delete set null").
--
-- Efecto colateral grave: submit_application() aborta con "Initial pipeline stage
-- is not configured" cuando falta la etapa 'applied', de modo que nadie podía
-- postularse desde la UI.
--
-- Esta migración es idempotente: re-siembra las etapas de sistema, normaliza sus
-- nombres al español (la plataforma es 100% en español; el `code` sigue siendo la
-- llave canónica que usan los RPC) y reasigna la etapa de las postulaciones
-- huérfanas a partir de status_public.
--
-- OJO con `position`: el proyecto remoto tiene un check constraint
-- "pipeline_stages_position_check" que exige position >= 1 y que NO está en
-- ninguna migración de este repo (drift agregado a mano). El seed original de
-- 20260315083000 usa 0..5, así que aquí normalizamos a 1..6: satisface el
-- constraint remoto y es equivalente en entornos limpios, donde solo importa el
-- orden relativo (la UI hace `order by position`).

insert into public.pipeline_stages (tenant_id, code, name, position, color_token, is_system)
values
  (null, 'applied', 'Postulado', 1, 'sky', true),
  (null, 'screening', 'Preselección', 2, 'amber', true),
  (null, 'interview', 'Entrevista', 3, 'violet', true),
  (null, 'offer', 'Oferta', 4, 'emerald', true),
  (null, 'hired', 'Contratado', 5, 'emerald', true),
  (null, 'rejected', 'Descartado', 6, 'rose', true)
on conflict do nothing;

-- Converge los nombres heredados en inglés (seed original de 20260315083000) con
-- los del idioma de la plataforma, sin tocar etapas propias de cada tenant.
update public.pipeline_stages stage
set name = canonical.name,
    position = canonical.position,
    color_token = canonical.color_token,
    is_system = true
from (
  values
    ('applied', 'Postulado', 1, 'sky'),
    ('screening', 'Preselección', 2, 'amber'),
    ('interview', 'Entrevista', 3, 'violet'),
    ('offer', 'Oferta', 4, 'emerald'),
    ('hired', 'Contratado', 5, 'emerald'),
    ('rejected', 'Descartado', 6, 'rose')
) as canonical (code, name, position, color_token)
where stage.tenant_id is null
  and lower(stage.code) = canonical.code
  and (
    stage.name is distinct from canonical.name
    or stage.position is distinct from canonical.position
    or stage.color_token is distinct from canonical.color_token
    or stage.is_system is distinct from true
  );

-- Reasigna las postulaciones que quedaron sin etapa, respetando su estado público.
update public.applications a
set current_stage_id = stage.id
from public.pipeline_stages stage
where a.current_stage_id is null
  and stage.tenant_id is null
  and stage.code = case
    when a.status_public = 'submitted' then 'applied'
    when a.status_public = 'in_review' then 'screening'
    when a.status_public = 'interviewing' then 'interview'
    when a.status_public = 'offer' then 'offer'
    when a.status_public = 'hired' then 'hired'
    when a.status_public in ('rejected', 'withdrawn') then 'rejected'
    else 'applied'
  end;
