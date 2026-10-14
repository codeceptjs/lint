import { CommitRule } from './base.js'

export class NoOnly extends CommitRule {
  id = 'no-only'
  description = 'Scenario.only, Feature.only and Data().only run only focused tests. Error on CI, warning locally'

  check(node) {
    if (node.type !== 'MemberExpression' || node.property.name !== 'only') return
    const target = node.object.name || node.object.callee?.name
    if (!['Scenario', 'Feature', 'Data'].includes(target)) return
    return `${target}.only limits the run to focused tests. Remove it before commit`
  }
}
