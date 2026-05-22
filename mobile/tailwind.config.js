/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: '#0b1326',
        surface: '#0b1326',
        'surface-container': '#171f33',
        'surface-container-low': '#131b2e',
        'surface-container-high': '#222a3d',
        'surface-container-highest': '#2d3449',
        'surface-variant': '#2d3449',
        'surface-bright': '#31394d',
        primary: '#c0c1ff',
        'primary-container': '#8083ff',
        'on-primary': '#1000a9',
        'on-primary-container': '#0d0096',
        secondary: '#44e2cd',
        'secondary-container': '#03c6b2',
        'on-secondary': '#003731',
        'on-secondary-container': '#004d44',
        tertiary: '#ffb690',
        'tertiary-container': '#ec6a06',
        'on-tertiary': '#552100',
        error: '#ffb4ab',
        'error-container': '#93000a',
        'on-error': '#690005',
        'on-surface': '#dae2fd',
        'on-surface-variant': '#c7c4d7',
        outline: '#908fa0',
        'outline-variant': '#464554',
        'inverse-primary': '#494bd6',
      },
      fontFamily: {
        plus: ['PlusJakartaSans_400Regular'],
        'plus-medium': ['PlusJakartaSans_500Medium'],
        'plus-semibold': ['PlusJakartaSans_600SemiBold'],
        'plus-bold': ['PlusJakartaSans_700Bold'],
        'plus-extrabold': ['PlusJakartaSans_800ExtraBold'],
        space: ['SpaceGrotesk_500Medium'],
        'space-semibold': ['SpaceGrotesk_600SemiBold'],
        'space-bold': ['SpaceGrotesk_700Bold'],
      },
      spacing: {
        'container-padding': '20px',
        'stack-loose': '24px',
        'card-gap': '16px',
        gutter: '12px',
        'stack-tight': '4px',
      }
    },
  },
  plugins: [],
}
