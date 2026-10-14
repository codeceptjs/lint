import { Rule } from './base.js'
import { insideTest } from './utils.js'

export class NoIfInTest extends Rule {
  id = 'no-if-in-test'
  description = 'if inside a Scenario or hook makes the test non-deterministic. Use tryTo() from codeceptjs/effects for optional steps'
  message = 'if makes the test non-deterministic. Use tryTo() from codeceptjs/effects for optional steps'

  check(node, ancestors) {
    if (node.type !== 'IfStatement') return
    if (!insideTest(ancestors)) return
    return this.message
  }
}
