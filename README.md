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

Each finding is printed with the type, location and rule on one line, then the explanation and the suggestion indented below (colored when stdout is a TTY; set `NO_COLOR` to disable):

```
error checkout_test.js:4  no-fixed-wait
   I.wait() sleeps unconditionally
   wait for a condition: I.waitForElement / I.waitForText / I.see
```

Exit codes: `0` no errors (warnings allowed), `1` errors found, `2` bad input or a file that can't be parsed.

## Rules

<!-- rules:start -->
| Rule | Default | Detects |
| --- | --- | --- |
| `no-fixed-wait` | error | I.wait(5) sleeps for a fixed time. Wait for a condition with I.waitForElement, I.waitForText or I.see |
| `no-sleep` | error | setTimeout, including window.setTimeout, await new Promise(r => setTimeout(r, ms)) and timers/promises, sleeps for a fixed time. Wait for a condition instead |
| `no-if-in-test` | error | if inside a Scenario or hook makes the test non-deterministic. Use tryTo() from codeceptjs/effects for optional steps |
| `no-fetch` | error | fetch() in tests or page objects, including window.fetch and globalThis.fetch, bypasses CodeceptJS steps and logs. Use the REST helper: I.sendGetRequest, I.sendPostRequest |
| `no-console` | warn | console.log in tests or page objects is not part of the test report. Use I.say() |
| `no-only` | error on CI, warn locally | Scenario.only, Feature.only and Data().only run only focused tests. Error on CI, warning locally |
| `no-pause` | error on CI, warn locally | pause() and this.pause() stop the test for interactive debugging. Error on CI, warning locally |
| `no-skip` | warn | Scenario.skip, Feature.skip, xScenario and xFeature leave tests out of the run |
| `secret-credentials` | error | Passwords, tokens and API keys passed to I.* in plain text are printed in logs. Wrap them with secret() |
| `await-grab` | error | I.grab*() returns a promise. Assigned, destructured or passed anywhere without await — including as an argument or object property, but not in Promise.all or .then() chains — it is a bug |
| `no-actor-in-helper` | error | I is not available inside a helper. Call other helpers via this.helpers[...] |
| `raw-browser-in-test` | warn | I.usePlaywrightTo, I.useWebDriverTo and I.executeScript in a Scenario. Move raw browser code into a helper or page object |
<!-- rules:end -->

Rules live as one file per rule in [`lib/rules/`](lib/rules); run `npm run docs` to regenerate this table after changing a rule.

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

A TypeScript config that imports `.js` paths of `.ts` files (the tsx/esbuild convention) can't be loaded by plain Node. If the linted project has `tsx` installed, the linter registers its loader automatically; otherwise loading such a config falls back to linting without it — pass paths explicitly in that case.

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
