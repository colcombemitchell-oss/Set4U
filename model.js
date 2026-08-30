import { DEFAULT_SETS, DEFAULT_SONGS } from "./data.js?v=5";

export const SCHEMA_VERSION = 4;

const DEFAULT_SHEET_SCROLL_SPEED = 28;

const copy = (value) => structuredClone(value);
const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

const makeId = (prefix) => {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
};

const prepareSong = (song) => {
  const source = song && typeof song === "object" ? song : {};
  const rawScrollSpeed = Number(source.sheetScrollSpeed);
  return {
    id: cleanText(source.id) || makeId("song"),
    title: cleanText(source.title),
    artist: cleanText(source.artist),
    key: cleanText(source.key),
    bpm:
      Number.isFinite(Number(source.bpm)) && Number(source.bpm) > 0
        ? Math.round(Number(source.bpm))
        : null,
    notes: typeof source.notes === "string" ? source.notes.trim() : "",
    performanceSheet:
      typeof source.performanceSheet === "string"
        ? source.performanceSheet.trim()
        : typeof source.lyrics === "string"
          ? source.lyrics.trim()
          : "",
    sheetScrollSpeed: Number.isFinite(rawScrollSpeed)
      ? Math.min(80, Math.max(8, Math.round(rawScrollSpeed / 4) * 4))
      : DEFAULT_SHEET_SCROLL_SPEED
  };
};

export function createDefaultState(now = new Date().toISOString()) {
  return {
    version: SCHEMA_VERSION,
    songs: DEFAULT_SONGS.map(prepareSong),
    sets: copy(DEFAULT_SETS),
    activeSetId: DEFAULT_SETS[0].id,
    updatedAt: now
  };
}

export function migrateBundledSetlists(state, now = new Date().toISOString()) {
  const bundledSongs = new Map(DEFAULT_SONGS.map((song) => [song.id, song]));
  const seenSongIds = new Set();
  const songs = state.songs.map((song) => {
    seenSongIds.add(song.id);
    const bundled = bundledSongs.get(song.id);
    return prepareSong(
      bundled
        ? { ...song, title: bundled.title, artist: bundled.artist }
        : song
    );
  });

  DEFAULT_SONGS.forEach((song) => {
    if (!seenSongIds.has(song.id)) songs.push(prepareSong(song));
  });

  const bundledSetIds = new Set(DEFAULT_SETS.map((set) => set.id));
  const customSets = state.sets
    .filter((set) => !bundledSetIds.has(set.id))
    .map((set) => ({ ...set, songIds: [...set.songIds] }));
  const sets = [...copy(DEFAULT_SETS), ...customSets];

  return {
    ...state,
    version: SCHEMA_VERSION,
    songs,
    sets,
    activeSetId: sets.some((set) => set.id === state.activeSetId)
      ? state.activeSetId
      : DEFAULT_SETS[0].id,
    updatedAt: now
  };
}

export function normalizeState(candidate, now = new Date().toISOString()) {
  if (!candidate || !Array.isArray(candidate.songs) || !Array.isArray(candidate.sets)) {
    throw new Error("That file is not a Set4U backup.");
  }

  const seenSongIds = new Set();
  const songs = candidate.songs
    .map(prepareSong)
    .filter((song) => {
      if (!song.title || seenSongIds.has(song.id)) return false;
      seenSongIds.add(song.id);
      return true;
    });

  if (!songs.length) throw new Error("The backup does not contain any valid songs.");

  const validSongIds = new Set(songs.map((song) => song.id));
  const seenSetIds = new Set();
  const sets = candidate.sets
    .map((set) => ({
      id: cleanText(set?.id) || makeId("set"),
      name: cleanText(set?.name) || "Untitled set",
      songIds: Array.isArray(set?.songIds) ? set.songIds.filter((id) => validSongIds.has(id)) : []
    }))
    .filter((set) => {
      if (seenSetIds.has(set.id)) return false;
      seenSetIds.add(set.id);
      return true;
    });

  if (!sets.length) sets.push({ id: makeId("set"), name: "Set 1", songIds: [] });

  const activeSetId = sets.some((set) => set.id === candidate.activeSetId)
    ? candidate.activeSetId
    : sets[0].id;

  return {
    version: SCHEMA_VERSION,
    songs,
    sets,
    activeSetId,
    updatedAt: now
  };
}

const touch = (state) => ({ ...state, version: SCHEMA_VERSION, updatedAt: new Date().toISOString() });

export function addSong(state, details, id = makeId("song")) {
  const song = prepareSong({ ...details, id });
  if (!song.title) throw new Error("Add a song title first.");
  if (state.songs.some((item) => item.id === song.id)) throw new Error("That song ID is already in use.");
  return touch({ ...state, songs: [...state.songs, song] });
}

export function updateSong(state, songId, details) {
  if (!cleanText(details.title)) throw new Error("A song needs a title.");
  let found = false;
  const songs = state.songs.map((song) => {
    if (song.id !== songId) return song;
    found = true;
    return prepareSong({ ...song, ...details, id: song.id });
  });
  if (!found) throw new Error("Song not found.");
  return touch({ ...state, songs });
}

export function deleteSong(state, songId) {
  if (!state.songs.some((song) => song.id === songId)) return state;
  const songs = state.songs.filter((song) => song.id !== songId);
  const sets = state.sets.map((set) => ({
    ...set,
    songIds: set.songIds.filter((id) => id !== songId)
  }));
  return touch({ ...state, songs, sets });
}

export function addSet(state, name, id = makeId("set")) {
  const setName = cleanText(name);
  if (!setName) throw new Error("Give the set a name.");
  if (state.sets.some((set) => set.id === id)) throw new Error("That set ID is already in use.");
  return touch({
    ...state,
    sets: [...state.sets, { id, name: setName, songIds: [] }],
    activeSetId: id
  });
}

export function renameSet(state, setId, name) {
  const setName = cleanText(name);
  if (!setName) throw new Error("Give the set a name.");
  if (!state.sets.some((set) => set.id === setId)) throw new Error("Set not found.");
  return touch({
    ...state,
    sets: state.sets.map((set) => (set.id === setId ? { ...set, name: setName } : set))
  });
}

export function duplicateSet(state, setId, id = makeId("set")) {
  const source = state.sets.find((set) => set.id === setId);
  if (!source) throw new Error("Set not found.");
  const duplicated = { ...copy(source), id, name: `${source.name} copy` };
  return touch({
    ...state,
    sets: [...state.sets, duplicated],
    activeSetId: duplicated.id
  });
}

export function deleteSet(state, setId) {
  if (state.sets.length === 1) throw new Error("Keep at least one setlist.");
  const sets = state.sets.filter((set) => set.id !== setId);
  if (sets.length === state.sets.length) return state;
  return touch({
    ...state,
    sets,
    activeSetId: state.activeSetId === setId ? sets[0].id : state.activeSetId
  });
}

export function selectSet(state, setId) {
  if (!state.sets.some((set) => set.id === setId)) return state;
  return touch({ ...state, activeSetId: setId });
}

export function addSongToSet(state, setId, songId) {
  if (!state.songs.some((song) => song.id === songId)) throw new Error("Song not found.");
  if (!state.sets.some((set) => set.id === setId)) throw new Error("Set not found.");
  return touch({
    ...state,
    sets: state.sets.map((set) =>
      set.id === setId ? { ...set, songIds: [...set.songIds, songId] } : set
    )
  });
}

export function removeSongFromSet(state, setId, index) {
  return touch({
    ...state,
    sets: state.sets.map((set) => {
      if (set.id !== setId || index < 0 || index >= set.songIds.length) return set;
      return { ...set, songIds: set.songIds.filter((_, position) => position !== index) };
    })
  });
}

export function moveSongInSet(state, setId, fromIndex, toIndex) {
  const target = state.sets.find((set) => set.id === setId);
  if (!target) throw new Error("Set not found.");
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= target.songIds.length ||
    toIndex >= target.songIds.length ||
    fromIndex === toIndex
  ) {
    return state;
  }

  const songIds = [...target.songIds];
  const [moved] = songIds.splice(fromIndex, 1);
  songIds.splice(toIndex, 0, moved);
  return touch({
    ...state,
    sets: state.sets.map((set) => (set.id === setId ? { ...set, songIds } : set))
  });
}
