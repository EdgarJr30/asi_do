# language: es
@pipeline @tenant @moderation @plans @critical
Característica: Gobierno del pipeline y de la plataforma
  Para preservar el aislamiento entre tenants y acciones administrativas trazables
  Como responsable de operaciones
  Quiero que los cambios críticos estén autorizados, limitados y auditados

  Regla: Mover una postulación exige permiso dentro del tenant correcto

    Escenario: Cambiar una postulación de etapa
      Dado el contrato de movimiento del pipeline
      Entonces exige el permiso "application:move_stage" sobre el tenant de la oportunidad
      Y sólo acepta una etapa global o perteneciente al mismo tenant
      Y registra actor, origen y destino en el historial

  Regla: El plan limita publicaciones por tenant

    Escenario: Un tenant alcanza su límite de oportunidades publicadas
      Dado el contrato de límites de publicación
      Entonces cuenta únicamente las oportunidades publicadas del mismo tenant
      Y rechaza una nueva publicación cuando se alcanza el límite

  Regla: Las acciones de moderación son privilegiadas y trazables

    Escenario: Resolver un caso de moderación
      Dado el contrato de acciones de moderación
      Entonces exige el permiso "moderation:act" o administración de plataforma
      Y registra la acción, el actor y la entidad afectada
