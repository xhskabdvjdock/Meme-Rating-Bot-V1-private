#!/bin/bash

# تثبيت yt-dlp
echo "Installing yt-dlp..."
wget -q https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /opt/render/project/.render/yt-dlp
chmod +x /opt/render/project/.render/yt-dlp

# إضافة للـ PATH
export PATH="/opt/render/project/.render:$PATH"

# التحقق
if command -v yt-dlp &> /dev/null; then
    echo "✅ yt-dlp installed successfully"
    yt-dlp --version
else
    echo "❌ yt-dlp installation failed"
    exit 1
fi

echo "✅ Build completed successfully"
