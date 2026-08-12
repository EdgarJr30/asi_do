import { describe, expect, it } from 'vitest'

import {
  buildAuthTemplatePayload,
  validateAuthTemplateTarget
} from '../../scripts/sync-auth-email-template'

const production = {
  deployEnvironment: 'production',
  targetProjectRef: 'prod-project',
  remoteSiteUrl: 'https://asidominicana.do',
  expectedSiteUrl: 'https://asidominicana.do',
  productionProjectRef: 'prod-project',
  productionSiteUrl: 'https://asidominicana.do'
} as const

describe('auth email template synchronization guard', () => {
  it('accepts the production project only when its identity and Site URL match', () => {
    expect(validateAuthTemplateTarget(production)).toEqual([])
  })

  it('rejects a development deployment pointed at production', () => {
    expect(
      validateAuthTemplateTarget({
        ...production,
        deployEnvironment: 'development'
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('project ref de producción'),
        expect.stringContaining('Site URL de producción')
      ])
    )
  })

  it('rejects production when the remote project has a different Site URL', () => {
    expect(
      validateAuthTemplateTarget({
        ...production,
        remoteSiteUrl: 'http://localhost:5173'
      })
    ).toEqual(expect.arrayContaining([expect.stringContaining('Site URL remoto')]))
  })
})

describe('auth email template synchronization payload', () => {
  it('publishes every versioned Auth template and subject in one payload', async () => {
    const payload = await buildAuthTemplatePayload(async (fileName) => `<html>${fileName}</html>`)

    expect(payload).toEqual({
      mailer_subjects_confirmation: 'Confirma tu cuenta en ASI',
      mailer_templates_confirmation_content: '<html>confirmation.html</html>',
      mailer_subjects_invite: 'Tu acceso a ASI ya esta listo',
      mailer_templates_invite_content: '<html>invite.html</html>',
      mailer_subjects_magic_link: 'Accede a ASI con tu enlace seguro',
      mailer_templates_magic_link_content: '<html>magic_link.html</html>',
      mailer_subjects_recovery: 'Restablece tu acceso a ASI',
      mailer_templates_recovery_content: '<html>recovery.html</html>',
      mailer_subjects_email_change: 'Confirma el cambio de tu correo',
      mailer_templates_email_change_content: '<html>email_change.html</html>',
      mailer_subjects_reauthentication: 'Codigo de verificacion de seguridad',
      mailer_templates_reauthentication_content: '<html>reauthentication.html</html>'
    })
  })
})
