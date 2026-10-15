export class Rule {
  get level() {
    return 'error'
  }

  issue() {
    return { explanation: this.explanation, suggestion: this.suggestion }
  }
}

export class CommitRule extends Rule {
  get level() {
    if (process.env.CI) return 'error'
    return 'warn'
  }
}
