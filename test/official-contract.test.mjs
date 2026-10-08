import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { transform } from 'esbuild'
const source='D:/Deepseek Harness/packages/boot/plugin-manager/src/install-spec.ts'
test('installed official parser accepts exact github commit spec',{skip:!existsSync(source)},async()=>{
  const result=await transform(readFileSync(source,'utf8'),{loader:'ts',format:'cjs',target:'node22'})
  const module={exports:{}}
  vm.runInNewContext(result.code,{module,exports:module.exports,require:createRequire(import.meta.url)})
  const parsed=module.exports.parseInstallSpec('github:alice/demo#'+'a'.repeat(40))
  assert.equal(parsed.kind,'git');assert.equal(parsed.host,'github.com');assert.equal(parsed.spec,'github:alice/demo#'+'a'.repeat(40))
})
