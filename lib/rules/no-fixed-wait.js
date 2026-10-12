import { Rule } from './base.js'
import { actorMethod } from './utils.js'

export class NoFixedWait extends Rule {
  id = 'no-fixed-wait'
  description = 'I.wait(5) sleeps for a fixed time. Wait for a condition with I.waitForElement, I.waitForText or I.see'
  message = 'I.wait() sleeps unconditionally. Wait for a condition: I.waitForElement / I.waitForText / I.see'

  check(node) {
    if (actorMethod(node) !== 'wait') return
    if (typeof node.arguments[0]?.value !== 'number') return
    return this.message
  }
}
