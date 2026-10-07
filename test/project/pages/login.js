const { I } = inject()

export default {
  async login() {
    await fetch('/api/login')
  },
}
