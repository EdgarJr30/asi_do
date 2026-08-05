# language: es
@auth @access @critical
Característica: Entrada segura a la plataforma
  Para que cada persona llegue al lugar correcto sin abrir redirecciones inseguras
  Como responsable de acceso
  Quiero que autenticación, onboarding y acceso activo se decidan con reglas explícitas

  Regla: La continuación de autenticación sólo acepta rutas internas

    Esquema del escenario: Resolver el destino posterior a la autenticación
      Dado un destino solicitado "<destino>"
      Cuando se valida el destino de autenticación
      Entonces la ruta resultante debe ser "<ruta>"

      Ejemplos:
        | destino                       | ruta                |
        | /account/membership           | /account/membership |
        | https://sitio-malicioso.test  | /account/profile    |
        | //sitio-malicioso.test        | /account/profile    |

  Regla: El onboarding incompleto tiene prioridad sobre el workspace

    Esquema del escenario: Resolver la entrada de una cuenta autenticada
      Dado un perfil base "<perfil>" y acceso al workspace "<workspace>"
      Cuando se decide la entrada autenticada
      Entonces la ruta resultante debe ser "<ruta>"

      Ejemplos:
        | perfil    | workspace | ruta             |
        | incompleto| sí        | /account/profile |
        | completo  | no        | /account         |
        | completo  | sí        | /workspace       |

  Regla: El contenido protegido exige acceso ASI vigente

    Esquema del escenario: Evaluar el acceso protegido
      Dada una cuenta "<cuenta>" con aprobación "<aprobacion>", membresía "<membresia>" y suscripción "<suscripcion>"
      Cuando se evalúa el acceso ASI protegido
      Entonces el acceso debe ser "<resultado>"

      Ejemplos:
        | cuenta  | aprobacion | membresia   | suscripcion | resultado |
        | activa  | aprobada   | activa      | activa      | permitido |
        | activa  | aprobada   | gracia      | gracia      | permitido |
        | activa  | aprobada   | suspendida  | activa      | denegado  |
        | activa  | pendiente  | activa      | activa      | denegado  |
        | inactiva| aprobada   | activa      | activa      | denegado  |
