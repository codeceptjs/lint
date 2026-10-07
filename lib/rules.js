const TEST_BLOCKS = ['Scenario', 'Before', 'After', 'BeforeSuite', 'AfterSuite']
const CREDENTIALS = /pass(word|wd)|(^|_)pass(_|$)|token|secret|api[\s_-]?key/i

function actorMethod(node) {
  if (node.type !== 'CallExpression') return
  if (node.callee.type !== 'MemberExpression') return
  if (node.callee.object.name !== 'I') return
  return node.callee.property.name
}

function insideTest(ancestors) {
  return ancestors.some(node => {
    if (node.type !== 'CallExpression') return false
    const callee = node.callee
    if (TEST_BLOCKS.includes(callee.name)) return true
    if (callee.type !== 'MemberExpression') return false
    return TEST_BLOCKS.includes(callee.object.name) || callee.property.name === 'Scenario'
  })
}

function insideHelper(ancestors) {
  return ancestors.some(node => node.superClass && node.superClass.name === 'Helper')
}

class Rule {
  get level() {
    return 'error'
  }
}

class CommitRule extends Rule {
  get level() {
    if (process.env.CI) return 'error'
    return 'warn'
  }
}

class NoFixedWait extends Rule {
  id = 'no-fixed-wait'
  description = 'I.wait(5) sleeps for a fixed time. Wait for a condition with I.waitForElement, I.waitForText or I.see'

  check(node) {
    if (actorMethod(node) !== 'wait') return
    if (typeof node.arguments[0]?.value !== 'number') return
    return 'I.wait() sleeps unconditionally. Wait for a condition: I.waitForElement / I.waitForText / I.see'
  }
}

class NoSleep extends Rule {
  id = 'no-sleep'
  description = 'setTimeout, including await new Promise(r => setTimeout(r, ms)) and timers/promises, sleeps for a fixed time. Wait for a condition instead'

  check(node, ancestors) {
    if (node.type !== 'CallExpression' || node.callee.name !== 'setTimeout') return
    if (insideHelper(ancestors)) return
    return 'setTimeout pauses for a fixed time. Wait for a condition: I.waitForElement / I.waitForText / I.waitForFunction'
  }
}

class NoIfInTest extends Rule {
  id = 'no-if-in-test'
  description = 'if inside a Scenario or hook makes the test non-deterministic. Use tryTo() from codeceptjs/effects for optional steps'

  check(node, ancestors) {
    if (node.type !== 'IfStatement') return
    if (!insideTest(ancestors)) return
    return 'if makes the test non-deterministic. Use tryTo() from codeceptjs/effects for optional steps'
  }
}

class NoFetch extends Rule {
  id = 'no-fetch'
  description = 'fetch() in tests or page objects bypasses CodeceptJS steps and logs. Use the REST helper: I.sendGetRequest, I.sendPostRequest'

  check(node, ancestors) {
    if (node.type !== 'CallExpression' || node.callee.name !== 'fetch') return
    if (insideHelper(ancestors)) return
    return 'fetch() bypasses CodeceptJS steps and logs. Use the REST helper: I.sendGetRequest / I.sendPostRequest'
  }
}

class NoConsole extends Rule {
  id = 'no-console'
  description = 'console.log in tests or page objects is not part of the test report. Use I.say()'

  get level() {
    return 'warn'
  }

  check(node, ancestors) {
    if (node.type !== 'CallExpression' || node.callee.object?.name !== 'console') return
    if (insideHelper(ancestors)) return
    return 'console output is not part of the test report. Use I.say()'
  }
}

class NoOnly extends CommitRule {
  id = 'no-only'
  description = 'Scenario.only, Feature.only and Data().only run only focused tests. Error on CI, warning locally'

  check(node) {
    if (node.type !== 'MemberExpression' || node.property.name !== 'only') return
    const target = node.object.name || node.object.callee?.name
    if (!['Scenario', 'Feature', 'Data'].includes(target)) return
    return `${target}.only limits the run to focused tests. Remove it before commit`
  }
}

class NoPause extends CommitRule {
  id = 'no-pause'
  description = 'pause() stops the test for interactive debugging. Error on CI, warning locally'

  check(node) {
    if (node.type !== 'CallExpression' || node.callee.name !== 'pause') return
    return 'pause() stops the test for debugging. Remove it before commit'
  }
}

class NoSkip extends Rule {
  id = 'no-skip'
  description = 'Scenario.skip, Feature.skip, xScenario and xFeature leave tests out of the run'

  get level() {
    return 'warn'
  }

  check(node) {
    if (node.type !== 'CallExpression') return
    const callee = node.callee
    if (callee.name === 'xScenario' || callee.name === 'xFeature') return `${callee.name} skips the test`
    if (callee.property?.name !== 'skip') return
    if (!['Scenario', 'Feature'].includes(callee.object.name)) return
    return `${callee.object.name}.skip skips the test`
  }
}

class SecretCredentials extends Rule {
  id = 'secret-credentials'
  description = 'Passwords, tokens and API keys passed to I.* in plain text are printed in logs. Wrap them with secret()'

  check(node) {
    const method = actorMethod(node)
    if (!method) return
    for (const arg of node.arguments) {
      const env = arg.type === 'MemberExpression' && arg.object.property?.name === 'env' && arg.property.name
      if (env && CREDENTIALS.test(env)) return `process.env.${env} is printed in logs. Wrap it: secret(process.env.${env})`
    }
    if (method !== 'fillField') return
    const [locator, value] = node.arguments
    if (typeof locator?.value !== 'string' || !CREDENTIALS.test(locator.value)) return
    if (!value || value.callee?.name === 'secret') return
    return `I.fillField('${locator.value}', ...) types a credential that is printed in logs. Wrap the value: secret(...)`
  }
}

class AwaitGrab extends Rule {
  id = 'await-grab'
  description = 'I.grab*() returns a promise. Its result must be awaited before use'

  check(node, ancestors) {
    const method = actorMethod(node)
    if (!method || !method.startsWith('grab')) return
    const parent = ancestors[ancestors.length - 2]
    if (!['VariableDeclarator', 'AssignmentExpression', 'BinaryExpression', 'TemplateLiteral', 'MemberExpression'].includes(parent.type)) return
    return `I.${method}() returns a promise. Use: await I.${method}()`
  }
}

class NoActorInHelper extends Rule {
  id = 'no-actor-in-helper'
  description = 'I is not available inside a helper. Call other helpers via this.helpers[...]'

  check(node, ancestors) {
    if (node.type !== 'Identifier' || node.name !== 'I') return
    if (!insideHelper(ancestors)) return
    return 'I is not available inside a helper. Call other helpers via this.helpers[...]'
  }
}

class RawBrowserInTest extends Rule {
  id = 'raw-browser-in-test'
  description = 'I.usePlaywrightTo, I.useWebDriverTo and I.executeScript in a Scenario. Move raw browser code into a helper or page object'

  get level() {
    return 'warn'
  }

  check(node, ancestors) {
    const method = actorMethod(node)
    if (!method) return
    if (method !== 'executeScript' && !/^use\w+To$/.test(method)) return
    if (!insideTest(ancestors)) return
    return `I.${method} runs raw browser code in a test. Move it into a helper or page object`
  }
}

export default [
  new NoFixedWait(),
  new NoSleep(),
  new NoIfInTest(),
  new NoFetch(),
  new NoConsole(),
  new NoOnly(),
  new NoPause(),
  new NoSkip(),
  new SecretCredentials(),
  new AwaitGrab(),
  new NoActorInHelper(),
  new RawBrowserInTest(),
]
