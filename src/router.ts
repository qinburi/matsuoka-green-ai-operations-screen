import { createRouter, createWebHashHistory } from 'vue-router'
import { CURRENT_PRODUCT_VERSION } from './version'

declare module 'vue-router' {
  interface RouteMeta {
    uiVersion: string
    viewKind: 'overview' | 'analysis'
  }
}

const OverviewView = () => import('./views/OverviewView.vue')
const AnalysisView = () => import('./views/AnalysisView.vue')
const V1OverviewView = () => import('./legacy/v1/V1OverviewView.vue')
const V1AnalysisView = () => import('./legacy/v1/V1AnalysisView.vue')

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'overview', component: OverviewView, meta: { uiVersion: CURRENT_PRODUCT_VERSION, viewKind: 'overview' } },
    { path: '/analysis', name: 'analysis', component: AnalysisView, meta: { uiVersion: CURRENT_PRODUCT_VERSION, viewKind: 'analysis' } },
    { path: '/v2/', alias: '/v2', name: 'v2-overview', component: OverviewView, meta: { uiVersion: 'v2.0.0', viewKind: 'overview' } },
    { path: '/v2/analysis', name: 'v2-analysis', component: AnalysisView, meta: { uiVersion: 'v2.0.0', viewKind: 'analysis' } },
    { path: '/v1/', alias: '/v1', name: 'v1-overview', component: V1OverviewView, meta: { uiVersion: 'v1.0.0', viewKind: 'overview' } },
    { path: '/v1/analysis', name: 'v1-analysis', component: V1AnalysisView, meta: { uiVersion: 'v1.0.0', viewKind: 'analysis' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
