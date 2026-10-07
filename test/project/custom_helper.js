import Helper from '@codeceptjs/helper'

class Custom extends Helper {
  hello() {
    const { I } = inject()
    setTimeout(() => {}, 10)
  }
}

export default Custom
