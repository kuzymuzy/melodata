const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('melodata', {
  openFiles: () => ipcRenderer.invoke('open-files'),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  readTags: (filePath) => ipcRenderer.invoke('read-tags', filePath),
  saveTags: (data) => ipcRenderer.invoke('save-tags', data),
  searchMusicBrainz: (query) => ipcRenderer.invoke('search-musicbrainz', query),
  fetchReleaseDetails: (data) => ipcRenderer.invoke('fetch-release-details', data),
  fetchCover: (releaseId) => ipcRenderer.invoke('fetch-cover', releaseId),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme')
})
