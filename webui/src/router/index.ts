import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'stories',
      component: () => import('../pages/StoriesPage.vue'),
      meta: { title: 'Cerita Saya' },
    },
    {
      path: '/stories/new',
      name: 'new-story',
      component: () => import('../pages/NewStoryPage.vue'),
      meta: { title: 'Cerita Baru' },
    },
    {
      path: '/stories/:storyId/write',
      name: 'story-write',
      component: () => import('../pages/StoryWritePage.vue'),
      meta: { title: 'Tulis Cerita' },
    },
    {
      path: '/stories/:storyId/bible',
      name: 'story-bible',
      component: () => import('../pages/StoryBiblePage.vue'),
      meta: { title: 'Story Bible' },
    },
    {
      path: '/stories/:storyId/settings',
      name: 'story-settings',
      component: () => import('../pages/StorySettingsPage.vue'),
      meta: { title: 'Pengaturan Cerita' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} — AI Storyteller` : 'AI Storyteller'
})

export default router
