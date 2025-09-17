# Talens Suite Showcase - Azure Static Web App

A stunning showcase website for the Talens Suite - AI-Powered Talent Intelligence Platform.

## 🎯 Overview

This Azure Static Web App showcases three powerful AI products:

- **Talens**: AI realtime interviewer with intelligent conversation flow
- **Smart Mock**: Traditional interview preparation with AI-powered evaluation  
- **Smart Screen**: Unbiased AI resume screener with customizable features

## 🚀 Features

- **Visually Stunning Design**: Modern gradients, animations, and interactive elements
- **Responsive Layout**: Optimized for all devices and screen sizes
- **Performance Optimized**: Smooth animations with performance monitoring
- **Accessibility Ready**: High contrast support and reduced motion preferences
- **Azure Static Web App Ready**: Configured for seamless deployment

## 🛠️ Technologies Used

- **HTML5**: Semantic markup with modern structure
- **CSS3**: Advanced animations, gradients, and responsive design
- **JavaScript**: Interactive effects and dynamic animations
- **Azure Static Web Apps**: Cloud hosting and deployment

## 🎨 Design Features

- Animated star field background
- Parallax mouse effects
- Smooth hover animations
- Dynamic gradient text
- Interactive product cards
- Performance-aware animations
- Loading overlay
- Scroll indicators

## 📁 Project Structure

```
talens-suite-showcase/
├── src/
│   ├── index.html          # Main HTML file
│   ├── styles.css          # Comprehensive CSS with animations
│   ├── script.js           # Interactive JavaScript features
│   └── assets/             # Static assets directory
├── staticwebapp.config.json # Azure Static Web App configuration
└── README.md               # This file
```

## 🚀 Deployment to Azure Static Web Apps

### Prerequisites
- Azure account
- Azure CLI or VS Code with Azure extension
- Git repository

### Deployment Steps

1. **Create Azure Static Web App**:
   ```bash
   az staticwebapp create \
     --name talens-suite-showcase \
     --resource-group your-resource-group \
     --source https://github.com/your-username/your-repo \
     --location "East US 2" \
     --branch main \
     --app-location "/talens-suite-showcase/src" \
     --output-location ""
   ```

2. **Configure Build Settings**:
   - App location: `/talens-suite-showcase/src`
   - API location: (leave empty)
   - Output location: (leave empty)

3. **Custom Domain** (Optional):
   ```bash
   az staticwebapp hostname set \
     --name talens-suite-showcase \
     --resource-group your-resource-group \
     --hostname your-custom-domain.com
   ```

### GitHub Actions Workflow

The deployment will automatically create a GitHub Actions workflow:

```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches:
      - main

jobs:
  build_and_deploy_job:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    name: Build and Deploy Job
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: true
      - name: Deploy to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/talens-suite-showcase/src"
          output_location: ""
```

## 🎯 Demo Purpose

This showcase is designed for:
- **Leadership Demos**: Visually impressive presentation of AI capabilities
- **Internal POC**: Proof of concept for talent management solutions
- **Stakeholder Presentations**: Professional showcase of technical capabilities

## 🔧 Local Development

1. **Clone and navigate**:
   ```bash
   cd talens-suite-showcase/src
   ```

2. **Serve locally**:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using Live Server (VS Code extension)
   Right-click index.html → Open with Live Server
   ```

3. **Open browser**:
   Navigate to `http://localhost:8000`

## 📱 Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## ⚡ Performance Features

- Intersection Observer for efficient animations
- Throttled and debounced event handlers
- FPS monitoring with automatic optimization
- Reduced motion support
- Optimized CSS animations
- Lazy loading considerations

## 🎨 Customization

### Colors
Update CSS custom properties in `:root`:
```css
:root {
  --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --secondary-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  /* ... more gradients */
}
```

### Animations
Modify animation timings:
```css
:root {
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-in-out-quart: cubic-bezier(0.77, 0, 0.175, 1);
}
```

### Content
Update product descriptions in `index.html`:
```html
<div class="product-content">
  <h3 class="product-title">Your Product</h3>
  <p class="product-description">Your description</p>
</div>
```

## 🔍 SEO Features

- Semantic HTML structure
- Meta descriptions
- Open Graph ready structure
- Proper heading hierarchy
- Alt text considerations
- Fast loading times

## 🛡️ Security

- Content Security Policy headers
- X-Frame-Options protection
- X-Content-Type-Options headers
- No inline scripts (except necessary animations)

## 📞 Support

For issues or customization requests, please refer to the main repository documentation or contact the development team.

---

**Built with ❤️ for showcasing AI-powered talent intelligence**