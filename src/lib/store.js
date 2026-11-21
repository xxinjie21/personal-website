// 本站是纯阅读站点：不读写本地存储，也不访问云端接口。
// 这里只保留一份空的进度结构，供视图层按"未开始"统一渲染，避免各处再写空判断。
const EMPTY = Object.freeze({
  noteStatus: Object.freeze({}),
  wordProgress: Object.freeze({ count: 0, round: 0, lastDate: '' }),
  updatedAt: '',
})

export function getProgress() {
  return EMPTY
}

export function getSyncStatus() {
  return 'readonly'
}

export async function initSync() {
  return EMPTY
}

export function updateProgress() {
  return EMPTY
}
