# language: es
@rbac @critical
Característica: Acceso por permisos de plataforma
  Para preservar RBAC y el aislamiento entre tenants
  Como responsable de la plataforma
  Quiero que una sesión sólo reciba las capacidades que tiene asignadas

  Regla: Una capacidad protegida exige su permiso explícito

    Esquema del escenario: Evaluar una capacidad protegida
      Dada una sesión con los permisos "<permisos>"
      Cuando solicita la capacidad "job:read"
      Entonces el acceso debe ser "<resultado>"

      Ejemplos:
        | permisos                 | resultado |
        | workspace:read,job:read | permitido |
        | workspace:read          | denegado   |
        |                          | denegado   |

  Regla: Una capacidad pública no inventa un requisito de autorización

    Escenario: Consultar una capacidad sin permiso requerido
      Dada una sesión sin permisos
      Cuando solicita una capacidad pública
      Entonces el acceso debe ser "permitido"
