import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import './custom.css'
import './home/home.css'
import './tutorials/tutorials.css'

export default {
  extends: DefaultTheme,
  Layout,
}
