# 🎵 Melodata

A beautiful, native music metadata editor for macOS. Edit ID3 tags, auto-fetch metadata from MusicBrainz, and download album covers — all in a gorgeous, minimal interface.

![Melodata](https://img.shields.io/badge/platform-macOS-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Edit ID3 tags** — title, artist, album, year, genre, track number
- **Auto-fetch metadata** from MusicBrainz database
- **Download album covers** from Cover Art Archive
- **Batch editing** — load entire folders recursively
- **Dark & Light themes** — toggle with one click
- **Native macOS experience** — hidden title bar, traffic lights, smooth animations

## Screenshots

*Dark and light themes with a clean, modern three-panel layout.*

## Installation

### From Source

```bash
git clone https://github.com/yourusername/melodata.git
cd melodata
npm install
npm start
```

### Build for Distribution

```bash
npm run build:mac
```

## Usage

1. **Add files** — Click "+ Добавить файлы" or "📂 Открыть папку"
2. **Select a track** — Click any track in the list to open the editor
3. **Auto-fill metadata** — Type a song name and click "✦ Найти" to search MusicBrainz
4. **Apply results** — Click a search result to fill all fields + download cover
5. **Save** — Click "💾 Сохранить" to write tags back to the file

## Supported Formats

MP3, FLAC, AAC, M4A, OGG, WAV

## Tech Stack

- **Electron** — Desktop app framework
- **music-metadata** — Read audio file metadata
- **node-id3** — Write ID3 tags
- **MusicBrainz API** — Music metadata database
- **Cover Art Archive** — Album artwork

## License

MIT © 2024 Melodata
