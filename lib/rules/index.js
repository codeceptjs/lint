import { NoFixedWait } from './no-fixed-wait.js'
import { NoSleep } from './no-sleep.js'
import { NoIfInTest } from './no-if-in-test.js'
import { NoFetch } from './no-fetch.js'
import { NoConsole } from './no-console.js'
import { NoOnly } from './no-only.js'
import { NoPause } from './no-pause.js'
import { NoSkip } from './no-skip.js'
import { SecretCredentials } from './secret-credentials.js'
import { AwaitGrab } from './await-grab.js'
import { NoActorInHelper } from './no-actor-in-helper.js'
import { RawBrowserInTest } from './raw-browser-in-test.js'

export default [
  new NoFixedWait(),
  new NoSleep(),
  new NoIfInTest(),
  new NoFetch(),
  new NoConsole(),
  new NoOnly(),
  new NoPause(),
  new NoSkip(),
  new SecretCredentials(),
  new AwaitGrab(),
  new NoActorInHelper(),
  new RawBrowserInTest(),
]
