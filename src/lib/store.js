// 本地存储层 + Worker 同步预留
// 进度结构：
// {
//   noteStatus: { [noteId]: 'not-started' | 'learning' | 'mastered' },
//   wordProgress: { count: number, round: number, lastDate: string },
//   updatedAt: string
// }

const WORKER_URL = import.meta.env.VITE_WORKER_URL || ''
const AUTH_KEY = import.meta.env.VITE_AUTH_KEY || ''
const LS_KEY = 'pw-progress'
const DEBOUNCE_MS = 800

const DEFAULT_PROGRESS = {
  noteStatus: {},
  wordProgress: { count: 0, round: 0, lastDate: '' },
  updatedAt: '',
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return structuredClone(DEFAULT_PROGRESS)
    const parsed = JSON.parse(raw)
    return {
      ...structuredClone(DEFAULT_PROGRESS),
      ...parsed,
      noteStatus: { ...(parsed.noteStatus || {}) },
      wordProgress: { ...DEFAULT_PROGRESS.wordProgress, ...(parsed.wordProgress || {}) },
    }
  } catch {
    return structuredClone(DEFAULT_PROGRESS)
  }
}

function writeLocal(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data))
}

// 远端覆盖本地（方案：打开站点 Worker 拉取覆盖本地）；字段级合并
function mergeRemote(local, remote) {
  return {
    noteStatus: { ...local.noteStatus, ...(remote.noteStatus || {}) },
    wordProgress: { ...local.wordProgress, ...(remote.wordProgress || {}) },
    updatedAt: remote.updatedAt || local.updatedAt,
  }
}

let state = readLocal()
let pushTimer = null
let syncStatus = 'idle' // idle | syncing | online | offline | error

function authHeaders() {
  return AUTH_KEY ? { Authorization: `Bearer ${AUTH_KEY}` } : {}
}

async function fetchRemote() {
  if (!WORKER_URL) {
    syncStatus = 'offline'
    return state
  }
  syncStatus = 'syncing'
  try {
    const r = await fetch(WORKER_URL, { headers: authHeaders() })
    if (!r.ok) throw new Error(`worker ${r.status}`)
    const remote = await r.json()
    state = mergeRemote(state, remote || {})
    writeLocal(state)
    syncStatus = 'online'
  } catch (err) {
    // 离线 / Worker 不可用：回退纯本地
    console.warn('[sync] 拉取失败，回退本地：', err)
    syncStatus = 'offline'
  }
  return state
}

async function pushRemote(data) {
  if (!WORKER_URL) return
  try {
    const r = await fetch(WORKER_URL, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!r.ok) throw new Error(`worker ${r.status}`)
    syncStatus = 'online'
  } catch (err) {
    console.warn('[sync] 推送失败，保留本地：', err)
    syncStatus = 'offline'
  }
}

function schedulePush() {
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => pushRemote(state), DEBOUNCE_MS)
}

export function getProgress() {
  return state
}

export function getSyncStatus() {
  return syncStatus
}

// 启动时调用：拉取远端合并本地；失败保留本地
export async function initSync() {
  return fetchRemote()
}

// 改动入口：patch 为部分字段，更新本地并防抖推回 Gist
export function updateProgress(patch) {
  state = {
    ...state,
    ...patch,
    noteStatus: { ...state.noteStatus, ...(patch.noteStatus || {}) },
    wordProgress: { ...state.wordProgress, ...(patch.wordProgress || {}) },
    updatedAt: new Date().toISOString(),
  }
  writeLocal(state)
  schedulePush()
  return state
}
