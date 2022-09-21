const colors = require('tailwindcss/colors')

module.exports = {
  content: ['./routes/**/*.{html,md}'],
  important: true,
  theme: {
    extend: {
      colors: {
        brand: {
          1: 'var(--brand-1)',
          2: 'var(--brand-2)',
          3: 'var(--brand-3)',
          4: 'var(--brand-4)',
          5: 'var(--brand-5)'
        },
        light: {
          1: 'var(--light-1)',
          2: 'var(--light-2)',
          3: 'var(--light-3)',
          4: 'var(--light-4)',
          5: 'var(--light-5)'
        },
        dark: {
          1: 'var(--dark-1)',
          2: 'var(--dark-2)',
          3: 'var(--dark-3)',
          4: 'var(--dark-4)',
          5: 'var(--dark-5)'
        },
        info: 'var(--info)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        error: 'var(--error)'
      },

      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
        '9xl': ['8rem', { lineHeight: '1' }]
      },

      screens: {
        sm: '481px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px'
      }
    }
  },
  plugins: []
}
