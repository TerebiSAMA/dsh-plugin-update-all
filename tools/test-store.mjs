/**
 * 纯逻辑自测：Git 来源解析与版本比较。
 *
 * 把 src/store.ts 单独打成 CJS（`dsh-client-store` 保持 external，用桩代替），
 * 在 node 里跑几组真实形状的输入，确认不会静默出错。
 */

import { build } from 'esbuild'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const result = await build({
  entryPoints: [join(root, 'src', 'store.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'es2022',
  external: ['@deepseek-ai/dsh-client-store'],
  write: false,
  logLevel: 'warning',
})

const dir = mkdtempSync(join(tmpdir(), 'pua-test-'))
const file = join(dir, 'store.cjs')
writeFileSync(file, result.outputFiles[0].text)

// 给 external 模块一个最小桩
const stub = join(dir, 'dsh-client-store.cjs')
writeFileSync(stub, 'exports.createSnapshotStore = (initial) => ({ getSnapshot: () => initial, set: () => {} })\n')
const require_ = createRequire(pathToFileURL(file))
require_.resolve = require_.resolve
const Module = require_('node:module')
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
  if (request === '@deepseek-ai/dsh-client-store') return stub
  return originalResolve.call(this, request, ...rest)
}

const mod = require_(file)
const { parseGitSource, compareVersions } = mod

let failed = 0
function check(label, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  const ok = a === e
  if (!ok) failed += 1
  console.log(`   ${ok ? '✔' : '✘'} ${label}${ok ? '' : `\n       实际 ${a}\n       期望 ${e}`}`)
}

console.log('=== parseGitSource ===')
check('github shorthand', parseGitSource('github:TerebiSAMA/dsh-openviking-settings#7af63756213448d693fef60e33b7b8a9d53b3b91'),
  { owner: 'TerebiSAMA', repo: 'dsh-openviking-settings' })
check('github shorthand + 子目录', parseGitSource('github:owner/repo/path:packages/demo#0123456789abcdef0123456789abcdef01234567'),
  { owner: 'owner', repo: 'repo', path: 'packages/demo' })
check('git+https URL', parseGitSource('git+https://github.com/owner/repo.git#0123456789abcdef0123456789abcdef01234567'),
  { owner: 'owner', repo: 'repo' })
check('https URL', parseGitSource('https://github.com/owner/repo#0123456789abcdef0123456789abcdef01234567'),
  { owner: 'owner', repo: 'repo' })
check('registry spec 不算 git', parseGitSource('@openviking/dsh-memory-plugin@^0.5.36'), undefined)
check('undefined', parseGitSource(undefined), undefined)

console.log('\n=== compareVersions ===')
check('0.5.36 > 0.5.34', compareVersions('0.5.36', '0.5.34') > 0, true)
check('0.1.0 == 0.1.0', compareVersions('0.1.0', '0.1.0'), 0)
check('0.85.1 > 0.85.0', compareVersions('0.85.1', '0.85.0') > 0, true)
check('1.73.20 > 1.73.9', compareVersions('1.73.20', '1.73.9') > 0, true)
check('0.5.34 < 0.5.36', compareVersions('0.5.34', '0.5.36') < 0, true)
check('正式版 > 预发布', compareVersions('1.0.0', '1.0.0-rc.1') > 0, true)
check('预发布 < 预发布（字典序）', compareVersions('1.0.0-rc.1', '1.0.0-rc.2') < 0, true)

rmSync(dir, { recursive: true, force: true })
console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项不通过`)
process.exit(failed === 0 ? 0 : 1)
