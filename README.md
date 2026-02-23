# Voxera - Voice-Powered IDE Runtime

<div align="center">

[![YouTube Demo](https://img.shields.io/badge/YouTube-Demo-red?logo=youtube)](https://youtu.be/AEj133txDt4?si=vQ9J2YtGqHUjOcd_)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)](https://react.dev)

**An advanced voice-controlled web development IDE with visual builder, real-time preview, and multi-language support**

</div>

## 🎯 Overview

**Voxera** is a Next.js-based voice-powered Integrated Development Environment that enables developers to:
- Build web applications using **voice commands** in multiple languages (English, Hindi, Kannada, Spanish)
- Use a **Figma-like visual builder** with rulers, snap guides, and component inspector
- Deploy and manage **multiple isolated workspaces** with real-time preview
- Import existing **Next.js projects** as editable workspaces
- Generate **UI components, pages, and layouts** dynamically

## 🎬 Demo

[![YouTube Demo Video](https://img.shields.io/badge/Watch%20Project%20Demo%20on%20YouTube-red?style=for-the-badge&logo=youtube)](https://youtu.be/AEj133txDt4?si=vQ9J2YtGqHUjOcd_)

## ✨ Features

### 🎤 Voice Interface
- Real-time speech-to-text processing via custom `/api/voice/detect` endpoint
- Intent recognition and routing (Hindi profile demo, Kannada calendar demo)
- Multi-language detection with automatic locale switching
- Auto-routing for Hindi/Kannada: detect language → instant preview navigation
- Unicode character detection for Hindi (Devanagari) and Kannada scripts

### 🏗️ Figma-Style Builder (BuilderCanvas)
- **Visual rulers** with zoom tracking and DPI scaling
- **Snap guides** for pixel-perfect alignment (6px threshold, 9-point detection)
- **Multi-handle resizing** (9-point grid: top-left, top-center, top-right, etc.)
- **Drag-to-move** nodes with undo/redo history
- **Tool palette**: Select (V), Hand (H), Rectangle (R), Text (T), Image (I)
- Real-time dimension and position labels
- Aspect ratio lock toggle
- Full keyboard shortcut support

### 🔍 Inspector Panel (InspectorPanel)
Collapsible property sections with real-time updates:
- **Layout**: X, Y, Width, Height inputs with arrow-key stepping (±1 normal, ±10 shift)
- **Appearance**: Rotation (°), Opacity (%) controls
- **Fill & Stroke**: Color pickers, hex input, border width/radius
- **Typography**: Font size, line height, weight dropdown, alignment buttons, color
- **Content**: Text node editor with live preview
- **Spacing**: Padding controls (left, right, top, bottom)

### 📁 Workspace Management
- **Create new projects** from templates
- **Import Next.js projects** from ZIP files (auto-extract, route detection)
- **Isolated workspaces** with independent dev servers (port allocation)
- **Shadow workspace** for safe mutations before committing
- **Version control** via git integration
- **Auto-sync** with file system changes

### 🌐 Multi-Language Support
- **Localization** via Lingo.dev SDK with compiled translations
- Supported languages: EN (English), HI (Hindi), KN (Kannada), ES (Spanish)
- **Landing page language selector** with instant Lingo-powered translation
- **IDE language dropdown** for locale switching without page reload
- Auto-detection from voice commands (Unicode character scanning)
- Cached translations in `src/app/lingo/cache/{en,hi,kn,es}.json`
- Seamless context switching across all UI components

### 📱 IDE Features
- **TopBar with dropdown menus**:
  - File: New File, Export Project, Close Workspace
  - Edit: Undo (Ctrl+Z), Redo (Ctrl+Shift+Z), Cut, Copy, Paste
  - View: Switch Builder/Code (Ctrl+1/Ctrl+2), Toggle Explorer/Terminal/Preview Dock, Fullscreen (F11)
  - Terminal: Show Terminal, Show Agent Panel
- **Code Editor Panel** with syntax highlighting and auto-completion
- **Component Tree Panel** for hierarchical navigation
- **Terminal Panel** with real-time dev server output
- **Voice Input Bar** with waveform visualization
- **Welcome Screen** with dual CTA (Launch IDE / Import ZIP)
- **Responsive layout** with ResizableSplit panels

### 🔄 Real-Time Preview
- **Embedded iframe overlay** (VoxeraOverlayBridge) with PostMessage communication
- **Retry timers** (0ms, 300ms, 800ms, 1500ms, 2500ms) for message reliability
- **Re-sync on preview reload** (`voxera:ready` event handler)
- **Headless preview mode** for headless environments
- **Custom route navigation**: `/profile-hi-shot`, `/calendar-kn-shot`
- **Debouncing** (1.5s per language) to prevent rapid navigation spam

### 🤖 AI-Powered Agent
- **Agent Panel** for advanced code generation
- **Intent normalization** for consistent command handling
- **Voice operation handlers** for complex workflows
- **Component generation** from natural language descriptions

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14+ (App Router) |
| **Language** | TypeScript 5.0+ |
| **UI Components** | React 18+ |
| **Styling** | Tailwind CSS + PostCSS |
| **Localization** | Lingo.dev SDK (deployed) |
| **State Management** | React Context, useReducer, Hooks |
| **Voice Processing** | Web Audio API, native speech-to-text |
| **Dev Tools** | ESLint, Prettier, TypeScript strict mode |
| **HTTP Client** | fetch API with AbortController |
| **IPC** | PostMessage (browser), stdin/stdout (Node.js) |
| **Process Management** | Node.js child_process |
| **File System** | Node.js fs, fsWatcher, cross-platform paths |

## 📦 Project Structure

```
voice-runtime/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── voice/
│   │   │   │   ├── detect/route.ts         # Main speech-to-text API
│   │   │   │   │                           # Returns: transcript, detectedLocale, intent
│   │   │   │   └── debug-intent/route.ts   # Intent debugging endpoint
│   │   │   ├── workspace/
│   │   │   │   └── import-zip/route.ts     # ZIP project import with port allocation
│   │   │   ├── demo/
│   │   │   │   └── profile-hi/route.ts     # Hindi profile demo API
│   │   │   └── devserver/
│   │   │       └── metadata/route.ts       # Devserver info endpoint
│   │   ├── layout.tsx                      # Root layout with Lingo SDK provider
│   │   ├── page.tsx                        # Main IDE orchestration + voice processing
│   │   ├── globals.css                     # Global Tailwind + custom styles
│   │   └── lingo/
│   │       └── cache/
│   │           ├── en.json                 # English translations
│   │           ├── hi.json                 # Hindi translations (Devanagari)
│   │           ├── kn.json                 # Kannada translations
│   │           └── es.json                 # Spanish translations
│   ├── components/
│   │   ├── WelcomeScreen.tsx               # Landing page with language selector
│   │   ├── TopBar.tsx                      # IDE menu bar with all dropdowns
│   │   ├── BuilderCanvas.tsx               # Figma-like visual editor with rulers
│   │   ├── InspectorPanel.tsx              # Property inspector with collapsible sections
│   │   ├── CodeEditor.tsx                  # Code editing with syntax highlighting
│   │   ├── CodeEditorPanel.tsx             # Code editor wrapper panel
│   │   ├── ComponentTreePanel.tsx          # Component hierarchy navigator
│   │   ├── TerminalPanel.tsx               # Dev server terminal emulator
│   │   ├── VoiceInputBar.tsx               # Voice capture UI with waveform
│   │   ├── LivePreview.tsx                 # Preview toggle button
│   │   ├── ImportedZoneBuilderPreview.tsx  # Preview iframe integration
│   │   ├── ResizableSplit.tsx              # Resizable split panel container
│   │   ├── AgentPanel.tsx                  # AI agent interface
│   │   ├── FileExplorer.tsx                # File tree navigator
│   │   ├── ShadowScope.tsx                 # Shadow workspace renderer
│   │   ├── AiInsightsPanel.tsx             # AI code insights
│   │   ├── GlobalLingoButton.tsx           # Global Lingo language button
│   │   └── [Other panels & utilities]      # Supporting components
│   ├── contexts/
│   │   └── WorkspaceContext.tsx            # Global workspace state + actions
│   ├── lib/
│   │   ├── workspaceManager.ts             # Workspace lifecycle management
│   │   ├── workspaceOrchestrator.ts        # Workspace orchestration engine
│   │   ├── devServerController.ts          # Dev server process control
│   │   ├── codeGenerator.ts                # Dynamic code generation
│   │   ├── componentParser.ts              # Component AST parsing & analysis
│   │   ├── fileGenerators.ts               # File template generation
│   │   ├── projectImporter.ts              # ZIP import with validation
│   │   ├── projectExporter.ts              # Project export logic
│   │   ├── shadowWorkspace.ts              # Safe mutation sandbox
│   │   ├── voiceOperations.ts              # Voice command handlers
│   │   ├── intentNormalizer.ts             # Intent canonicalization
│   │   ├── realFilesystem.ts               # Native filesystem bridge
│   │   ├── filesystemStore.ts              # Virtual filesystem store
│   │   ├── importOverlay.ts                # Import preview overlay
│   │   ├── staticZipNextApp.ts             # Static ZIP app builder
│   │   └── [Visual engine, utilities]      # Additional utilities
│   ├── builder/
│   │   ├── schema.ts                       # UI schema type definitions
│   │   ├── mutations.ts                    # Schema mutation functions
│   │   ├── history.ts                      # Undo/redo stack management
│   │   └── jsxSync.ts                      # JSX bi-directional sync
│   ├── types/
│   │   ├── workspace.ts                    # Workspace entity types
│   │   ├── intent.ts                       # Voice intent enums & types
│   │   ├── agent.ts                        # Agent action types
│   │   ├── filesystem.ts                   # VFS types
│   │   ├── orchestrator.ts                 # Orchestrator types
│   │   ├── shadow.ts                       # Shadow workspace types
│   │   └── zoneBuilder.ts                  # Zone builder types
│   ├── visual/
│   │   ├── syncEngine.ts                   # Visual-code bidirectional sync
│   │   ├── domParserLayer.ts               # DOM parsing abstraction
│   │   ├── deepTsxParser.ts                # Deep TSX parsing engine
│   │   ├── schemaManager.ts                # Schema lifecycle management
│   │   └── useVisualEngine.ts              # Visual engine React hook
│   └── public/
│       └── [Static assets]                 # Images, icons, etc
├── scripts/
│   ├── smoke-demo-hi-then-kn.js            # Integration test (Hindi → Kannada)
│   ├── verify-intent-kannada.js            # Kannada intent verification
│   ├── verify-intent-hindi.js              # Hindi intent verification
│   ├── screenshot-*.js                     # Screenshot automation
│   └── [Other dev scripts]
├── workspaces/                             # User workspace storage directory
│   ├── ws_1771698832968_8j9py/             # Individual workspace (Next.js app)
│   ├── ws_1771700009438_g7g2n/
│   ├── ws_import_from_3006/
│   └── ws_import_smoke/
├── lingo.config.ts                         # Lingo.dev configuration
├── next.config.ts                          # Next.js configuration with rewrites
├── package.json                            # NPM dependencies + scripts
├── package-lock.json                       # Locked dependency versions
├── tsconfig.json                           # TypeScript strict mode config
├── eslint.config.mjs                       # ESLint configuration
├── postcss.config.mjs                      # PostCSS plugins
└── README.md                               # This file
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (with npm, yarn, or pnpm)
- Git for version control
- Chrome/Chromium browser (for voice input with microphone access)
- 2GB free disk space (for workspaces + node_modules)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd voice-runtime

# Install dependencies
npm install

# Install Lingo.dev SDK (if using external version)
npm install @lingo-app/lingo-next

# Setup Python environment (optional, for advanced voice processing)
python -m venv venv
source venv/Scripts/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt  # If provided
```

### Running the Development Server

```bash
# Start main IDE on port 3006
npm run dev

# In another terminal (optional), list existing workspaces
npm run workspace:list

# Create new workspace (if script available)
npm run workspace:create
```

Then open [http://localhost:3006](http://localhost:3006) in your browser.

**First steps:**
1. Allow microphone access when prompted
2. Select language from landing page dropdown (EN/HI/KN/ES)
3. Click "Launch IDE" to enter the development environment
4. Speak voice commands in your selected language
5. Use the Builder to visually edit components

### Environment Variables

Create `.env.local` in the project root:

```env
# Voice API Configuration
NEXT_PUBLIC_VOICE_API_URL=http://localhost:3006/api/voice/detect

# Lingo.dev SDK
NEXT_PUBLIC_LINGO_API_KEY=your_lingo_dev_api_key

# Workspace Management
WORKSPACE_ROOT=./workspaces
MAX_WORKSPACES=20

# Dev Server Configuration
DEV_SERVER_BASE_PORT=3008
DEV_SERVER_MAX_RETRIES=5

# Optional: Debug Logging
DEBUG=voxera:*
```

## 📡 API Endpoints

### 1. Voice Detection
**POST** `/api/voice/detect`

Converts audio to text with intent detection and language identification.

Request body (multipart/form-data):
```
audio: File (WAV/MP3/WebM)
locale: "en" | "hi" | "kn" | "es"
```

Response:
```json
{
  "success": true,
  "transcript": "hello world",
  "detectedLocale": "en",
  "detectedLanguage": "English",
  "intent": "HINDI_PROFILE_DEMO" | "KANNADA_CALENDAR_DEMO" | null,
  "confidence": 0.95,
  "processingTime": 245
}
```

Error response:
```json
{
  "success": false,
  "error": "No speech detected",
  "message": "Please try speaking again"
}
```

### 2. Workspace Import
**POST** `/api/workspace/import-zip`

Imports a Next.js project from a ZIP file and allocates an isolated workspace.

Request body (multipart/form-data):
```
file: ZIP file containing Next.js project
```

Response:
```json
{
  "success": true,
  "workspaceId": "ws_1771698832968_8j9py",
  "workspacePath": "/path/to/workspace",
  "devServerPort": 3008,
  "devServerUrl": "http://localhost:3008",
  "message": "Workspace imported successfully, dev server starting on port 3008"
}
```

### 3. Dev Server Metadata
**GET** `/api/devserver/metadata`

Gets information about running dev server for a workspace.

Response:
```json
{
  "port": 3008,
  "url": "http://localhost:3008",
  "isRunning": true,
  "uptime": 5432,
  "routes": ["/", "/profile", "/calendar"]
}
```

### 4. Demo Profile (Hindi)
**GET** `/api/demo/profile-hi`

Returns pre-rendered Hindi profile demo page.

Response: HTML with profile content in Hindi

### 5. Intent Debug
**POST** `/api/voice/debug-intent`

Tests intent detection without actual voice processing.

Request body:
```json
{
  "transcript": "play hindi profile",
  "locale": "hi"
}
```

Response:
```json
{
  "matchedIntent": "HINDI_PROFILE_DEMO",
  "confidence": 0.92,
  "route": "/profile-hi-shot?voxeraBuilder=1&voxeraLocale=hi"
}
```

## 🎮 Voice Commands

### English (EN)
```
"Show profile" → Navigate to profile page
"Open settings" → Open settings panel
"Create new file" → New file dialog
"Delete this" → Delete selected element
"Style it red" → Apply red color to selection
```

### Hindi (HI) - Devanagari
```
"प्रोफ़ाइल दिखाएं" → Profile demo overlay
"सेटिंग्स खोलें" → Settings panel
Any Devanagari speech → Auto-route to /profile-hi-shot
```

### Kannada (KN) - Kannada Script
```
"ಕ್ಯಾಲೆಂಡರ್ ತೋರಿಸಿ" → Calendar demo overlay
"ಸ್ಥಾಪನೆ ತೋರಿಸಿ" → Settings panel
Any Kannada speech → Auto-route to /calendar-kn-shot
```

### Spanish (ES)
```
"Mostrar perfil" → Show profile
"Abrir configuración" → Open settings
"Crear nuevo archivo" → New file dialog
```

**Auto-Detection Logic:**
- Speech analyzed in real-time for Unicode character ranges
- Hindi: U+0900–U+097F (Devanagari range)
- Kannada: U+0C80–U+0CFF (Kannada range)
- If detected, automatically switches locale and routes to demo preview
- 1.5s debounce prevents rapid re-triggering

## 🔧 Development

### Adding a New Voice Intent

Edit `src/lib/intentNormalizer.ts`:

```typescript
export const INTENT_HANDLERS = {
  MY_CUSTOM_INTENT: {
    pattern: /my custom pattern|alternate pattern/i,
    locales: ["en", "hi"],                    // Supported languages
    priority: 10,                             // Higher priority = checked first
    handler: (workspace, data) => {
      console.log("Intent matched:", data.transcript);
      // Handle intent - update workspace state, navigate, etc.
      return {
        success: true,
        navigateTo: "/my-custom-page",
        locale: data.detectedLocale
      };
    }
  }
};
```

### Creating a New Component

```typescript
// components/MyComponent.tsx
'use client';
import { useLingoContext } from '@lingo-app/lingo-next';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function MyComponent() {
  const { locale, t } = useLingoContext();
  const { workspace } = useWorkspace();
  
  return (
    <div className="my-component">
      <h1>{t('myComponent.title')}</h1>
      <p>Current locale: {locale}</p>
      <p>Active workspace: {workspace?.id}</p>
    </div>
  );
}
```

### Adding Translations

1. Add string keys to Lingo.dev platform or local cache files
2. Update `src/app/lingo/cache/{en,hi,kn,es}.json`:

```json
{
  "myComponent": {
    "title": "My Component Title",
    "description": "Component description",
    "button": {
      "save": "Save",
      "cancel": "Cancel"
    }
  }
}
```

3. Use in component: `t('myComponent.title')`

### Building for Production

```bash
# Build optimized bundle
npm run build

# Start production server
npm run start

# Test production build locally
npm run build && npm run start
```

Production URL: [http://localhost:3000](http://localhost:3000)

## 📊 Architecture Highlights

### Voice Processing Pipeline
```
Audio Stream (Web Audio API)
    ↓
sendAudio() function (page.tsx)
    ↓
POST /api/voice/detect
    ↓
Speech-to-text engine
    ↓
Intent matching via Unicode + API locale
    ↓
executeIntent() → route specific handler
    ↓
applyDesiredPreviewRuntime()
    ↓
PostMessage to preview iframe (retry timers)
    ↓
Preview updates with new locale/route
```

### Real-Time Preview Resilience
Key mechanisms for iframe communication reliability:

1. **Retry Timers** (exponential backoff):
   - 0ms (immediate)
   - 300ms (short delay)
   - 800ms (medium delay)
   - 1500ms (long delay)
   - 2500ms (final retry)

2. **Ready Event Sync**:
   ```tsx
   window.addEventListener('message', (event) => {
     if (event.data.type === 'voxera:ready') {
       // Preview iframe reloaded, re-apply state
       resendDesiredPreviewRuntime();
     }
   });
   ```

3. **Debouncing per Language** (1.5s cooldown):
   ```tsx
   const lastAutoDemoRef = useRef<{ key: "hi" | "kn"; at: number } | null>(null);
   
   const canFire = (key: "hi" | "kn") => {
     const last = lastAutoDemoRef.current;
     if (!last) return true;
     if (last.key !== key) return true;
     return Date.now() - last.at > 1500;
   };
   ```

### Builder State Management Pattern
```tsx
// Central history state with methods
const [history, setHistory] = useState<SchemaHistory>(initialHistory);

// Move operation example:
setHistory(prev => pushHistory(prev, {
  kind: "move",
  nodeId: selectedNode.id,
  oldX: selectedNode.x,
  oldY: selectedNode.y,
  newX: x,
  newY: y
}));

// Undo/Redo:
setHistory(prev => undo(prev));        // Ctrl+Z
setHistory(prev => redo(prev));        // Ctrl+Shift+Z
```

## 🐛 Troubleshooting

### Voice Detection Not Working
1. **Check microphone permissions** in browser:
   - Chrome: Click lock icon → Site settings → Microphone
   - Allow microphone access for localhost:3006
2. **Verify API endpoint responding**:
   ```bash
   curl -X GET http://localhost:3006/api/voice/detect
   # Should return 405 (method not allowed) or similar, confirming endpoint exists
   ```
3. **Check browser console** (F12 → Console) for JavaScript errors
4. **Test debug endpoint**:
   ```bash
   npm run verify:intent:hi
   ```
5. **Check dev server logs** for `/api/voice/detect` 404 errors

### Preview Not Updating After Voice Command
1. **Hard-reload IDE**: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. **Check browser console** for PostMessage errors
3. **Verify preview iframe** is loading at correct URL
4. **Check `voxera:ready` event** firing in console logs
5. **Inspect Network tab** for failed `/api/voice/detect` requests

### Workspace Import Failing
1. **Verify ZIP file structure**:
   - Must contain `package.json`
   - Must contain `next.config.ts` or `next.config.js`
   - Recommended: Include `.next/` directory for faster startup
2. **Check file size**: Default limit is 50MB
3. **Verify disk space**: `df -h` (Linux/Mac) or `dir C:\` (Windows)
4. **Check port availability**:
   ```bash
   # Windows
   netstat -ano | findstr ":3008"
   
   # Linux/Mac
   lsof -i :3008
   ```
5. **Check workspace permissions**: Directory must be writable

### Kannada/Hindi Routes Not Found (404)
1. **Verify imported project structure**:
   - Contains `/profile-hi-shot` route
   - Contains `/calendar-kn-shot` route
2. **Check project's `next.config.ts`** for custom route rewrites
3. **Ensure imported project dev server** is running on correct port
4. **Check `/app/` directory** in imported project for route files
5. **Test route manually**: Visit `http://localhost:3008/profile-hi-shot` in browser

### IDE Menu Buttons Not Working
1. **Check TopBar.tsx** imports: Should have all necessary handlers
2. **Verify callbacks** passed from page.tsx to TopBar
3. **Browser console** for click handler errors
4. **Try keyboard shortcuts** (Ctrl+Z for undo, Ctrl+1 for builder, etc.)

### Language Dropdown Not Changing UI
1. **Verify Lingo.dev SDK** is initialized in layout.tsx
2. **Check translation cache files** exist in `src/app/lingo/cache/`
3. **Verify component uses** `useLingoContext()` hook correctly
4. **Check `t()` translation keys** exist in cache files
5. **Hard-reload page** after language change (browser may cache)

## 📝 Contributing

Interested in contributing? Great! Here's how:

1. **Fork the repository**
   ```bash
   git clone <your-fork-url>
   cd voice-runtime
   ```

2. **Create feature branch**
   ```bash
   git checkout -b feature/my-amazing-feature
   ```

3. **Make your changes**
   - Follow TypeScript strict mode
   - Add comments for complex logic
   - Test mobile responsiveness

4. **Commit with clear messages**
   ```bash
   git commit -am 'feat: add my amazing feature'
   git commit -am 'fix: resolve bug in builder'
   git commit -am 'docs: update API documentation'
   ```

5. **Push to your branch**
   ```bash
   git push origin feature/my-amazing-feature
   ```

6. **Open Pull Request**
   - Describe changes clearly
   - Link related issues
   - Add screenshots for UI changes

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Lingo.dev** - Industry-leading localization and translation SDK
- **Next.js** - The React framework for production applications
- **Tailwind CSS** - Utility-first CSS framework
- **Vercel** - Modern deployment platform and infrastructure
- **Web Audio API** - Browser standard for audio processing
- Open source community for inspiration and tools

## 📞 Support & Contact

### Getting Help
1. **Check existing issues**: [GitHub Issues](https://github.com/your-repo/issues)
2. **Watch demo video**: [YouTube Voxera Demo](https://youtu.be/AEj133txDt4?si=vQ9J2YtGqHUjOcd_)
3. **Read documentation**: Check AGENTS.md, CONTEXT_SESSION.md for advanced topics
4. **Open new issue**: Include reproduction steps, error logs, and environment info

### Quick Help Resources
- [Troubleshooting](#troubleshooting) section above
- [API Documentation](#api-endpoints) for integration
- [Voice Commands](#voice-commands) reference
- [Architecture](#architecture-highlights) deep dive

### Feedback
- Feature requests welcome! Open an issue with `[FEATURE]` tag
- Bug reports: Include console errors and steps to reproduce
- Performance issues: Include browser dev tools profiling data

---

<div align="center">

**Built with ❤️ for voice-first development**

[⭐ Star us on GitHub](https://github.com/your-repo) | [🎬 Watch Demo](https://youtu.be/AEj133txDt4?si=vQ9J2YtGqHUjOcd_) | [📖 Full Documentation](./CONTEXT_SESSION.md)

</div>
