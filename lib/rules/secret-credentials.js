import { Rule } from './base.js'
import { actorMethod, CREDENTIALS, envPropertyName } from './utils.js'

export class SecretCredentials extends Rule {
  id = 'secret-credentials'
  description = 'Passwords, tokens and API keys passed to I.* in plain text are printed in logs. Wrap them with secret()'

  check(node) {
    const method = actorMethod(node)
    if (!method) return
    for (const arg of node.arguments) {
      const env = envPropertyName(arg)
      if (env && CREDENTIALS.test(env)) return { explanation: `process.env.${env} is printed in logs`, suggestion: `wrap it: secret(process.env.${env})` }
    }
    if (method !== 'fillField') return
    const [locator, value] = node.arguments
    if (typeof locator?.value !== 'string' || !CREDENTIALS.test(locator.value)) return
    if (!value || value.callee?.name === 'secret') return
    return { explanation: `I.fillField('${locator.value}', ...) types a credential that is printed in logs`, suggestion: 'wrap the value: secret(...)' }
  }
}
