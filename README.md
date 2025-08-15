# Car Damage Analyzer - Web Version

A professional web application for car damage analysis that works directly in your browser. This is a complete web version of the mobile Car Damage Analyzer app, featuring camera functionality, guided 360° recording, and detailed damage reports.

## Features

### 🚗 360° Vehicle Analysis
- **Guided Recording Process**: Step-by-step instructions for recording all four sides of the vehicle
- **Real-time Camera Feed**: Uses device camera for live video capture
- **Smart Stencil Overlays**: Visual guides that change color based on recording status
- **Progress Tracking**: Real-time progress indicators for each position

### 📱 Professional UI/UX
- **Modern Design**: Glass morphism effects and smooth animations
- **Responsive Layout**: Works perfectly on desktop, tablet, and mobile devices
- **Smooth Transitions**: Framer Motion animations for seamless user experience
- **Dark Theme**: Professional dark interface optimized for camera usage

### 📊 Comprehensive Reports
- **Damage Assessment**: Detailed analysis with progress indicators
- **Photo Gallery**: High-quality damage documentation with zoom functionality
- **Cost Estimates**: Breakdown of repair costs with itemized pricing
- **Export Options**: Download reports and share functionality

### 🔧 Technical Features
- **Webcam Integration**: Uses `react-webcam` for camera access
- **Progressive Web App**: Can be installed on devices for app-like experience
- **Share API**: Native sharing functionality where supported
- **Responsive Design**: Tailwind CSS for consistent styling across devices

## Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Modern web browser with camera support

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd CarDamageAnalyzerWeb
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory, ready for deployment.

## Usage

### 1. Landing Screen
- Review the 360° recording process
- Understand the four positions (Front, Right, Back, Left)
- Click "Start 360° Analysis" to begin

### 2. Camera Recording
- **Permission**: Grant camera access when prompted
- **Detection Phase**: Keep camera steady for 3 seconds (red stencil)
- **Ready Phase**: Stencil turns green, click record button
- **Recording Phase**: Record for 6 seconds (yellow stencil)
- **Auto-advance**: Automatically moves to next position

### 3. Processing
- **Buffering Screen**: Shows processing progress with animations
- **Analysis**: Simulates damage detection and cost calculation

### 4. Damage Report
- **Progress Circle**: Animated verification progress
- **Damage Details**: Identified damage areas and descriptions
- **Photo Gallery**: Click images to view full-screen
- **Cost Breakdown**: Itemized repair estimates
- **Actions**: Download report or share results

## Technology Stack

- **React 18**: Modern React with hooks and functional components
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **Framer Motion**: Professional animations
- **React Webcam**: Camera integration
- **Lucide React**: Beautiful icons

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Note**: Camera functionality requires HTTPS in production environments.

## Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Netlify
```bash
npm run build
# Upload dist folder to Netlify
```

### Static Hosting
```bash
npm run build
# Upload dist folder to any static hosting service
```

## Customization

### Colors and Theme
Edit `tailwind.config.js` to customize:
- Color palette
- Animations
- Typography

### Camera Settings
Modify camera parameters in `CameraScreen.tsx`:
- Recording duration
- Detection timing
- Stencil appearance

### Report Content
Update damage data in `DamageReport.tsx`:
- Photo sources
- Cost estimates
- Damage descriptions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review browser compatibility

---

**Note**: This is a demonstration application. In a production environment, you would integrate with:
- Real damage detection AI/ML models
- Backend services for data processing
- Database for storing reports
- Authentication and user management
- Payment processing for premium features
