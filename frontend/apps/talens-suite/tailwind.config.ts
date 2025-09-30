import type { Config } from 'tailwindcss'

export default {
    content: [
        './src/app/**/*.{ts,tsx}',
        './src/components/**/*.{ts,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                neutralBg: '#f5f7fa',
                panel: '#f1f3f6',
                ink: '#1b1f23',
                accent: {
                    blue: '#2563eb',
                    purple: '#6d28d9',
                    pink: '#db2777'
                }
            },
            boxShadow: {
                panel: '0 4px 14px rgba(0,0,0,0.08)',
                hover: '0 6px 24px rgba(0,0,0,0.12)'
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif']
            },
            screens: {
                '3xl': '1920px'
            }
        }
    },
    plugins: []
} satisfies Config
