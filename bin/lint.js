#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { parseArgs } from 'util'
import Linter from '../lib/Linter.js'
import rules from '../lib/rules.js'

const { values: options, positionals: paths } = parseArgs({
  allowPositionals: true,
  options: {
    config: { type: 'string', short: 'c' },
    rules: { type: 'string', short: 'r', multiple: true },
    json: { type: 'boolean' },
    hook: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
})

if (options.help) {
  console.log(`Usage: npx @codeceptjs/lint [paths...] [options]
       npx @codeceptjs/lint rules

Lints CodeceptJS tests, page objects and helpers. Without paths, lints files from codecept.conf.js.

Options:
  -c, --config <file>   codecept config to read tests, include, helpers and lint.rules from
  -r, --rules <rules>   run only these rules: -r no-pause -r no-only or --rules no-pause,no-only
  --json                print findings as JSON
  --hook claude         run as a Claude Code PreToolUse hook, reading the payload from stdin
  -h, --help            show this help`)
  process.exit(0)
}

if (paths[0] === 'rules') {
  for (const rule of rules) console.log(`${rule.id.padEnd(20)} ${rule.level.padEnd(6)} ${rule.description}`)
  process.exit(0)
}

const only = (options.rules || []).flatMap(value => value.split(',')).map(id => id.trim())
const unknown = only.filter(id => !rules.some(rule => rule.id === id))
if (unknown.length) {
  console.error(`Unknown rules: ${unknown.join(', ')}. Run: npx @codeceptjs/lint rules`)
  process.exit(2)
}

let linter
try {
  linter = await Linter.load(options.config, only)
} catch (err) {
  if (options.hook) process.exit(0)
  console.error(`Could not load config, linting without it: ${err.message}`)
  linter = new Linter({}, process.cwd(), only)
}

if (options.hook) {
  await hook(linter)
  process.exit(process.exitCode)
}

const files = linter.files(paths)
if (!files.length) {
  console.error('No files to lint. Pass paths or run in a directory with codecept.conf.js')
  process.exit(2)
}

const findings = []
for (const file of files) {
  try {
    findings.push(...linter.lintFile(file))
  } catch (err) {
    process.exitCode = 2
    console.error(`${path.relative(process.cwd(), file)}  parse error  ${err.message}`)
  }
}

const errors = findings.filter(f => f.level === 'error').length
if (options.json) {
  console.log(JSON.stringify(findings, null, 2))
} else {
  for (const finding of findings) console.log(format(finding))
  console.log(`${files.length} file(s) checked, ${errors} error(s), ${findings.length - errors} warning(s)`)
}
if (errors && !process.exitCode) process.exitCode = 1

async function hook(linter) {
  let data = ''
  for await (const chunk of process.stdin) data += chunk

  try {
    const { tool_name: tool, tool_input: input } = JSON.parse(data)
    const file = path.resolve(input.file_path)
    if (!linter.includes(file)) return

    let before = ''
    if (fs.existsSync(file)) before = fs.readFileSync(file, 'utf8')

    let after = input.content
    if (tool !== 'Write') {
      after = before
      for (const edit of input.edits || [input]) {
        if (edit.replace_all) after = after.replaceAll(edit.old_string, () => edit.new_string)
        else after = after.replace(edit.old_string, () => edit.new_string)
      }
    }

    const existing = linter
      .lint(before, file)
      .filter(f => f.level === 'error')
      .map(f => `${f.rule}:${f.source}`)
    const added = []
    for (const finding of linter.lint(after, file)) {
      if (finding.level !== 'error') continue
      const index = existing.indexOf(`${finding.rule}:${finding.source}`)
      if (index >= 0) existing.splice(index, 1)
      else added.push(finding)
    }
    if (!added.length) return

    console.error(`@codeceptjs/lint blocked this edit:\n${added.map(format).join('\n')}\nFix the code and retry.`)
    process.exitCode = 2
  } catch (err) {
    process.exitCode = 0
  }
}

function format(finding) {
  return `${path.relative(process.cwd(), finding.file)}:${finding.line}:${finding.column}  ${finding.level}  ${finding.rule}  ${finding.message}`
}
