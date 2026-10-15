import { expect } from 'chai'
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import Linter from '../lib/Linter.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const project = path.join(__dirname, 'project')
const bin = path.join(__dirname, '../bin/lint.js')

const lint = (code, file = 'test.js') => new Linter().lint(code, file)
const rules = code => lint(code).map(f => `${f.line}:${f.rule}`)

const run = (args, input) =>
  spawnSync(process.execPath, [bin, ...args], {
    cwd: project,
    input,
    encoding: 'utf8',
    env: { ...process.env, CI: '' },
  })

const hook = payload => run(['--hook', 'claude'], JSON.stringify(payload))

describe('@codeceptjs/lint', () => {
  let ci

  beforeEach(() => {
    ci = process.env.CI
    delete process.env.CI
  })

  afterEach(() => {
    if (ci !== undefined) process.env.CI = ci
  })

  describe('rules', () => {
    it('no-fixed-wait', () => {
      expect(rules("I.wait(5)\nI.waitForElement('#a', 5)\nI.wait(timeout)")).to.deep.equal(['1:no-fixed-wait'])
    })

    it('no-sleep', () => {
      const code = "import { setTimeout } from 'timers/promises'\nScenario('a', async ({ I }) => {\n  await new Promise(r => setTimeout(r, 100))\n  await setTimeout(100)\n})"
      expect(rules(code)).to.deep.equal(['3:no-sleep', '4:no-sleep'])
      expect(rules('class X extends Helper {\n  m() { setTimeout(() => {}, 1) }\n}')).to.deep.equal([])
    })

    it('no-sleep catches window.setTimeout and globalThis.setTimeout', () => {
      const code = 'window.setTimeout(() => {}, 1)\nglobalThis.setTimeout(() => {}, 1)\nself.setTimeout(() => {}, 1)\nfoo.setTimeout(() => {}, 1)\nclass X extends Helper {\n  m() { window.setTimeout(() => {}, 1) }\n}'
      expect(rules(code)).to.deep.equal(['1:no-sleep', '2:no-sleep', '3:no-sleep'])
    })

    it('no-if-in-test', () => {
      const code = "Scenario('a', ({ I }) => {\n  if (x) I.click('a')\n})\nBefore(({ I }) => {\n  if (y) I.click('b')\n})\nfunction f() {\n  if (z) return\n}"
      expect(rules(code)).to.deep.equal(['2:no-if-in-test', '5:no-if-in-test'])
      expect(rules("Data([1]).Scenario('d', ({ I }) => {\n  if (x) I.click('a')\n})")).to.deep.equal(['2:no-if-in-test'])
    })

    it('no-fetch', () => {
      expect(rules("await fetch('/api')\nclass X extends Helper {\n  m() { fetch('/api') }\n}")).to.deep.equal(['1:no-fetch'])
    })

    it('no-fetch catches window.fetch and globalThis.fetch', () => {
      const code = "window.fetch('/api')\nglobalThis.fetch('/api')\nfoo.fetch('/api')\nclass X extends Helper {\n  m() { globalThis.fetch('/api') }\n}"
      expect(rules(code)).to.deep.equal(['1:no-fetch', '2:no-fetch'])
    })

    it('no-console', () => {
      const findings = lint("console.log('a')\nconsole.error('b')\nclass X extends Helper {\n  m() { console.log('c') }\n}")
      expect(findings.map(f => `${f.line}:${f.rule}:${f.level}`)).to.deep.equal(['1:no-console:warn', '2:no-console:warn'])
    })

    it('no-only and no-pause are warnings locally and errors on CI', () => {
      const code = "Scenario.only('a', () => {})\nFeature.only('f')\nData([]).only.Scenario('d', () => {})\npause()"
      expect(lint(code).map(f => `${f.rule}:${f.level}`)).to.deep.equal(['no-only:warn', 'no-only:warn', 'no-only:warn', 'no-pause:warn'])
      process.env.CI = 'true'
      expect(lint(code).map(f => f.level)).to.deep.equal(['error', 'error', 'error', 'error'])
    })

    it('no-pause catches this.pause()', () => {
      expect(rules('this.pause()\nobj.pause()')).to.deep.equal(['1:no-pause'])
    })

    it('no-skip', () => {
      expect(rules("Scenario.skip('a', () => {})\nxScenario('b', () => {})\nFeature.skip('f')\nScenario('c', () => {})")).to.deep.equal(['1:no-skip', '2:no-skip', '3:no-skip'])
    })

    it('secret-credentials', () => {
      const code = [
        "I.fillField('Password', '123456')",
        "I.fillField('Password', secret('123456'))",
        "I.fillField('Email', 'a@b.c')",
        'I.fillField(loc, process.env.API_TOKEN)',
        'I.fillField(loc, secret(process.env.API_TOKEN))',
      ].join('\n')
      expect(rules(code)).to.deep.equal(['1:secret-credentials', '4:secret-credentials'])
    })

    it('secret-credentials catches computed env access and only process.env', () => {
      const code = [
        "I.fillField(loc, process.env['PASSWORD'])",
        "I.fillField(loc, secret(process.env['PASSWORD']))",
        "I.fillField(loc, process.env['api-key'])",
        "I.fillField(loc, process.env['USERNAME'])",
        'I.fillField(loc, foo.env.TOKEN)',
      ].join('\n')
      expect(rules(code)).to.deep.equal(['1:secret-credentials', '3:secret-credentials'])
    })

    it('await-grab', () => {
      const code = ['const a = I.grabTextFrom("h1")', 'const b = await I.grabTextFrom("h1")', 'return I.grabTextFrom("h1")', 'I.grabTextFrom("h1").length', 'await Promise.all([I.grabTitle()])'].join('\n')
      expect(lint(`async function f() {\n${code}\n}`).map(f => `${f.line}:${f.rule}`)).to.deep.equal(['2:await-grab', '5:await-grab'])
    })

    it('await-grab allows promise chains, flags destructuring, arguments and properties', () => {
      const code = ['const { text } = I.grabTextFrom("h1")', 'I.grabTextFrom("h1").then(t => t)', 'I.grabTextFrom("h1").catch(e => e)', 'I.see(I.grabTextFrom("h1"))', 'const o = { title: I.grabTitle() }'].join('\n')
      expect(lint(`async function f() {\n${code}\n}`).map(f => `${f.line}:${f.rule}`)).to.deep.equal(['2:await-grab', '5:await-grab', '6:await-grab'])
    })

    it('no-actor-in-helper', () => {
      expect(rules('class X extends Helper {\n  m() {\n    I.click("a")\n  }\n}\nI.click("b")')).to.deep.equal(['3:no-actor-in-helper'])
    })

    it('raw-browser-in-test', () => {
      const code = "Scenario('a', ({ I }) => {\n  I.usePlaywrightTo('x', () => {})\n  I.executeScript(() => 1)\n})\nI.executeScript(() => 1)"
      expect(rules(code)).to.deep.equal(['2:raw-browser-in-test', '3:raw-browser-in-test'])
    })
  })

  it('suppresses a rule with a comment', () => {
    const code = 'I.wait(1) // codeceptjs-lint-disable-line no-fixed-wait\n// codeceptjs-lint-disable-next-line no-fixed-wait\nI.wait(2)\nI.wait(3)'
    expect(rules(code)).to.deep.equal(['4:no-fixed-wait'])
  })

  it('sets rule levels from config', () => {
    const linter = new Linter({
      lint: { rules: { 'no-fixed-wait': 'off', 'no-pause': 'error' } },
    })
    expect(linter.lint('I.wait(1)\npause()', 'test.js').map(f => `${f.rule}:${f.level}`)).to.deep.equal(['no-pause:error'])
  })

  it('runs only selected rules', () => {
    const linter = new Linter({}, process.cwd(), ['no-pause'])
    expect(linter.lint('I.wait(1)\npause()', 'test.js').map(f => f.rule)).to.deep.equal(['no-pause'])
  })

  it('lints TypeScript with correct lines', () => {
    expect(lint('const n: number = 5\n\nI.wait(n as number)\nI.wait(5)', 'test.ts').map(f => f.line)).to.deep.equal([4])
  })

  it('parses CommonJS files', () => {
    expect(rules("const x = require('x')\nreturn I.wait(1)")).to.deep.equal(['2:no-fixed-wait'])
  })

  it('truncates finding source to a single line', () => {
    const code = "Scenario('a', ({ I }) => {\n  if (x) {\n    I.click('a')\n    I.click('b')\n  }\n})"
    const [finding] = lint(code)
    expect(finding.source).to.equal('if (x) {')
    expect(lint('I.wait(5)')[0].source).to.equal('I.wait(5)')
    const long = `I.fillField('${'password'.repeat(50)}', 'v')`
    expect(lint(long)[0].source.length).to.be.at.most(120)
    expect(lint(long)[0].source.endsWith('...')).to.be.true
  })

  it('includes the file in parse errors', () => {
    try {
      lint('const =', 'bad.js')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err.message).to.match(/^bad\.js: /)
      expect(err.file).to.equal('bad.js')
    }
  })

  it('keeps one rule per file in lib/rules', async () => {
    const rules = (await import('../lib/rules/index.js')).default
    const files = fs.readdirSync(path.join(__dirname, '../lib/rules')).filter(f => f.endsWith('.js') && !['base.js', 'utils.js', 'index.js'].includes(f))
    expect(rules.map(rule => rule.id)).to.have.lengthOf(files.length)
    for (const rule of rules) {
      expect(files).to.include(`${rule.id}.js`)
    }
    expect(new Set(rules.map(rule => rule.id)).size).to.equal(rules.length)
  })

  it('collects tests, include and helper files from config', async () => {
    const linter = await Linter.load(path.join(project, 'codecept.conf.js'))
    const files = linter
      .files()
      .map(f => path.relative(project, f).replaceAll('\\', '/'))
      .sort()
    expect(files).to.deep.equal(['checkout_test.js', 'custom_helper.js', 'existing_test.js', 'pages/login.js', 'steps_file.js'])
    expect(linter.includes(path.join(project, 'new_test.js'))).to.be.true
    expect(linter.includes(path.join(project, 'app.js'))).to.be.false
  })

  describe('CLI', () => {
    it('lints files from codecept config', () => {
      const result = run([])
      expect(result.stdout).to.include('error checkout_test.js:4  no-fixed-wait')
      expect(result.stdout).to.include('custom_helper.js:5  no-actor-in-helper')
      expect(result.stdout).to.include('pages/login.js:5  no-fetch')
      expect(result.stdout).not.to.include('raw-browser-in-test')
      expect(result.stdout).not.to.include('no-sleep')
      expect(result.status).to.equal(1)
    })

    it('filters rules with -r and --rules', () => {
      expect(run(['-r', 'no-fetch']).stdout).not.to.include('no-fixed-wait')
      expect(run(['--rules', 'no-fetch,no-actor-in-helper']).stdout).to.include('no-actor-in-helper')
      expect(run(['-r', 'nope']).status).to.equal(2)
    })

    it('reports parse errors with exit code 2', () => {
      const result = run(['bad_syntax.js'])
      expect(result.status).to.equal(2)
      expect(result.stderr).to.include('bad_syntax.js')
      expect(result.stderr).to.include('parse error')
    })

    it('prints findings as JSON with --json', () => {
      const result = run(['--json'])
      const findings = JSON.parse(result.stdout)
      expect(findings).to.be.an('array').with.length.greaterThan(0)
      for (const key of ['file', 'line', 'column', 'rule', 'level', 'explanation', 'suggestion', 'message', 'source']) {
        expect(findings[0]).to.have.property(key)
      }
      for (const finding of findings) {
        expect(finding.level).to.be.oneOf(['error', 'warn'])
      }
      expect(result.status).to.equal(1)
    })

    it('prints one finding as type, location and rule followed by explanation and suggestion', () => {
      const result = run(['-r', 'no-fixed-wait', 'checkout_test.js'])
      expect(result.stdout).to.include('error checkout_test.js:4  no-fixed-wait\n   I.wait() sleeps unconditionally\n   wait for a condition: I.waitForElement / I.waitForText / I.see')
      expect(result.stdout).to.include('1 file(s) checked, 1 error(s), 0 warning(s)')
      expect(result.stdout).to.not.include('\x1b[')
    })

    it('lists rules', () => {
      const result = run(['rules'])
      expect(result.stdout).to.include('no-if-in-test')
      expect(result.stdout).to.include('tryTo()')
      expect(result.status).to.equal(0)
    })

    it('lints explicit paths without a config', () => {
      const result = spawnSync(process.execPath, [bin, path.join(project, 'checkout_test.js')], { cwd: __dirname, encoding: 'utf8' })
      expect(result.stdout).to.include('raw-browser-in-test')
    })
  })

  describe('hook', () => {
    it('blocks a write that adds an error', () => {
      const result = hook({
        tool_name: 'Write',
        tool_input: {
          file_path: path.join(project, 'new_test.js'),
          content: "Scenario('a', ({ I }) => {\n  I.wait(3)\n})\n",
        },
      })
      expect(result.status).to.equal(2)
      expect(result.stderr).to.include('error new_test.js:2  no-fixed-wait')
      expect(result.stderr).to.include('I.wait() sleeps unconditionally')
      expect(result.stderr).to.include('wait for a condition: I.waitForElement')
    })

    it('allows an edit that keeps existing errors', () => {
      const result = hook({
        tool_name: 'Edit',
        tool_input: {
          file_path: path.join(project, 'existing_test.js'),
          old_string: "I.see('Welcome')",
          new_string: "I.see('Hello')",
        },
      })
      expect(result.status).to.equal(0)
    })

    it('blocks an edit that adds a second identical error', () => {
      const result = hook({
        tool_name: 'Edit',
        tool_input: {
          file_path: path.join(project, 'existing_test.js'),
          old_string: "I.see('Welcome')",
          new_string: "I.wait(5)\n  I.see('Welcome')",
        },
      })
      expect(result.status).to.equal(2)
    })

    it('allows warnings, files outside the config and bad payloads', () => {
      expect(
        hook({
          tool_name: 'Write',
          tool_input: {
            file_path: path.join(project, 'new_test.js'),
            content: 'pause()',
          },
        }).status,
      ).to.equal(0)
      expect(
        hook({
          tool_name: 'Write',
          tool_input: {
            file_path: path.join(project, 'app.js'),
            content: 'I.wait(1)',
          },
        }).status,
      ).to.equal(0)
      expect(hook({ nonsense: true }).status).to.equal(0)
    })

    it('does not write files', () => {
      expect(fs.existsSync(path.join(project, 'new_test.js'))).to.be.false
    })
  })
})
