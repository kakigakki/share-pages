import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { initDocumentLocale } from './i18n'

initDocumentLocale()
createApp(App).mount('#app')
