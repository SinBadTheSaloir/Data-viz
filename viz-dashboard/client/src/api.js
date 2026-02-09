const BASE = '/api';

async function fetchJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  getBooks: () => fetchJSON('/books'),
  getBook: (id) => fetchJSON(`/books/${id}`),
  getHeartbeat: (id) => fetchJSON(`/books/${id}/heartbeat`),
  getTrajectory: (id) => fetchJSON(`/books/${id}/trajectory`),
  getRelationships: (id) => fetchJSON(`/books/${id}/relationships`),
  getAllHeartbeats: () => fetchJSON('/heartbeats'),
  getAllTrajectories: () => fetchJSON('/trajectories'),
  getCultures: () => fetchJSON('/cultures'),
  getCultureAverages: () => fetchJSON('/culture-averages'),
  getConfig: () => fetchJSON('/config'),
  getCharacterData: (id) => fetchJSON(`/books/${id}/character-data`),
};
