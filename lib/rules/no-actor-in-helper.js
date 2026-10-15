import { Rule } from './base.js'
import { insideHelper } from './utils.js'

export class NoActorInHelper extends Rule {
  id = 'no-actor-in-helper'
  description = 'I is not available inside a helper. Call other helpers via this.helpers[...]'
  explanation = 'I is not available inside a helper'
  suggestion = 'call other helpers via this.helpers[...]'

  check(node, ancestors) {
    if (node.type !== 'Identifier' || node.name !== 'I') return
    if (!insideHelper(ancestors)) return
    return this.issue()
  }
}
