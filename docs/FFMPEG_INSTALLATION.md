# FFmpeg Installation Guide for Voice Chat

## Overview

The voice chat feature requires **FFmpeg** to convert WebM audio files (recorded from the browser) to WAV format for transcription.

## Why FFmpeg is Needed

- Browsers record audio in **WebM format** (using MediaRecorder API)
- The STT service needs **WAV format** for processing
- **FFmpeg** is used to convert WebM → WAV

## Installation Instructions

### Windows

#### Option 1: Using winget (Recommended)
```powershell
winget install ffmpeg
```

#### Option 2: Manual Installation
1. Download FFmpeg from: https://ffmpeg.org/download.html
   - Or use direct link: https://www.gyan.dev/ffmpeg/builds/
2. Extract the ZIP file
3. Add FFmpeg to your system PATH:
   - Copy the path to the `bin` folder (e.g., `C:\ffmpeg\bin`)
   - Open System Properties → Environment Variables
   - Add the path to "Path" variable
4. Restart your terminal/IDE

#### Option 3: Using Chocolatey
```powershell
choco install ffmpeg
```

### Verify Installation

After installation, verify FFmpeg is available:

```powershell
ffmpeg -version
```

You should see version information if installed correctly.

### Linux

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install ffmpeg

# Fedora
sudo dnf install ffmpeg

# Arch Linux
sudo pacman -S ffmpeg
```

### macOS

```bash
# Using Homebrew
brew install ffmpeg
```

## Troubleshooting

### Error: "FFmpeg is required to convert WebM files"

**Solution**: Install FFmpeg using one of the methods above and ensure it's in your system PATH.

### Error: "ffmpeg: command not found"

**Solution**: 
1. Verify FFmpeg is installed: `ffmpeg -version`
2. If not found, add FFmpeg to your system PATH
3. Restart your terminal/IDE after adding to PATH

### Error: "Failed to convert audio file"

**Solution**:
1. Ensure FFmpeg is properly installed
2. Check that the audio file is not corrupted
3. Verify file permissions

## Testing

After installing FFmpeg, test the voice chat feature:

1. Start the Django backend: `python manage.py runserver`
2. Navigate to the voice chat page
3. Record a voice message
4. The WebM file should be automatically converted to WAV and transcribed

## Alternative Solutions (Future)

If FFmpeg installation is problematic, we could:
- Use a different audio format (requires browser changes)
- Implement server-side WebM decoding (more complex)
- Use a cloud-based transcription service (requires API key)

For now, FFmpeg is the most reliable solution.

