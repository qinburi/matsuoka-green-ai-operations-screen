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
const V3AnalysisView = () => import('./views/V3AnalysisView.vue')
const V4HealthInterventionView = () => import('./views/V4HealthInterventionView.vue')
const V1OverviewView = () => import('./legacy/v1/V1OverviewView.vue')
const V1AnalysisView = () => import('./legacy/v1/V1AnalysisView.vue')

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'overview', component: OverviewView, meta: { uiVersion: CURRENT_PRODUCT_VERSION, viewKind: 'overview' } },
    { path: '/analysis', name: 'analysis', component: V4HealthInterventionView, meta: { uiVersion: CURRENT_PRODUCT_VERSION, viewKind: 'analysis' } },
    { path: '/v3/', alias: '/v3', name: 'v3-overview', component: OverviewView, meta: { uiVersion: 'v3.0.0', viewKind: 'overview' } },
    { path: '/v3/analysis', name: 'v3-analysis', component: V3AnalysisView, meta: { uiVersion: 'v3.0.0', viewKind: 'analysis' } },
    { path: '/v21/', alias: '/v21', name: 'v21-overview', component: OverviewView, meta: { uiVersion: 'v2.1.0', viewKind: 'overview' } },
    { path: '/v21/analysis', name: 'v21-analysis', component: AnalysisView, meta: { uiVersion: 'v2.1.0', viewKind: 'analysis' } },
    { path: '/v2/', alias: '/v2', name: 'v2-overview', component: OverviewView, meta: { uiVersion: 'v2.0.0', viewKind: 'overview' } },
    { path: '/v2/analysis', name: 'v2-analysis', component: AnalysisView, meta: { uiVersion: 'v2.0.0', viewKind: 'analysis' } },
    { path: '/v1/', alias: '/v1', name: 'v1-overview', component: V1OverviewView, meta: { uiVersion: 'v1.0.0', viewKind: 'overview' } },
    { path: '/v1/analysis', name: 'v1-analysis', component: V1AnalysisView, meta: { uiVersion: 'v1.0.0', viewKind: 'analysis' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
