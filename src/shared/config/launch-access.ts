export const PLATFORM_REGISTRATION_LOCKED = false
export const MEMBERSHIP_APPLICATION_SUBMISSIONS_LOCKED = false

// Invitar miembros al workspace queda fuera de circulacion por ahora: el codigo
// sigue en el repo (API, mutaciones y UI) pero no se monta ni se consulta.
export const WORKSPACE_TEAM_MANAGEMENT_ENABLED: boolean = false

// El catalogo de roles y permisos solo lo ve la administracion de plataforma
// (/admin/access-control). Las empresas no tienen vista de roles.
export const WORKSPACE_ROLE_VISIBILITY_ENABLED: boolean = false

export const PLATFORM_REGISTRATION_LOCKED_MESSAGE =
  'El registro de nuevas cuentas esta cerrado temporalmente. La plataforma queda disponible solo en modo muestra mientras ASI habilita el acceso.'

export const MEMBERSHIP_APPLICATIONS_LOCKED_MESSAGE =
  'La recepcion de solicitudes de membresia esta cerrada temporalmente. Puedes revisar el formulario, pero el envio esta deshabilitado.'
