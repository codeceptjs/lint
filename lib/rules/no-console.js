import { Rule } from './base.js'
import { insideHelper } from './utils.js'

export class NoConsole extends Rule {
  id = 'no-console'
  description = 'console.log in tests or page objects is not part of the test report. Use I.say()'
  message = 'console output is not part of the test report. Use I.say()'

  get level() {
    return 'warn'
  }

  check(node, ancestors) {
    if (node.type !== 'CallExpression' || node.callee.object?.name !== 'console') return
    if (insideHelper(ancestors)) return
    return this.message
  }
}
