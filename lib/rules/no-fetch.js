import { Rule } from './base.js'
import { insideHelper, isCalleeName } from './utils.js'

export class NoFetch extends Rule {
  id = 'no-fetch'
  description = 'fetch() in tests or page objects, including window.fetch and globalThis.fetch, bypasses CodeceptJS steps and logs. Use the REST helper: I.sendGetRequest, I.sendPostRequest'
  explanation = 'fetch() bypasses CodeceptJS steps and logs'
  suggestion = 'use the REST helper: I.sendGetRequest / I.sendPostRequest'

  check(node, ancestors) {
    if (node.type !== 'CallExpression' || !isCalleeName(node.callee, 'fetch')) return
    if (insideHelper(ancestors)) return
    return this.issue()
  }
}
