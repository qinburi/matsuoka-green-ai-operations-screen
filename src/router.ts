import { createRouter, createWebHashHistory } from 'vue-router'

const OverviewView = () => import('./views/OverviewView.vue')
const AnalysisView = () => import('./views/AnalysisView.vue')

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'overview', component: OverviewView },
    { path: '/analysis', name: 'analysis', component: AnalysisView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
