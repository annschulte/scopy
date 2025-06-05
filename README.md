# scopy - Smart Clipboard + AI Promptify

🚀 **You copy (Cmd+Shift+C) like you always do** — scopy watches silently, analyzes the text, figures out what it is (Slack? Email? LinkedIn?), builds a perfect prompt, and enhances your clipboard.

No scraping, no weird OCR, no clicking around — just **"Smart Clipboard + Promptify"**.

## ✨ How It Works

**Passive Mode (Primary):**

- Copy **anything** with Cmd+Shift+C like normal
- scopyy instantly detects content type and source app
- Automatically enhances with AI-ready prompts
- Replaces your clipboard with enhanced version
- Paste into ChatGPT/Claude for instant insights

**Intentional Mode (Backup):**

- Press **Cmd+Shft+C** for manual capture
- Works even when smart clipboard is disabled

## 🎯 Smart Enhancement Types

- **📧 Emails** → Reply suggestions, tone analysis, action items
- **💬 Chat (Slack/Discord)** → Response ideas, context analysis
- **💼 LinkedIn** → Professional networking prompts
- **💻 Code** → Explanations, debugging, testing suggestions
- **📰 Articles** → Summaries, key insights, discussion points
- **📝 General Text** → Explanations, applications, follow-up questions

## 🛠 Setup

### Prerequisites

- macOS (tested on macOS 14+)
- Node.js 18+ and npm

### Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Build the app:**

   ```bash
   npm run build
   ```

3. **Start scopyy:**
   ```bash
   npm start
   ```

### First Time Setup

1. **Grant Screen Recording Permissions:**
   - Required for window context detection
   - System Settings → Privacy & Security → Screen Recording
   - Add scopyy to the allowed list
   - Restart scopyy

_Note: No accessibility permissions needed! Smart clipboard uses standard clipboard monitoring._

## 🎯 Usage

**Smart Clipboard (Automatic):**

1. Copy **anything** with Cmd+C (emails, code, articles, etc.)
2. Content is instantly enhanced with AI prompts
3. Paste into ChatGPT/Claude for instant insights!

**Manual Capture:**

1. Press **Cmd+Option+C** for intentional capture
2. Works for complex scenarios or when smart clipboard is disabled

**Settings:**

- Right-click tray icon to toggle Smart Clipboard on/off
- Configure enhancement criteria in the app

## 🏗 Architecture

- **TypeScript** for type safety and modern development
- **Smart Clipboard Monitoring** - watches Cmd+C operations passively
- **active-win** for accurate window context detection
- **clipboardy** for robust clipboard operations
- **Electron** for native desktop integration
- **AI Service** with fallback to template-based enhancement

## 📝 Example Output

**Copy code from VS Code with Cmd+C:**

```
# 💻 Code Enhanced

**Source:** Visual Studio Code - smart-clipboard.ts
**Type:** Code
**Enhanced:** 6/5/2025, 2:15:43 PM

## Original Content:
function detectContentType(content: string, windowInfo: any): string {
  const lower = content.toLowerCase();
  // ... rest of function
}

## 🤖 Smart Prompts:
• "Explain what this code does step by step"
• "Are there any bugs or improvements possible?"
• "Write unit tests for this code"
• "Refactor this code for better readability"

## 💡 Quick Actions:
• Paste this into ChatGPT, Claude, or your preferred AI
• The content is pre-formatted for optimal AI interaction
• Try any of the suggested prompts above for instant insights

---
*Enhanced by scopyy Smart Clipboard*
```

## 🚧 Development

### Commands

- `npm run build` - Compile TypeScript
- `npm run dev` - Run in development mode
- `npm start` - Start the hotkey listener
- `npm run electron` - Launch Electron GUI

### File Structure

```
src/
├── main.ts              # Electron main process & app lifecycle
├── smart-clipboard.ts   # 🚀 NEW: Smart clipboard monitoring
├── clipboard-handler.ts # Manual capture operations
├── smart-context.ts     # Window context detection
├── ai-service.ts        # AI enhancement service
└── config.ts           # Configuration management
```

## 🔧 Troubleshooting

**Smart clipboard not enhancing copies?**

- Check if Smart Clipboard is enabled in tray menu
- Try copying longer text (minimum 20 characters)
- Check Screen Recording permissions for app context
- Restart services via tray menu

**Manual hotkey not working?**

- Make sure no other app is using Cmd+Option+C
- Restart services via tray menu

**Build errors?**

- Ensure Node.js 18+ is installed
- Run `npm install` to update dependencies
- Check that TypeScript is properly installed

## 📄 License

MIT License - feel free to modify and distribute!
