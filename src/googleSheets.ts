const driveFilesUrl = 'https://www.googleapis.com/drive/v3/files'
const sheetsUrl = 'https://sheets.googleapis.com/v4/spreadsheets'
const spreadsheetMimeType = 'application/vnd.google-apps.spreadsheet'
const spreadsheetName = 'Project X GPS Log'

const sheetHeaders = [
  'Photo name',
  'Drive link',
  'Latitude',
  'Longitude',
  'Capture timestamp',
  'Upload timestamp',
]

type DriveSearchResponse = {
  files: Array<{ id: string; name: string }>
}

type SpreadsheetResponse = {
  spreadsheetId: string
  spreadsheetUrl?: string
}

export type SpreadsheetResult = {
  id: string
  name: string
  status: 'Created' | 'Reused'
  url?: string
}

async function googleRequest<T>(accessToken: string, input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Google Sheets request failed (${response.status}): ${details || response.statusText}`)
  }

  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>
}

async function ensureHeaders(accessToken: string, spreadsheetId: string): Promise<void> {
  const range = encodeURIComponent('Sheet1!A1:F1')
  await googleRequest(accessToken, `${sheetsUrl}/${spreadsheetId}/values/${range}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [sheetHeaders] }),
  })
}

export async function findOrCreateLogSheet(accessToken: string, folderId: string): Promise<SpreadsheetResult> {
  const query = [
    `'${folderId}' in parents`,
    `name = '${spreadsheetName}'`,
    `mimeType = '${spreadsheetMimeType}'`,
    'trashed = false',
  ].join(' and ')
  const params = new URLSearchParams({
    q: query,
    spaces: 'drive',
    fields: 'files(id,name)',
    pageSize: '1',
  })
  const existing = await googleRequest<DriveSearchResponse>(accessToken, `${driveFilesUrl}?${params}`)

  if (existing.files[0]) {
    await ensureHeaders(accessToken, existing.files[0].id)
    return { id: existing.files[0].id, name: existing.files[0].name, status: 'Reused' }
  }

  const created = await googleRequest<SpreadsheetResponse>(accessToken, sheetsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: { title: spreadsheetName } }),
  })

  const moveParams = new URLSearchParams({
    addParents: folderId,
    removeParents: 'root',
    fields: 'id,name',
  })
  await googleRequest(accessToken, `${driveFilesUrl}/${created.spreadsheetId}?${moveParams}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  await ensureHeaders(accessToken, created.spreadsheetId)

  return {
    id: created.spreadsheetId,
    name: spreadsheetName,
    status: 'Created',
    url: created.spreadsheetUrl,
  }
}

export type PhotoLogRow = {
  photoName: string
  driveLink: string
  latitude: number | null
  longitude: number | null
  captureTimestamp: string | null
  uploadTimestamp: string
}

export async function appendPhotoLogRow(
  accessToken: string,
  spreadsheetId: string,
  row: PhotoLogRow,
): Promise<void> {
  const values = [[
    row.photoName,
    row.driveLink,
    row.latitude === null ? 'Unavailable' : row.latitude,
    row.longitude === null ? 'Unavailable' : row.longitude,
    row.captureTimestamp ?? 'Unavailable',
    row.uploadTimestamp,
  ]]
  const range = encodeURIComponent('Sheet1!A:F')

  await googleRequest(accessToken, `${sheetsUrl}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })
}

export type PhotoLogEntry = PhotoLogRow

export async function readPhotoLogRows(accessToken: string, spreadsheetId: string): Promise<PhotoLogEntry[]> {
  const range = encodeURIComponent('Sheet1!A2:F')
  const result = await googleRequest<{ values?: string[][] }>(
    accessToken,
    `${sheetsUrl}/${spreadsheetId}/values/${range}`,
  )

  return (result.values ?? []).map((values) => ({
    photoName: values[0] ?? '',
    driveLink: values[1] ?? '',
    latitude: values[2] && values[2] !== 'Unavailable' ? Number(values[2]) : null,
    longitude: values[3] && values[3] !== 'Unavailable' ? Number(values[3]) : null,
    captureTimestamp: values[4] && values[4] !== 'Unavailable' ? values[4] : null,
    uploadTimestamp: values[5] ?? '',
  }))
}