# language: es
@opportunities @applications @critical
Característica: Publicación y postulación a oportunidades
  Para evitar ofertas inválidas y postulaciones inconsistentes
  Como candidato y equipo reclutador
  Quiero reglas claras desde la publicación hasta la entrada al proceso

  Regla: Una compensación visible debe tener un rango válido

    Escenario: El máximo es menor que el mínimo
      Dada una oportunidad válida con compensación visible entre "3000" y "2000"
      Cuando se valida la oportunidad
      Entonces la oportunidad debe ser rechazada por "compensationMaxAmount"

  Regla: Los proyectos deben explicar alcance y entrega

    Escenario: Un proyecto no tiene alcance ni plazo
      Dada una oportunidad de proyecto sin alcance operativo ni plazo de entrega
      Cuando se valida la oportunidad
      Entonces la oportunidad debe ser rechazada por "operatingScope"
      Y la oportunidad debe ser rechazada por "deliveryTimeline"

  Regla: Una persona sólo se postula una vez a la misma oportunidad

    Escenario: Repetir una postulación
      Dado el contrato de envío de postulaciones
      Entonces una postulación duplicada se rechaza con feedback explícito

  Regla: Toda postulación entra inmediatamente al pipeline

    Escenario: Crear una postulación válida
      Dado el contrato de envío de postulaciones
      Entonces la postulación recibe la etapa inicial "applied"
      Y se registra su primera entrada en el historial del pipeline

  Regla: El estado visible para el candidato refleja el proceso

    Esquema del escenario: Filtrar el historial de postulaciones
      Dada una postulación con estado "<estado>"
      Cuando el candidato consulta el filtro "<filtro>"
      Entonces la postulación debe estar "<visibilidad>"

      Ejemplos:
        | estado       | filtro | visibilidad |
        | submitted    | sent   | visible     |
        | interviewing | review | visible     |
        | rejected     | review | oculta      |
        | hired        | hired  | visible     |
