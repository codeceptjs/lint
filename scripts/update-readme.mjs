import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import rules from '../lib/rules/index.js'
import { CommitRule } from '../lib/rules/base.js'

const readme = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'README.md')
const rows = rules.map(rule => `| \`${rule.id}\` | ${rule instanceof CommitRule ? 'error on CI, warn locally' : rule.level} | ${rule.description} |`)
const table = ['<!-- rules:start -->', '| Rule | Default | Detects |', '| --- | --- | --- |', ...rows, '<!-- rules:end -->'].join('\n')

const content = fs.readFileSync(readme, 'utf8')
const updated = content.replace(/<!-- rules:start -->[\s\S]*<!-- rules:end -->/, table)
if (updated === content && !content.includes('<!-- rules:start -->')) {
  console.error('No <!-- rules:start -->...<!-- rules:end --> block found in README.md')
  process.exit(1)
}
fs.writeFileSync(readme, updated)
console.log(`README.md updated with ${rules.length} rules`)
