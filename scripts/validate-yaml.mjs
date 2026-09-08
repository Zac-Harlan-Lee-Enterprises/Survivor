#!/usr/bin/env node
// validate-yaml.mjs — parses YAML files (or stdin with --stdin) and exits
// non-zero on the first syntax error. Used by the pre-commit hook and the
// quality sweep for .github/workflows/*.yml and infra/template.yaml.
import { readFileSync } from 'node:fs'
import { parseAllDocuments } from 'yaml'

const args = process.argv.slice(2)
const sources = args.includes('--stdin')
  ? [['<stdin>', readFileSync(0, 'utf8')]]
  : args.map((f) => [f, readFileSync(f, 'utf8')])
let bad = 0
for (const [name, text] of sources) {
  // CloudFormation intrinsic tags (!Ref, !Sub, !GetAtt …) are unknown to the
  // parser; treat them as plain scalars so the structure still validates.
  const docs = parseAllDocuments(text, { customTags: ['timestamp'], logLevel: 'silent' })
  for (const doc of docs) {
    const errors = doc.errors.filter((e) => !/unresolved tag/i.test(e.message))
    if (errors.length > 0) {
      bad += 1
      console.error(`${name}: ${errors[0].message.split('\n')[0]}`)
    }
  }
}
if (bad === 0 && !args.includes('--stdin'))
  console.log(`yaml ok: ${sources.map(([n]) => n).join(', ')}`)
process.exit(bad === 0 ? 0 : 1)
