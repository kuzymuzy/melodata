const { app, BrowserWindow, ipcMain, dialog, nativeTheme } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')

let win

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 860,
    minHeight: 560,
    titleBarStyle: 'hiddenInset',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#8b8b9e',
      height: 52
    },
    backgroundColor: '#0c0c10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.loadFile(path.join(__dirname, 'index.html'))
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// --- HTTP HELPERS ---

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Melodata/1.0 (https://github.com/melodata/melodata)',
        'Accept': 'application/json'
      }
    }, (res) => {
      // Follow redirects manually
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpGet(res.headers.location).then(resolve).catch(reject)
        return
      }
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }))
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')) })
  })
}

function httpGetBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Melodata/1.0 (https://github.com/melodata/melodata)' }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpGetBuffer(res.headers.location).then(resolve).catch(reject)
        return
      }
      if (res.statusCode === 200) {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
      } else {
        resolve(null)
      }
    })
    req.on('error', () => resolve(null))
    req.setTimeout(15000, () => { req.destroy(); resolve(null) })
  })
}

// --- FILE DIALOGS ---

ipcMain.handle('open-files', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'flac', 'aac', 'm4a', 'ogg', 'wav'] }]
  })
  return result.filePaths
})

ipcMain.handle('open-folder', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  })
  if (result.filePaths.length === 0) return []
  const folder = result.filePaths[0]
  const exts = ['.mp3', '.flac', '.aac', '.m4a', '.ogg', '.wav']

  function scanDir(dir) {
    let results = []
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        results = results.concat(scanDir(full))
      } else if (exts.includes(path.extname(entry.name).toLowerCase())) {
        results.push(full)
      }
    }
    return results
  }

  return scanDir(folder)
})

// --- READ TAGS ---

ipcMain.handle('read-tags', async (_, filePath) => {
  try {
    const mm = require('music-metadata')
    const metadata = await mm.parseFile(filePath)
    const tags = metadata.common

    let coverBase64 = null
    if (tags.picture && tags.picture.length > 0) {
      const pic = tags.picture[0]
      coverBase64 = `data:${pic.format};base64,${pic.data.toString('base64')}`
    }

    return {
      title: tags.title || '',
      artist: tags.artist || '',
      album: tags.album || '',
      year: tags.year ? String(tags.year) : '',
      genre: (Array.isArray(tags.genre) ? tags.genre[0] : tags.genre) || '',
      track: tags.track?.no != null ? String(tags.track.no) : '',
      trackTotal: tags.track?.of != null ? String(tags.track.of) : '',
      cover: coverBase64,
      filePath
    }
  } catch (e) {
    return { error: e.message, filePath }
  }
})

// --- SAVE TAGS ---

ipcMain.handle('save-tags', async (_, { filePath, tags }) => {
  try {
    const NodeID3 = require('node-id3')

    const trackNum = tags.track ? parseInt(tags.track, 10) : undefined
    const trackOf = tags.trackTotal ? parseInt(tags.trackTotal, 10) : undefined

    const id3Tags = {
      title: tags.title || '',
      artist: tags.artist || '',
      album: tags.album || '',
      year: tags.year || '',
      genre: tags.genre || '',
      trackNumber: trackNum ? String(trackNum) : ''
    }

    if (trackNum && trackOf) {
      id3Tags.trackNumber = `${trackNum}/${trackOf}`
    }

    if (tags.cover && tags.cover.startsWith('data:')) {
      const matches = tags.cover.match(/^data:(.+);base64,(.+)$/)
      if (matches) {
        id3Tags.image = {
          mime: matches[1],
          type: { id: 3, name: 'front cover' },
          description: 'Cover',
          imageBuffer: Buffer.from(matches[2], 'base64')
        }
      }
    }

    const success = NodeID3.write(id3Tags, filePath)
    return { success: success === true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// --- MUSICBRAINZ SEARCH ---

ipcMain.handle('search-musicbrainz', async (_, query) => {
  try {
    const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&limit=8&fmt=json`
    const res = await httpGet(url)
    if (res.status !== 200) return []

    const json = JSON.parse(res.data)
    return (json.recordings || []).slice(0, 8).map(r => ({
      title: r.title || '',
      artist: r['artist-credit']?.[0]?.name || '',
      album: r.releases?.[0]?.title || '',
      year: r.releases?.[0]?.date?.substring(0, 4) || '',
      releaseId: r.releases?.[0]?.id || '',
      recordingId: r.id || '',
      length: r.length || 0
    }))
  } catch (e) {
    console.error('MusicBrainz search error:', e.message)
    return []
  }
})

// --- FETCH RELEASE DETAILS (track number, genre, track count) ---

ipcMain.handle('fetch-release-details', async (_, { releaseId, recordingId }) => {
  try {
    const url = `https://musicbrainz.org/ws/2/release/${releaseId}?inc=recordings+tags+artist-credits&fmt=json`
    const res = await httpGet(url)
    if (res.status !== 200) {
      return { track: '', trackTotal: '', genre: '', artist: '' }
    }

    const json = JSON.parse(res.data)

    // --- Genre: pick the most relevant tag ---
    let genre = ''
    if (json.tags && json.tags.length > 0) {
      const sorted = [...json.tags].sort((a, b) => (b.count || 0) - (a.count || 0))
      genre = sorted[0]?.name || ''
    }

    // --- Track number: find the matching recording in the medium ---
    let track = ''
    let trackTotal = ''
    if (json.media && json.media.length > 0) {
      const medium = json.media[0]
      trackTotal = medium['track-count'] ? String(medium['track-count']) : ''

      if (recordingId && medium.tracks) {
        const found = medium.tracks.find(t => t.recording?.id === recordingId)
        if (found) {
          track = found.position || found.number || ''
        }
      }

      // Fallback: if no recordingId match, use the first track position
      if (!track && medium.tracks && medium.tracks.length > 0) {
        track = medium.tracks[0].position || medium.tracks[0].number || ''
      }
    }

    // --- Artist ---
    const artist = json['artist-credit']?.[0]?.name || ''

    return { track: track || '', trackTotal: trackTotal || '', genre, artist }
  } catch (e) {
    console.error('Release details error:', e.message)
    return { track: '', trackTotal: '', genre: '', artist: '' }
  }
})

// --- FETCH COVER from Cover Art Archive ---

ipcMain.handle('fetch-cover', async (_, releaseId) => {
  // Try multiple sizes in order
  const sizes = [500, 250, 1200]
  for (const size of sizes) {
    try {
      const url = `https://coverartarchive.org/release/${releaseId}/front-${size}`
      const buf = await httpGetBuffer(url)
      if (buf && buf.length > 100) {
        return `data:image/jpeg;base64,${buf.toString('base64')}`
      }
    } catch (e) {
      // try next size
    }
  }
  // Try the generic front image (no size suffix)
  try {
    const url = `https://coverartarchive.org/release/${releaseId}/front`
    const buf = await httpGetBuffer(url)
    if (buf && buf.length > 100) {
      return `data:image/jpeg;base64,${buf.toString('base64')}`
    }
  } catch (e) {
    // no cover available
  }
  return null
})

// --- THEME ---

ipcMain.handle('get-theme', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
})

ipcMain.handle('set-theme', (_, theme) => {
  if (theme === 'system') {
    nativeTheme.themeSource = 'system'
  } else {
    nativeTheme.themeSource = theme
  }
})

ipcMain.handle('get-system-theme', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
})
