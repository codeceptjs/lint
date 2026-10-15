import { Rule } from './base.js'
import { insideHelper } from './utils.js'

export class NoConsole extends Rule {
  id = 'no-console'
  description = 'console.log in tests or page objects is not part of the test report. Use I.say()'
  explanation = 'console output is not part of the test report'
  suggestion = 'use I.say()'

  get level() {
    return 'warn'
  }

  check(node, ancestors) {
    if (node.type !== 'CallExpression' || node.callee.object?.name !== 'console') return
    if (insideHelper(ancestors)) return
    return this.issue()
  }
}
