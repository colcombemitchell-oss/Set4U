import test from "node:test";
import assert from "node:assert/strict";

import {
  addSet,
  addSong,
  addSongToSet,
  createDefaultState,
  deleteSet,
  deleteSong,
  duplicateSet,
  moveSongInSet,
  normalizeState,
  removeSongFromSet,
  renameSet,
  updateSong
} from "../model.js";

test("the original Set4U setlists contain the agreed 17 songs in order", () => {
  const state = createDefaultState("2026-08-10T00:00:00.000Z");
  const titles = new Map(state.songs.map((song) => [song.id, song.title]));

  assert.equal(state.sets.length, 2);
  assert.deepEqual(
    state.sets[0].songIds.map((id) => titles.get(id)),
    [
      "Stand By Me",
      "Viva La Vida",
      "Dreams",
      "Saturday Night",
      "Valerie",
      "Will We Talk?",
      "Still The One",
      "Man I Need",
      "She Will Be Loved",
      "Dancing Queen",
      "Love Story",
      "Can’t Take My Eyes Off You",
      "Sit Down",
      "The Way You Make Me Feel",
      "Believe",
      "Bet You Look Good On The Dancefloor",
      "Sex On Fire"
    ]
  );
  assert.deepEqual(
    state.sets[1].songIds.map((id) => titles.get(id)),
    [
      "Morning Glory",
      "Dancing In The Moonlight",
      "17 Going Under",
      "Teenage Dirtbag",
      "Dakota",
      "Summer Of 69",
      "Dancing In The Dark",
      "Shut Up And Dance",
      "Pink Pony Club",
      "Yellow",
      "All The Small Things",
      "Angels",
      "Simply The Best",
      "Year 3000",
      "Don’t Look Back In Anger",
      "Mr Brightside",
      "Country Roads"
    ]
  );
});

test("songs can be added, edited, placed in a set and removed without mutating the input", () => {
  const original = createDefaultState();
  const added = addSong(
    original,
    { title: "New Song", artist: "The Band", key: "G", bpm: "124", notes: "Capo 2" },
    "song-new"
  );

  assert.equal(original.songs.some((song) => song.id === "song-new"), false);
  assert.deepEqual(added.songs.at(-1), {
    id: "song-new",
    title: "New Song",
    artist: "The Band",
    key: "G",
    bpm: 124,
    notes: "Capo 2",
    performanceSheet: "",
    sheetScrollSpeed: 28
  });

  const edited = updateSong(added, "song-new", {
    title: "New Song (Acoustic)",
    artist: "The Band",
    key: "A",
    bpm: 126,
    notes: "",
    performanceSheet: "Own chord notes",
    sheetScrollSpeed: 40
  });
  const placed = addSongToSet(edited, "set-1", "song-new");
  assert.equal(placed.sets[0].songIds.at(-1), "song-new");

  const deleted = deleteSong(placed, "song-new");
  assert.equal(deleted.songs.some((song) => song.id === "song-new"), false);
  assert.equal(deleted.sets[0].songIds.includes("song-new"), false);
});

test("a setlist can be reordered and a single occurrence removed", () => {
  const original = createDefaultState();
  const first = original.sets[0].songIds[0];
  const second = original.sets[0].songIds[1];
  const moved = moveSongInSet(original, "set-1", 0, 1);

  assert.equal(moved.sets[0].songIds[0], second);
  assert.equal(moved.sets[0].songIds[1], first);
  assert.equal(original.sets[0].songIds[0], first);

  const repeated = addSongToSet(moved, "set-1", first);
  const removed = removeSongFromSet(repeated, "set-1", 1);
  assert.equal(removed.sets[0].songIds.filter((id) => id === first).length, 1);
});

test("sets can be created, renamed, duplicated and deleted while one set always remains", () => {
  const original = createDefaultState();
  const created = addSet(original, "Encore", "encore");
  assert.equal(created.activeSetId, "encore");

  const renamed = renameSet(created, "encore", "Last songs");
  assert.equal(renamed.sets.at(-1).name, "Last songs");

  const duplicated = duplicateSet(renamed, "set-1", "set-1-copy");
  assert.deepEqual(duplicated.sets.at(-1).songIds, original.sets[0].songIds);

  const oneSet = {
    ...original,
    sets: [original.sets[0]],
    activeSetId: original.sets[0].id
  };
  assert.throws(() => deleteSet(oneSet, "set-1"), /at least one setlist/i);
});

test("an imported backup is cleaned and unknown song references are ignored", () => {
  const imported = normalizeState(
    {
      songs: [
        { id: "one", title: " One ", bpm: "100" },
        { id: "one", title: "Duplicate ID" },
        { id: "empty", title: " " }
      ],
      sets: [{ id: "gig", name: " Gig ", songIds: ["one", "missing"] }],
      activeSetId: "missing-set"
    },
    "2026-08-10T00:00:00.000Z"
  );

  assert.equal(imported.songs.length, 1);
  assert.equal(imported.songs[0].title, "One");
  assert.equal(imported.songs[0].bpm, 100);
  assert.deepEqual(imported.sets[0], { id: "gig", name: "Gig", songIds: ["one"] });
  assert.equal(imported.activeSetId, "gig");
});

test("legacy private text is migrated into a performance sheet", () => {
  const imported = normalizeState({
    songs: [{ id: "legacy", title: "Old Song", lyrics: "G   Em\nOld cue", sheetScrollSpeed: 500 }],
    sets: [{ id: "gig", name: "Gig", songIds: ["legacy"] }]
  });

  assert.equal(imported.songs[0].performanceSheet, "G   Em\nOld cue");
  assert.equal(imported.songs[0].sheetScrollSpeed, 80);
  assert.equal("lyrics" in imported.songs[0], false);
});

test("invalid backups are rejected with a useful message", () => {
  assert.throws(() => normalizeState({ songs: [], sets: [] }), /valid songs/i);
  assert.throws(() => normalizeState({}), /not a Set4U backup/i);
  assert.throws(() => addSong(createDefaultState(), { title: " " }, "blank"), /title/i);
});
