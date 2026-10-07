import fs from 'fs'
import path from 'path'
import module from 'module'
import { pathToFileURL } from 'url'
import * as acorn from 'acorn'
import * as walk from 'acorn-walk'
import { globSync } from 'glob'
import rules from './rules.js'

const EXTENSIONS = ['.js', '.ts', '.mjs', '.cjs']
const CONFIG_FILES = ['codecept.conf.js', 'codecept.conf.ts', 'codecept.conf.cjs', 'codecept.conf.mjs', 'codecept.config.js', 'codecept.config.ts']

export default class Linter {
  constructor(config = {}, root = process.cwd(), only = []) {
    this.config = config
    this.root = root
    this.levels = config.lint?.rules || {}
    this.rules = rules
    if (only.length) this.rules = rules.filter(rule => only.includes(rule.id))
  }

  static async load(configPath, only = []) {
    let file = configPath
    if (!file) file = CONFIG_FILES.find(name => fs.existsSync(name))
    if (!file) return new Linter({}, process.cwd(), only)
    file = path.resolve(file)
    const mod = await import(pathToFileURL(file))
    const config = mod.config || mod.default?.config || mod.default || {}
    return new Linter(config, path.dirname(file), only)
  }

  files(paths = []) {
    const files = []
    for (const pattern of paths) {
      if (fs.existsSync(pattern) && fs.statSync(pattern).isDirectory()) {
        files.push(
          ...globSync(`${pattern}/**/*.{js,ts,mjs,cjs}`, {
            absolute: true,
            ignore: '**/node_modules/**',
          }),
        )
      } else {
        files.push(...globSync(pattern, { absolute: true }))
      }
    }
    if (!paths.length) {
      for (const pattern of [].concat(this.config.tests || [])) {
        files.push(...globSync(pattern, { cwd: this.root, absolute: true }))
      }
      files.push(...this.supportFiles())
    }
    return [...new Set(files)].filter(file => EXTENSIONS.includes(path.extname(file)))
  }

  includes(file) {
    for (const pattern of [].concat(this.config.tests || [])) {
      if (path.matchesGlob(file, path.resolve(this.root, pattern))) return true
    }
    return this.supportFiles().includes(file)
  }

  supportFiles() {
    const entries = Object.values(this.config.include || {})
    for (const helper of Object.values(this.config.helpers || {})) entries.push(helper.require)
    const files = []
    for (const entry of entries) {
      if (typeof entry !== 'string' || !entry.startsWith('.')) continue
      const file = path.resolve(this.root, entry)
      for (const candidate of [file, ...EXTENSIONS.map(ext => file + ext)]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) files.push(candidate)
      }
    }
    return files
  }

  lintFile(file) {
    return this.lint(fs.readFileSync(file, 'utf8'), file)
  }

  lint(code, file) {
    if (file.endsWith('.ts')) code = module.stripTypeScriptTypes(code)

    const comments = []
    let ast
    try {
      ast = acorn.parse(code, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true,
        onComment: comments,
      })
    } catch (err) {
      comments.length = 0
      ast = acorn.parse(code, {
        ecmaVersion: 'latest',
        sourceType: 'script',
        locations: true,
        allowReturnOutsideFunction: true,
        onComment: comments,
      })
    }

    const disabled = []
    for (const comment of comments) {
      const [directive, rule] = comment.value.trim().split(/\s+/)
      if (directive === 'codeceptjs-lint-disable-line') disabled.push(`${comment.loc.start.line}:${rule}`)
      if (directive === 'codeceptjs-lint-disable-next-line') disabled.push(`${comment.loc.end.line + 1}:${rule}`)
    }

    const findings = []
    walk.fullAncestor(ast, (node, state, ancestors) => {
      for (const rule of this.rules) {
        const level = this.levels[rule.id] || rule.level
        if (level === 'off') continue
        const message = rule.check(node, ancestors)
        if (!message) continue
        const { line, column } = node.loc.start
        if (disabled.includes(`${line}:${rule.id}`)) continue
        findings.push({
          file,
          line,
          column: column + 1,
          rule: rule.id,
          level,
          message,
          source: code.slice(node.start, node.end),
        })
      }
    })
    return findings.sort((a, b) => a.line - b.line || a.column - b.column)
  }
}
