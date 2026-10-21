import { CommitRule } from './base.js'

export class NoPause extends CommitRule {
  id = 'no-pause'
  description = 'pause() and this.pause() stop the test for interactive debugging. Error on CI, warning locally'
  explanation = 'pause() stops the test for interactive debugging'
  suggestion = 'remove it before commit'

  check(node) {
    if (node.type !== 'CallExpression') return
    const callee = node.callee
    const bare = callee.type === 'Identifier' && callee.name === 'pause'
    const thisPause = callee.type === 'MemberExpression' && callee.object.type === 'ThisExpression' && callee.property?.name === 'pause'
    if (!bare && !thisPause) return
    return this.issue()
  }
}
