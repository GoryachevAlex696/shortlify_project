/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{html,js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary Colors (B900 - B100) - Синие оттенки
        primary: {
          100: '#E6F0FF', // B100 - самый светлый синий
          200: '#CCE0FF',
          300: '#99C2FF',
          400: '#66A3FF',
          500: '#3385FF',
          600: '#0066FF', // Основной синий
          700: '#0052CC',
          800: '#003D99', // B800
          900: '#002966'  // B900 - самый темный синий
        },
        
        // Neutral Colors (B800 - B100, W400 - W100/W900) - Серые/Черные/Белые
        neutral: {
          100: '#F8F9FA', // B100 - очень светлый серый
          200: '#E9ECEF',
          300: '#DEE2E6',
          400: '#CED4DA', // W400 - светлый серый
          500: '#ADB5BD',
          600: '#6C757D',
          700: '#495057',
          800: '#343A40', // B800 - темный серый
          900: '#212529'  // B900 - почти черный
        },
        
        // White Colors
        white: {
          100: '#FFFFFF', // W100 - чистый белый
          400: '#F8F9FA', // W400 - off-white
          900: '#FFFFFF'  // W900 - тоже белый (возможно для consistency)
        },
        
        // Semantic Colors
        // Green (GB00 - G100)
        success: {
          100: '#D1F2E5', // G100 - светлый зеленый
          200: '#A3E4CB',
          300: '#75D7B2',
          400: '#47C998',
          500: '#19BC7F',
          600: '#149A65',
          700: '#0F784C',
          800: '#0A5633', 
          900: '#053419'
        },
        
        // Red (R800 - R100)
        error: {
          100: '#FFE6E6', // R100 - светлый красный
          200: '#FFCCCC',
          300: '#FF9999',
          400: '#FF6666',
          500: '#FF3333',
          600: '#FF0000',
          700: '#CC0000',
          800: '#990000', // R800
          900: '#660000'
        },
        
       
        warning: {
          100: '#FFF9E6', // Y100 - светлый желтый
          200: '#FFF2CC',
          300: '#FFE699',
          400: '#FFD966',
          500: '#FFCC33',
          600: '#FFBF00',
          700: '#CC9900',
          800: '#997300', // Y800
          900: '#664D00'
        },
        
        // Цвета для формы (удерживаем для обратной совместимости)
        form: {
          border: '#CED4DA', // neutral.400
          focus: '#0066FF',   // primary.600
          error: '#990000',   // error.800
          success: '#0A5633'  // success.800
        }
      },
      fontFamily: {
        'sans': ['Inter', 'ui-sans-serif', 'system-ui'],
        'display': ['Poppins', 'ui-sans-serif'],
      },
      borderRadius: {
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.1)',
        'soft': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'input': '0 0 0 3px rgba(0, 102, 255, 0.1)', // primary.600 с opacity
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      transitionProperty: {
        'colors': 'color, background-color, border-color, text-decoration-color, fill, stroke',
        'opacity': 'opacity',
        'transform': 'transform',
      },
      extend: {
        animation: {
          'fade-in': 'fadeIn 0.5s ease-in-out',
          'slide-up': 'slideUp 0.3s ease-out',
        },
        keyframes: {
          fadeIn: {
            '0%': { opacity: '0' },
            '100%': { opacity: '1' },
          },
          slideUp: {
            '0%': { transform: 'translateY(10px)', opacity: '0' },
            '100%': { transform: 'translateY(0)', opacity: '1' },
          },
        },
      }
    },
  },
  plugins: [
    function({ addUtilities }) {
      const newUtilities = {
        '.form-input': {
          padding: '0.75rem 1rem',
          borderWidth: '1px',
          borderColor: '#CED4DA', // neutral.400
          borderRadius: '1rem',
          '&:focus': {
            outline: 'none',
            ring: '2px',
            ringColor: '#0066FF', // primary.600
            ringOffset: '2px',
          },
        },
        '.form-button': {
          padding: '0.75rem 1rem',
          borderRadius: '1rem',
          fontWeight: '500',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
          '&:disabled': {
            opacity: '0.5',
            cursor: 'not-allowed',
          },
        },
      }
      addUtilities(newUtilities, ['responsive', 'hover'])
    }
  ],
}