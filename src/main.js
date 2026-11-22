import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style/theme.css'
import './style/markdown.css'
import 'katex/dist/katex.min.css'
import './lib/ripple.js'

createApp(App).use(router).mount('#app')
