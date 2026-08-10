# language: es
@notifications @pwa @offline @critical
Característica: Continuidad y comunicación operativa
  Para que una persona entienda lo ocurrido y pueda continuar con seguridad
  Como usuario de la PWA
  Quiero notificaciones con destinos válidos y una experiencia clara cuando falta conexión

  Regla: Las notificaciones antiguas se normalizan a rutas vigentes

    Esquema del escenario: Resolver una notificación con ruta histórica
      Dada una notificación de tipo "<tipo>" con destino "/applications"
      Cuando se resuelve el destino de la notificación
      Entonces la ruta resultante debe ser "<ruta>"

      Ejemplos:
        | tipo                  | ruta                    |
        | application.submitted | /workspace/applications |
        | application_update    | /account/applications   |

    Escenario: Una notificación informativa no tiene acción
      Dada una notificación de tipo "announcement" sin destino
      Cuando se resuelve el destino de la notificación
      Entonces la notificación no debe navegar

  Regla: La PWA conserva el shell y explica la pérdida de conexión

    Escenario: Falla la red durante una navegación
      Dado el contrato offline de la PWA
      Entonces una navegación fallida recupera el shell desde caché
      Y se informa que se muestra la última información guardada
      Y existe una acción explícita para reintentar

  Regla: Los envíos masivos no pueden saturar silenciosamente el pipeline

    Escenario: Una campaña excede la capacidad segura de correos
      Dado el contrato de protección del pipeline de correos
      Cuando se intenta superar la capacidad segura de la cola
      Entonces la campaña se rechaza antes de crear entregas
      Y solo puede existir un procesador de correos activo
