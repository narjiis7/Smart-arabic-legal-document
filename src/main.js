import { mount } from 'svelte'
import './app.css'
import { initTheme } from './lib/theme.js'
import App from './App.svelte'

initTheme()
import { useMockAuth } from './lib/api.js'
import { logout } from './lib/auth.js'

/** إذا طفيت وضع MOCK، امسح جلسة التوكن الوهمي حتى يطلب الدخول من جديد */
if (!useMockAuth() && localStorage.getItem('accessToken') === 'mock-dev-token') {
  void logout();
}

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app
