-- Añade el estado 'draft' al workflow de revisión.
--
-- IMPORTANT: `alter type ... add value` no puede USARSE en la misma transacción
-- donde se agrega (Postgres: "unsafe use of new value of enum type"). Por eso esta
-- migración SOLO agrega el valor; las políticas/índices que lo referencian viven en
-- una migración posterior (20260707120500_membership_application_drafts.sql).
--
-- El draft representa una solicitud iniciada pero aún no enviada a revisión: guarda
-- la categoría (y datos conocidos del usuario) en la cuenta para que el solicitante
-- pueda reanudar sin repetir la verificación de elegibilidad. Se ordena antes de
-- 'submitted' porque es la etapa previa del pipeline.

alter type public.review_workflow_status add value if not exists 'draft' before 'submitted';
