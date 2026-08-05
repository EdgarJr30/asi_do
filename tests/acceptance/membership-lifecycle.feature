# language: es
@membership @audit @critical
Característica: Ciclo de vida de la membresía ASI
  Para que aprobación, pago y acceso no se confundan
  Como equipo de membresía y plataforma
  Quiero que la activación e inactivación mantengan estados y auditoría coherentes

  Regla: Inactivar una membresía retira acceso sin desactivar la cuenta

    Escenario: Un administrador inactiva una membresía activa
      Dado el contrato administrativo de inactivación de membresía
      Cuando se inspecciona su efecto persistente
      Entonces la membresía queda suspendida y la suscripción finalizada
      Y la cuenta de usuario no se marca como inactiva
      Y se registra el evento auditado "member.deactivated"

  Regla: La inactivación sólo está disponible para administradores autenticados

    Escenario: Proteger la operación administrativa
      Dado el contrato administrativo de inactivación de membresía
      Entonces exige autenticación y rol de administrador de plataforma
