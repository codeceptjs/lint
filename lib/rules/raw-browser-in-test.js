import { Rule } from './base.js'
import { actorMethod, insideTest } from './utils.js'

export class RawBrowserInTest extends Rule {
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
    return { explanation: `I.${method} runs raw browser code in a test`, suggestion: 'move it into a helper or page object' }
  }
}
