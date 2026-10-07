# @codeceptjs/lint

Linter for [CodeceptJS](https://codecept.io) tests, page objects and helpers. It catches fixed sleeps, `if` in tests, raw `fetch()`, plain-text credentials, missing `await` on grabbers, and leftover `pause()` and `.only`. It reads files as an AST, so it doesn't need CodeceptJS installed or a browser running.

```bash
npx @codeceptjs/lint                          # files from codecept.conf.js
npx @codeceptjs/lint tests/ pages/login.js    # explicit paths
npx @codeceptjs/lint -r no-pause -r no-only   # only these rules
npx @codeceptjs/lint --rules no-pause,no-only
npx @codeceptjs/lint rules                    # list all rules
npx @codeceptjs/lint --json
npx @codeceptjs/lint -c e2e/codecept.conf.js
```

Without paths, the linter reads `codecept.conf.js` (or `.ts`, `.cjs`, `.mjs`) from the current directory. It lints files matched by `tests`, local files from `include` (page objects, steps file) and helpers loaded with `require`.

Each finding is printed on one line:

```
checkout_test.js:4:3  error  no-fixed-wait  I.wait() sleeps unconditionally. Wait for a condition: I.waitForElement / I.waitForText / I.see
```

Exit codes: `0` no errors (warnings allowed), `1` errors found, `2` bad input or a file that can't be parsed.

## Rules

| Rule | Default | Detects |
| --- | --- | --- |
| `no-fixed-wait` | error | `I.wait(5)` with a number. Use `I.waitForElement`, `I.waitForText`, `I.see` |
| `no-sleep` | error | `setTimeout`, including `await new Promise(r => setTimeout(r, ms))` and `timers/promises`, outside helpers |
| `no-if-in-test` | error | `if` inside a Scenario or hook. Use `tryTo()` from `codeceptjs/effects` |
| `no-fetch` | error | `fetch()` outside helpers. Use the REST helper: `I.sendGetRequest`, `I.sendPostRequest` |
| `no-console` | warn | `console.*` outside helpers. Use `I.say()` |
| `no-only` | error on CI, warn locally | `Scenario.only`, `Feature.only`, `Data(...).only` |
| `no-pause` | error on CI, warn locally | `pause()` |
| `no-skip` | warn | `Scenario.skip`, `Feature.skip`, `xScenario`, `xFeature` |
| `secret-credentials` | error | `I.fillField` on a password, token, secret or API key field, or such a `process.env.*` passed to `I.*`, without `secret()` |
| `await-grab` | error | `I.grab*()` assigned or used without `await` |
| `no-actor-in-helper` | error | `I` inside a class extending `Helper`. Use `this.helpers[...]` |
| `raw-browser-in-test` | warn | `I.use*To`, `I.executeScript` in a Scenario. Move it into a helper or page object |

"On CI" means the `CI` environment variable is set, which every CI provider does. Locally `pause()` and `.only` stay warnings, so a debugging stub doesn't fail the lint.

## Configuration

Set rule levels in a `lint` section of `codecept.conf.js`:

```js
export const config = {
  tests: './*_test.js',
  lint: {
    rules: { 'no-if-in-test': 'warn', 'raw-browser-in-test': 'off' },
  },
}
```

Levels are `error`, `warn` or `off`.

To allow a single case, suppress it inline. The rule id is required:

```js
I.wait(1) // codeceptjs-lint-disable-line no-fixed-wait

// codeceptjs-lint-disable-next-line no-fixed-wait
I.wait(1)
```

TypeScript is read with Node's type stripping (Node 22.13+). Files that use `enum` or `namespace` are reported as parse errors.

## CI

```yaml
- run: npx @codeceptjs/lint
- run: npx codeceptjs run
```

## Claude Code Hook

The linter can block a bad edit before an agent writes it. Add a `PreToolUse` hook to `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [{ "type": "command", "command": "npx @codeceptjs/lint --hook claude" }]
      }
    ]
  }
}
```

The hook checks only files the config lints. It builds the file as it would look after the edit, and blocks the edit only when it adds a new error. Errors already in the file and warnings never block, so an agent can still add a `pause()` stub or touch a legacy test. If the hook fails, the edit is allowed.

## API

```js
import Linter from '@codeceptjs/lint'

const linter = await Linter.load('codecept.conf.js')
for (const file of linter.files()) console.log(linter.lintFile(file))
```

## License

MIT
