import assert from 'node:assert/strict'

import { Given, Then, When, setWorldConstructor } from '@cucumber/cucumber'

import { hasPermission } from '../../src/lib/permissions/guards'
import { isPermissionCode, type PermissionCode } from '../../src/shared/constants/permissions'

class PermissionWorld {
  permissions: PermissionCode[] = []
  accessGranted: boolean | undefined
}

setWorldConstructor(PermissionWorld)

Given('una sesión con los permisos {string}', function (this: PermissionWorld, rawPermissions: string) {
  this.permissions = rawPermissions
    .split(',')
    .map((permission) => permission.trim())
    .filter(isPermissionCode)
})

Given('una sesión sin permisos', function (this: PermissionWorld) {
  this.permissions = []
})

When('solicita la capacidad {string}', function (this: PermissionWorld, requiredPermission: string) {
  assert.ok(isPermissionCode(requiredPermission), `Permiso desconocido en el escenario: ${requiredPermission}`)
  this.accessGranted = hasPermission(this.permissions, requiredPermission)
})

When('solicita una capacidad pública', function (this: PermissionWorld) {
  this.accessGranted = hasPermission(this.permissions)
})

Then('el acceso debe ser {string}', function (this: PermissionWorld, expectedResult: string) {
  assert.equal(this.accessGranted, expectedResult === 'permitido')
})
