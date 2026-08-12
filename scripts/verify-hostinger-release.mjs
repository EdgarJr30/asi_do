import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import process from 'node:process'

const [mode, artifactArgument, originArgument] = process.argv.slice(2)

if (!['assets', 'live'].includes(mode) || !artifactArgument || !originArgument) {
  console.error('Usage: verify-hostinger-release.mjs <assets|live> <artifact-dir> <https-origin>')
  process.exit(1)
}

const artifactDirectory = resolve(artifactArgument)
const deployOrigin = new URL(originArgument)

if (deployOrigin.protocol !== 'https:' || deployOrigin.pathname !== '/') {
  throw new Error(`Expected an HTTPS origin without a path, received ${originArgument}`)
}

async function retry(operation, attempts = 3) {
  let lastError

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (attempt < attempts) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500))
      }
    }
  }

  throw lastError
}

async function fetchForDeploy(pathname, init = {}) {
  const url = new URL(pathname, deployOrigin)
  url.searchParams.set('deploy-check', Date.now().toString())

  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'accept-encoding': 'identity' },
    ...init
  })

  if (!response.ok) {
    throw new Error(`${url.pathname} returned HTTP ${response.status}`)
  }

  return response
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)))
    } else if (entry.isFile()) {
      files.push(path)
    }
  }

  return files
}

async function verifyAssets() {
  const assetsDirectory = join(artifactDirectory, 'assets')
  const files = await listFiles(assetsDirectory)
  const queue = [...files]

  if (files.length === 0) {
    throw new Error('The release artifact contains no assets')
  }

  async function worker() {
    while (queue.length > 0) {
      const localPath = queue.shift()
      const remotePath = `/${relative(artifactDirectory, localPath).split(sep).join('/')}`
      const expected = await readFile(localPath)

      await retry(async () => {
        const response = await fetchForDeploy(remotePath)
        const actual = Buffer.from(await response.arrayBuffer())

        if (digest(actual) !== digest(expected)) {
          throw new Error(`Asset checksum mismatch: ${remotePath}`)
        }
      })
    }
  }

  await Promise.all(Array.from({ length: Math.min(6, files.length) }, () => worker()))
  console.log(`Verified ${files.length} release asset checksums before activation.`)
}

function digest(contents) {
  return createHash('sha256').update(contents).digest('hex')
}

async function verifyLiveEntrypoints() {
  for (const filename of ['index.html', 'sw.js']) {
    const expected = await readFile(join(artifactDirectory, filename))
    const response = await retry(() => fetchForDeploy(`/${filename}`))
    const actual = Buffer.from(await response.arrayBuffer())

    if (digest(actual) !== digest(expected)) {
      throw new Error(`Live ${filename} does not match the release artifact`)
    }
  }

  console.log('Verified live index.html and sw.js after activation.')
}

if (mode === 'assets') {
  await verifyAssets()
} else {
  await verifyLiveEntrypoints()
}
