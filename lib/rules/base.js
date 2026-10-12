export class Rule {
  get level() {
    return 'error'
  }
}

export class CommitRule extends Rule {
  get level() {
    if (process.env.CI) return 'error'
    return 'warn'
  }
}
