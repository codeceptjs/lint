import { Rule } from './base.js'
import { actorMethod } from './utils.js'

const FLAGGED_PARENTS = ['VariableDeclarator', 'AssignmentExpression', 'BinaryExpression', 'TemplateLiteral', 'MemberExpression', 'CallExpression', 'Property']

export class AwaitGrab extends Rule {
  id = 'await-grab'
  description = 'I.grab*() returns a promise. Assigned, destructured or passed anywhere without await — including as an argument or object property, but not in Promise.all or .then() chains — it is a bug'

  check(node, ancestors) {
    const method = actorMethod(node)
    if (!method || !method.startsWith('grab')) return
    const parent = ancestors[ancestors.length - 2]
    if (parent.type === 'MemberExpression' && parent.object === node && ['then', 'catch', 'finally'].includes(parent.property?.name)) return
    if (!FLAGGED_PARENTS.includes(parent.type)) return
    return `I.${method}() returns a promise. Use: await I.${method}()`
  }
}
