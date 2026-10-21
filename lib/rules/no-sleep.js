import { Rule } from './base.js'
import { insideHelper, isCalleeName } from './utils.js'

export class NoSleep extends Rule {
  id = 'no-sleep'
  description = 'setTimeout, including window.setTimeout, await new Promise(r => setTimeout(r, ms)) and timers/promises, sleeps for a fixed time. Wait for a condition instead'
  explanation = 'setTimeout pauses for a fixed time'
  suggestion = 'wait for a condition: I.waitForElement / I.waitForText / I.waitForFunction'

  check(node, ancestors) {
    if (node.type !== 'CallExpression' || !isCalleeName(node.callee, 'setTimeout')) return
    if (insideHelper(ancestors)) return
    return this.issue()
  }
}
