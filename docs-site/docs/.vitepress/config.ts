import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Second Brain',
  description: 'AI-powered personal knowledge management system — local-first, open source',
  lang: 'en-US',
  base: '/',

  head: [
    ['meta', { name: 'theme-color', content: '#7a8b75' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:title', content: 'Second Brain Docs' }],
    ['meta', { name: 'og:description', content: 'AI-powered personal knowledge management — Notion-like editor, Obsidian backlinks, local AI.' }],
  ],

  themeConfig: {
    logo: '✧',
    siteTitle: 'Second Brain',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API Reference', link: '/api/overview' },
      { text: 'Plugin Dev', link: '/plugins/overview' },
      {
        text: 'v0.1.0',
        items: [
          { text: 'Changelog', link: '/changelog' },
          { text: 'GitHub', link: 'https://github.com/rohitvaddepalli/AI-Personal-Knowledge' },
        ]
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/getting-started' },
            { text: 'Configuration', link: '/guide/configuration' },
          ]
        },
        {
          text: 'Features',
          items: [
            { text: 'Block Editor', link: '/guide/features/block-editor' },
            { text: 'AI Chat & Ask Brain', link: '/guide/features/ai-chat' },
            { text: 'Database Views', link: '/guide/features/database-views' },
            { text: 'Backlinks & Graph', link: '/guide/features/backlinks' },
            { text: 'Voice Memos', link: '/guide/features/voice-memos' },
            { text: 'Prompts Library', link: '/guide/features/prompts-library' },
            { text: 'Collections & Tags', link: '/guide/features/collections' },
          ]
        },
        {
          text: 'Architecture',
          items: [
            { text: 'Frontend (React + Tauri)', link: '/guide/architecture/frontend' },
            { text: 'Backend (FastAPI)', link: '/guide/architecture/backend' },
            { text: 'AI Pipeline', link: '/guide/architecture/ai-pipeline' },
          ]
        }
      ],
      '/api/': [
        {
          text: 'REST API',
          items: [
            { text: 'Overview', link: '/api/overview' },
            { text: 'Notes', link: '/api/notes' },
            { text: 'Collections', link: '/api/collections' },
            { text: 'Search', link: '/api/search' },
            { text: 'AI & Ask', link: '/api/ai' },
            { text: 'Voice', link: '/api/voice' },
            { text: 'Plugins', link: '/api/plugins' },
          ]
        }
      ],
      '/plugins/': [
        {
          text: 'Plugin Development',
          items: [
            { text: 'Overview', link: '/plugins/overview' },
            { text: 'Your First Plugin', link: '/plugins/first-plugin' },
            { text: 'Plugin Manifest', link: '/plugins/manifest' },
            { text: 'Available Hooks', link: '/plugins/hooks' },
            { text: 'Security Model', link: '/plugins/security' },
            { text: 'Publishing', link: '/plugins/publishing' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/rohitvaddepalli/AI-Personal-Knowledge' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Second Brain Contributors'
    },

    editLink: {
      pattern: 'https://github.com/rohitvaddepalli/AI-Personal-Knowledge/edit/main/docs-site/docs/:path',
      text: 'Edit this page on GitHub'
    },

    search: {
      provider: 'local'
    }
  }
})
