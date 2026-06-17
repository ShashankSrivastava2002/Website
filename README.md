# Shashank Srivastava | AI Developer Portfolio

A modern, animated portfolio website showcasing AI development projects, experience, and skills with a gradient descent-themed preloader and neural network background visualization.

**🌐 Live Site:** [shashanksrivastava.dev](https://shashanksrivastava.dev)

## Overview

This is a personal portfolio website built with vanilla HTML, CSS, and JavaScript. It features:

- **Animated Preloader**: A gradient descent loss curve visualization with exponential decay animation
- **Neural Network Background**: Dynamic canvas-based neural network visualization
- **Dark/Light Theme Toggle**: Seamless theme switching with persistent user preference
- **Responsive Design**: Mobile-first approach with smooth typography
- **Smooth Animations**: Cascade reveal animations and interactive elements
- **Social Links**: Direct connections to email, GitHub, LinkedIn, and resume

## Features

### Preloader
- Interactive loss curve animation simulating model training (gradient descent)
- Session-based tracking to show preloader only once per session
- Smooth fade transition to main content

### Design
- **Color Scheme**: Warm amber/gold accents (#d97706 light mode, #f59e0b dark mode)
- **Typography**: Inter for body text, Newsreader for serif accents
- **Responsive**: Adapts gracefully to all screen sizes
- **Accessible**: Semantic HTML, ARIA labels for icons and interactive elements

### Sections
1. **Header** - Name, tagline, and navigation (Projects, Experience, Contact)
2. **Bio** - Professional summary with company links
3. **Social Links** - Email, GitHub, LinkedIn, and resume download
4. **Experience** - Work history with descriptions and dates

## File Structure

```
website/
├── index.html      # Main HTML structure
├── script.js       # Animations, preloader logic, interactivity
├── styles.css      # All styling and theme configuration
└── README.md       # This file
```

## Technologies

- **HTML5** - Semantic markup
- **CSS3** - Grid, Flexbox, CSS variables, animations, transitions
- **JavaScript (Vanilla)** - Canvas animations, DOM manipulation, localStorage/sessionStorage
- **Canvas API** - Neural network background and loss curve visualization
- **Google Fonts** - Inter and Newsreader typefaces

## Key JavaScript Features

- **Loss Curve Animation**: Realistic loss decay curve drawn with exponential smoothing
- **Session Storage**: Skips preloader on repeat visits within the same session
- **Theme Toggle**: Dark/light mode switching with `data-theme` attribute
- **Custom Cursor**: Animated dot cursor following mouse movement
- **Cascade Animations**: Staggered reveal animations on page load

## Browser Support

- Modern browsers supporting:
  - CSS Grid & Flexbox
  - CSS Custom Properties (CSS Variables)
  - Canvas API
  - ES6 JavaScript

## Customization

### Theme Colors
Edit CSS variables in `styles.css`:
- Light mode: `:root` selector
- Dark mode: `[data-theme="dark"]` selector

### Preloader Duration
Adjust `totalSteps` in `script.js` to control animation speed

### Content
Update text, links, and experience details directly in `index.html`

## License

Personal portfolio project.

---

**Built with ❤️ by Shashank Srivastava**
