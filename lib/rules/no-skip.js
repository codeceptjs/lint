import { Rule } from './base.js'

export class NoSkip extends Rule {
  id = 'no-skip'
  description = 'Scenario.skip, Feature.skip, xScenario and xFeature leave tests out of the run'

  get level() {
    return 'warn'
  }

  check(node) {
    if (node.type !== 'CallExpression') return
    const callee = node.callee
    if (callee.name === 'xScenario' || callee.name === 'xFeature') return `${callee.name} skips the test`
    if (callee.property?.name !== 'skip') return
    if (!['Scenario', 'Feature'].includes(callee.object.name)) return
    return `${callee.object.name}.skip skips the test`
  }
}
