import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, resolve } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

const repoRoot = resolve(import.meta.dirname, '../..')
const temporaryDirectories: string[] = []

function writeExecutable(path: string, contents: string) {
  writeFileSync(path, contents)
  chmodSync(path, 0o755)
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe('Hostinger release deployment', () => {
  it('retries a resumable FTPS phase after lftp exhausts one session', () => {
    const workspace = mkdtempSync(resolve(tmpdir(), 'asi-hostinger-deploy-'))
    const artifactDirectory = resolve(workspace, 'dist')
    const fakeBin = resolve(workspace, 'bin')
    const lftpCountFile = resolve(workspace, 'lftp-count')
    temporaryDirectories.push(workspace)

    mkdirSync(resolve(artifactDirectory, 'assets'), { recursive: true })
    mkdirSync(fakeBin)
    writeFileSync(resolve(artifactDirectory, '.htaccess'), 'RewriteEngine On\n')
    writeFileSync(resolve(artifactDirectory, 'index.html'), '<main>release</main>\n')
    writeFileSync(resolve(artifactDirectory, 'sw.js'), 'self.skipWaiting()\n')
    writeFileSync(resolve(artifactDirectory, 'assets', 'app.js'), 'export {}\n')

    writeExecutable(
      resolve(fakeBin, 'curl'),
      `#!/usr/bin/env bash
set -eu
while (( $# > 0 )); do
  if [[ $1 == --output ]]; then
    output=$2
    shift 2
  else
    shift
  fi
done
printf 'previous entrypoint\\n' > "$output"
`
    )
    writeExecutable(
      resolve(fakeBin, 'lftp'),
      `#!/usr/bin/env bash
set -eu
count=0
if [[ -f $FAKE_LFTP_COUNT_FILE ]]; then
  read -r count < "$FAKE_LFTP_COUNT_FILE"
fi
count=$((count + 1))
printf '%s\\n' "$count" > "$FAKE_LFTP_COUNT_FILE"
if (( count == 1 )); then
  echo 'Fatal error: max-retries exceeded' >&2
  exit 1
fi
`
    )
    writeExecutable(resolve(fakeBin, 'node'), '#!/usr/bin/env bash\nexit 0\n')
    writeExecutable(resolve(fakeBin, 'sleep'), '#!/usr/bin/env bash\nexit 0\n')

    const result = spawnSync(
      'bash',
      [resolve(repoRoot, 'scripts/deploy-hostinger-release.sh'), 'dist', 'https://dev.example.com'],
      {
        cwd: workspace,
        encoding: 'utf8',
        env: {
          ...process.env,
          FAKE_LFTP_COUNT_FILE: lftpCountFile,
          HOSTINGER_HOST: 'ftp.example.com',
          HOSTINGER_PASSWORD: 'secret',
          HOSTINGER_PORT: '21',
          HOSTINGER_USERNAME: 'deployer',
          PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ''}`
        }
      }
    )

    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(lftpCountFile, 'utf8').trim()).toBe('5')
    expect(result.stderr).toContain('Retrying FTPS operation')
  })
})
