export const TEST_BLOCKS = ['Scenario', 'Before', 'After', 'BeforeSuite', 'AfterSuite']
export const CREDENTIALS = /pass(word|wd)|(^|_)pass(_|$)|token|secret|api[\s_-]?key/i

export function actorMethod(node) {
  if (node.type !== 'CallExpression') return
  if (node.callee.type !== 'MemberExpression') return
  if (node.callee.object.name !== 'I') return
  return node.callee.property.name
}

export function insideTest(ancestors) {
  return ancestors.some(node => {
    if (node.type !== 'CallExpression') return false
    const callee = node.callee
    if (TEST_BLOCKS.includes(callee.name)) return true
    if (callee.type !== 'MemberExpression') return false
    return TEST_BLOCKS.includes(callee.object.name) || callee.property.name === 'Scenario'
  })
}

export function insideHelper(ancestors) {
  return ancestors.some(node => node.superClass && node.superClass.name === 'Helper')
}

export function isCalleeName(callee, name) {
  if (callee.type === 'Identifier') return callee.name === name
  if (callee.type !== 'MemberExpression' || callee.property?.name !== name) return false
  return callee.object.type === 'Identifier' && ['window', 'globalThis', 'global', 'self'].includes(callee.object.name)
}

export function envPropertyName(arg) {
  if (arg?.type !== 'MemberExpression') return
  if (arg.object?.type !== 'MemberExpression' || arg.object.property?.name !== 'env' || arg.object.object?.name !== 'process') return
  if (!arg.computed && arg.property?.type === 'Identifier') return arg.property.name
  if (arg.computed && arg.property?.type === 'Literal' && typeof arg.property.value === 'string') return arg.property.value
}
