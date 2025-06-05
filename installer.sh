#!/bin/bash

# Scopy Installer Script
# This script installs Scopy and removes quarantine attributes

echo "🚀 Installing Scopy..."

# Check if running with sudo
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please run this installer WITHOUT sudo"
    exit 1
fi

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_PATH="$SCRIPT_DIR/scopy.app"

# Check if scopy.app exists in the same directory
if [ ! -d "$APP_PATH" ]; then
    echo "❌ Error: scopy.app not found in the same directory as this installer"
    echo "Please make sure scopy.app is in the same folder as this installer script"
    exit 1
fi

# Copy app to Applications
echo "📁 Copying Scopy to Applications folder..."
if cp -R "$APP_PATH" /Applications/; then
    echo "✅ App copied successfully"
else
    echo "❌ Failed to copy app to Applications"
    echo "You may need to provide administrator password:"
    sudo cp -R "$APP_PATH" /Applications/
fi

# Remove quarantine attributes
echo "🔓 Removing security restrictions..."
xattr -cr /Applications/scopy.app

if [ $? -eq 0 ]; then
    echo "✅ Security restrictions removed"
else
    echo "⚠️  Warning: Could not remove all security restrictions"
    echo "You may need to right-click the app and select 'Open' the first time"
fi

echo ""
echo "🎉 Installation complete!"
echo "You can now find Scopy in your Applications folder"
echo ""
echo "To launch Scopy:"
echo "• Open Applications folder"
echo "• Double-click Scopy"
echo "• Or use Spotlight: Press Cmd+Space and type 'Scopy'"
echo ""
read -p "Press Enter to continue..."