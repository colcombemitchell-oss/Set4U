import {
  addSet,
  addSong,
  addSongToSet,
  createDefaultState,
  deleteSet,
  deleteSong,
  duplicateSet,
  migrateBundledSetlists,
  moveSongInSet,
  normalizeState,
  removeSongFromSet,
  renameSet,
  selectSet,
  SCHEMA_VERSION,
  updateSong
} from "./model.js?v=4";

const STORAGE_KEY = "set4u-state-v1";

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const songDialog = document.querySelector("#song-dialog");
const songForm = document.querySelector("#song-form");
const performanceSheetInput = document.querySelector("#performance-sheet-input");
const setDialog = document.querySelector("#set-dialog");
const setForm = document.querySelector("#set-form");
const pickerDialog = document.querySelector("#picker-dialog");
const pickerSearch = document.querySelector("#picker-search");
const pickerList = document.querySelector("#picker-list");
const settingsDialog = document.querySelector("#settings-dialog");
const installDialog = document.querySelector("#install-dialog");

let state = loadState();
let currentView = "sets";
let songQuery = "";
let liveIndex = 0;
let liveScale = 1;
let liveScrollFrame = null;
let liveScrollButton = null;
let draggedIndex = null;
let deferredInstallPrompt = null;
let wakeLock = null;
let toastTimer = null;

const MAX_SHEET_FILE_SIZE = 1024 * 1024;

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return createDefaultState();

    const parsed = JSON.parse(saved);
    const normalized = normalizeState(parsed);
    const savedVersion = Number(parsed?.version);
    if (!Number.isFinite(savedVersion) || savedVersion < SCHEMA_VERSION) {
      const migrated = migrateBundledSetlists(normalized);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }

    return normalized;
  } catch (error) {
    console.warn("Set4U could not load the saved data.", error);
    return createDefaultState();
  }
}

function save(nextState, message = "") {
  state = nextState;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  if (message) showToast(message);
}

function persistWithoutRender(nextState) {
  state = nextState;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function stopLiveAutoScroll() {
  if (liveScrollFrame !== null) cancelAnimationFrame(liveScrollFrame);
  liveScrollFrame = null;
  if (liveScrollButton) {
    liveScrollButton.textContent = "Start auto-scroll";
    liveScrollButton.setAttribute("aria-pressed", "false");
  }
  liveScrollButton = null;
}

function toggleLiveAutoScroll(sheet, song, control) {
  if (liveScrollFrame !== null) {
    stopLiveAutoScroll();
    return;
  }

  liveScrollButton = control;
  control.textContent = "Pause auto-scroll";
  control.setAttribute("aria-pressed", "true");
  let previousTime = performance.now();

  const step = (currentTime) => {
    const elapsedSeconds = Math.min(0.1, (currentTime - previousTime) / 1000);
    previousTime = currentTime;
    const currentSong = songById(song.id);
    sheet.scrollTop += (currentSong?.sheetScrollSpeed ?? 28) * elapsedSeconds;
    if (sheet.scrollTop + sheet.clientHeight >= sheet.scrollHeight - 1) {
      stopLiveAutoScroll();
      return;
    }
    liveScrollFrame = requestAnimationFrame(step);
  };

  liveScrollFrame = requestAnimationFrame(step);
}

function activeSet() {
  return state.sets.find((set) => set.id === state.activeSetId) ?? state.sets[0];
}

function songById(songId) {
  return state.songs.find((song) => song.id === songId);
}

function node(tag, className = "", text = "") {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text) item.textContent = text;
  return item;
}

function button(text, className, onClick, label = "") {
  const item = node("button", className, text);
  item.type = "button";
  if (label) item.setAttribute("aria-label", label);
  if (onClick) item.addEventListener("click", onClick);
  return item;
}

function pageHeading(eyebrow, title, description, action) {
  const heading = node("div", "page-heading");
  const copy = node("div");
  copy.append(node("p", "eyebrow", eyebrow), node("h1", "", title), node("p", "", description));
  heading.append(copy);
  if (action) heading.append(action);
  return heading;
}

function emptyState(title, message, actionLabel, onAction) {
  const wrapper = node("div", "empty-state");
  const content = node("div");
  const icon = node("div", "empty-icon", "♫");
  icon.setAttribute("aria-hidden", "true");
  content.append(
    icon,
    node("h3", "", title),
    node("p", "", message),
    button(actionLabel, "button button-primary", onAction)
  );
  wrapper.append(content);
  return wrapper;
}

function setView(view) {
  stopLiveAutoScroll();
  currentView = view;
  if (view === "live") {
    liveIndex = Math.min(liveIndex, Math.max(activeSet().songIds.length - 1, 0));
    requestWakeLock();
  } else {
    releaseWakeLock();
  }
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function render() {
  stopLiveAutoScroll();
  document.querySelectorAll("[data-view]").forEach((item) => {
    const active = item.dataset.view === currentView;
    item.classList.toggle("is-active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });

  app.replaceChildren();
  app.style.removeProperty("--live-scale");
  document.body.classList.toggle("is-live", currentView === "live");

  if (currentView === "songs") renderSongs();
  else if (currentView === "live") renderLive();
  else renderSetlists();
}

function renderSetlists() {
  const newSetButton = button("＋ New set", "button button-primary", () => openSetDialog());
  app.append(
    pageHeading(
      "Ready for the next gig",
      "Your setlists",
      "Keep every song in order, then switch to Live Mode when you’re on stage.",
      newSetButton
    )
  );

  const tabs = node("div", "set-tabs");
  tabs.setAttribute("role", "tablist");
  state.sets.forEach((set) => {
    const tab = button(set.name, `set-tab${set.id === state.activeSetId ? " is-active" : ""}`, () => {
      save(selectSet(state, set.id));
    });
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(set.id === state.activeSetId));
    tab.append(node("span", "", String(set.songIds.length)));
    tabs.append(tab);
  });
  const addTab = button("＋ Add set", "set-tab is-new", () => openSetDialog());
  addTab.setAttribute("role", "tab");
  tabs.append(addTab);
  app.append(tabs);

  const selectedSet = activeSet();
  const panel = node("section", "set-panel");
  const header = node("div", "set-panel-header");
  const title = node("div", "set-panel-title");
  const setNumber = Math.max(1, state.sets.findIndex((set) => set.id === selectedSet.id) + 1);
  const titleCopy = node("div");
  titleCopy.append(
    node("h2", "", selectedSet.name),
    node("p", "", `${selectedSet.songIds.length} ${selectedSet.songIds.length === 1 ? "song" : "songs"}`)
  );
  title.append(node("span", "set-number", String(setNumber)), titleCopy);

  const actions = node("div", "set-actions");
  actions.append(
    button("＋ Add songs", "button button-quiet button-small", openPicker),
    button("Rename", "button button-quiet button-small", () => openSetDialog(selectedSet)),
    button("Duplicate", "button button-quiet button-small", () => {
      save(duplicateSet(state, selectedSet.id), `${selectedSet.name} duplicated`);
    }),
    button("▶ Start Live", "button button-primary button-small", () => startLive(selectedSet.id))
  );
  if (state.sets.length > 1) {
    actions.append(
      button("Delete", "button button-danger button-small", () => {
        if (confirm(`Delete “${selectedSet.name}”? Your songs will stay in the repertoire.`)) {
          save(deleteSet(state, selectedSet.id), "Set deleted");
        }
      })
    );
  }
  header.append(title, actions);
  panel.append(header);

  if (!selectedSet.songIds.length) {
    panel.append(
      emptyState(
        "This set is waiting for songs",
        "Choose from your repertoire and arrange the running order.",
        "Add songs",
        openPicker
      )
    );
  } else {
    const list = node("ol", "song-list");
    selectedSet.songIds.forEach((songId, index) => {
      const song = songById(songId);
      if (!song) return;
      list.append(renderSetSongRow(selectedSet, song, index));
    });
    panel.append(list);
  }

  app.append(panel);
}

function renderSetSongRow(set, song, index) {
  const row = node("li", "song-row");
  row.draggable = true;
  row.dataset.index = String(index);
  row.addEventListener("dragstart", () => {
    draggedIndex = index;
    row.classList.add("is-dragging");
  });
  row.addEventListener("dragend", () => {
    draggedIndex = null;
    row.classList.remove("is-dragging");
  });
  row.addEventListener("dragover", (event) => event.preventDefault());
  row.addEventListener("drop", (event) => {
    event.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      save(moveSongInSet(state, set.id, draggedIndex, index), "Running order updated");
    }
  });

  const position = node("span", "song-position", String(index + 1).padStart(2, "0"));
  const songButton = button("", "song-main song-open-button", () => openSongDialog(song), `Edit ${song.title}`);
  const details = node("span");
  details.append(node("strong", "", song.title));
  if (song.artist) details.append(node("small", "", song.artist));
  const meta = renderMeta(song);
  if (meta.childElementCount) details.append(meta);
  songButton.append(details);

  const controls = node("div", "row-actions");
  const up = button("↑", "row-icon", () => {
    save(moveSongInSet(state, set.id, index, index - 1));
  }, `Move ${song.title} up`);
  up.disabled = index === 0;
  const down = button("↓", "row-icon", () => {
    save(moveSongInSet(state, set.id, index, index + 1));
  }, `Move ${song.title} down`);
  down.disabled = index === set.songIds.length - 1;
  const edit = button("✎", "row-icon edit-row-button", () => openSongDialog(song), `Edit ${song.title}`);
  const remove = button("×", "row-icon remove-row-button", () => {
    save(removeSongFromSet(state, set.id, index), `${song.title} removed from ${set.name}`);
  }, `Remove ${song.title} from ${set.name}`);
  controls.append(up, down, edit, remove);

  row.append(position, songButton, controls);
  return row;
}

function renderMeta(song, live = false) {
  const meta = node("span", live ? "live-meta" : "song-meta");
  if (song.key) meta.append(node("span", "meta-chip", `Key ${song.key}`));
  if (song.bpm) meta.append(node("span", "meta-chip", `${song.bpm} BPM`));
  if (song.notes) meta.append(node("span", "meta-chip", "Notes"));
  if (song.performanceSheet) meta.append(node("span", "meta-chip", "Performance sheet"));
  return meta;
}

function renderSongs() {
  const addButton = button("＋ Add song", "button button-primary", () => openSongDialog());
  app.append(
    pageHeading(
      "Your repertoire",
      "Songs",
      `${state.songs.length} songs ready to add to any set. Tap a song to keep notes, a performance sheet, key and BPM.`,
      addButton
    )
  );

  const toolbar = node("div", "songs-toolbar");
  const searchLabel = node("label", "search-field");
  searchLabel.append(node("span", "sr-only", "Search songs"));
  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.placeholder = "Search by song or artist";
  searchInput.autocomplete = "off";
  searchInput.value = songQuery;
  searchLabel.append(searchInput);

  const target = node("label", "target-select");
  target.append(node("span", "", "Add songs to"));
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Setlist to add songs to");
  state.sets.forEach((set) => {
    const option = node("option", "", set.name);
    option.value = set.id;
    option.selected = set.id === state.activeSetId;
    select.append(option);
  });
  select.addEventListener("change", () => save(selectSet(state, select.value)));
  target.append(select);
  toolbar.append(searchLabel, target);
  app.append(toolbar);

  const resultsLabel = node("p", "results-label");
  const grid = node("div", "song-grid");
  app.append(resultsLabel, grid);

  const updateResults = () => {
    songQuery = searchInput.value;
    renderSongCards(grid, resultsLabel);
  };
  searchInput.addEventListener("input", updateResults);
  renderSongCards(grid, resultsLabel);
}

function renderSongCards(grid, resultsLabel) {
  const query = songQuery.trim().toLocaleLowerCase("en-GB");
  const songs = [...state.songs]
    .filter((song) => `${song.title} ${song.artist}`.toLocaleLowerCase("en-GB").includes(query))
    .sort((a, b) => a.title.localeCompare(b.title, "en-GB"));

  resultsLabel.textContent = query
    ? `${songs.length} ${songs.length === 1 ? "result" : "results"} for “${songQuery.trim()}”`
    : `${songs.length} songs`;
  grid.replaceChildren();

  if (!songs.length) {
    const message = node("div", "empty-state");
    message.append(node("p", "", "No songs match that search."));
    grid.append(message);
    return;
  }

  const targetSet = activeSet();
  songs.forEach((song) => {
    const card = node("article", "song-card");
    const head = node("div", "song-card-head");
    const title = node("div");
    title.append(node("strong", "", song.title));
    if (song.artist) title.append(node("small", "", song.artist));
    head.append(title, button("✎", "row-icon", () => openSongDialog(song), `Edit ${song.title}`));
    card.append(head);
    const meta = renderMeta(song);
    if (meta.childElementCount) card.append(meta);
    const actions = node("div", "song-card-actions");
    actions.append(
      button(`＋ ${targetSet.name}`, "button button-quiet button-small", () => {
        save(addSongToSet(state, targetSet.id, song.id), `${song.title} added to ${targetSet.name}`);
      }),
      button("Open", "button button-primary button-small", () => openSongDialog(song))
    );
    card.append(actions);
    grid.append(card);
  });
}

function renderLive() {
  const set = activeSet();
  if (!set.songIds.length) {
    const empty = node("section", "live-empty");
    const copy = node("div");
    copy.append(
      node("h1", "", `${set.name} is empty`),
      node("p", "", "Add at least one song before starting Live Mode."),
      button("Back to setlist", "button button-primary", () => setView("sets"))
    );
    empty.append(copy);
    app.append(empty);
    return;
  }

  liveIndex = Math.min(Math.max(liveIndex, 0), set.songIds.length - 1);
  const song = songById(set.songIds[liveIndex]);
  if (!song) {
    liveIndex = 0;
    setView("sets");
    return;
  }

  const shell = node("section", "live-shell");
  shell.style.setProperty("--live-scale", String(liveScale));
  const topbar = node("div", "live-topbar");
  const progressCopy = node("div");
  progressCopy.append(
    node("div", "live-set-label", set.name),
    node("div", "live-progress-label", `Song ${liveIndex + 1} of ${set.songIds.length}`)
  );
  const tools = node("div", "live-tools");
  tools.append(
    button("A−", "icon-button", () => {
      liveScale = Math.max(0.8, Number((liveScale - 0.1).toFixed(1)));
      render();
    }, "Reduce live text size"),
    button("A+", "icon-button", () => {
      liveScale = Math.min(1.3, Number((liveScale + 0.1).toFixed(1)));
      render();
    }, "Increase live text size"),
    button("⛶", "icon-button", toggleFullscreen, "Toggle full screen"),
    button("×", "icon-button", () => setView("sets"), "Exit Live Mode")
  );
  topbar.append(progressCopy, tools);

  const track = node("div", "progress-track");
  const fill = node("span");
  fill.style.width = `${((liveIndex + 1) / set.songIds.length) * 100}%`;
  track.append(fill);

  const content = node("div", "live-content");
  content.append(
    node("p", "live-kicker", `Up now · ${String(liveIndex + 1).padStart(2, "0")}`),
    node("h1", "live-title", song.title)
  );
  if (song.artist) content.append(node("p", "live-artist", song.artist));
  const meta = renderMeta(song, true);
  if (meta.childElementCount) content.append(meta);

  if (song.notes) {
    const notes = node("section", "live-reference");
    notes.append(node("h3", "", "Performance notes"));
    notes.append(node("p", "", song.notes));
    content.append(notes);
  }

  if (song.performanceSheet) {
    const performanceSheet = node("section", "live-performance-sheet");
    const sheetHeader = node("div", "live-sheet-header");
    const sheetTitle = node("div");
    sheetTitle.append(
      node("h3", "", "Performance sheet"),
      node("small", "", "Preserves chord spacing · Space pauses or resumes")
    );

    const sheetControls = node("div", "live-sheet-controls");
    const speedLabel = node("label", "live-speed-control");
    speedLabel.append(node("span", "", "Speed"));
    const speedInput = document.createElement("input");
    speedInput.type = "range";
    speedInput.min = "8";
    speedInput.max = "80";
    speedInput.step = "4";
    speedInput.value = String(song.sheetScrollSpeed);
    speedInput.setAttribute("aria-label", "Performance sheet auto-scroll speed");
    const speedOutput = node("output", "", `${song.sheetScrollSpeed} px/s`);
    speedLabel.append(speedInput, speedOutput);

    const sheetContent = node("pre", "live-sheet-content", song.performanceSheet);
    sheetContent.tabIndex = 0;
    const autoScrollButton = button(
      "Start auto-scroll",
      "button live-scroll-button",
      () => toggleLiveAutoScroll(sheetContent, song, autoScrollButton)
    );
    autoScrollButton.dataset.liveAutoScroll = "true";
    autoScrollButton.setAttribute("aria-pressed", "false");

    speedInput.addEventListener("input", () => {
      const speed = Number(speedInput.value);
      persistWithoutRender(updateSong(state, song.id, { ...song, sheetScrollSpeed: speed }));
      speedOutput.textContent = `${speed} px/s`;
    });

    sheetControls.append(speedLabel, autoScrollButton);
    sheetHeader.append(sheetTitle, sheetControls);
    performanceSheet.append(sheetHeader, sheetContent);
    content.append(performanceSheet);
  }

  const controls = node("div", "live-controls");
  const previous = button("← Previous", "live-control", () => changeLiveSong(-1));
  previous.disabled = liveIndex === 0;
  const counter = node("span", "live-count", `${liveIndex + 1} / ${set.songIds.length}`);
  const nextLabel = liveIndex === set.songIds.length - 1 ? "Finish" : "Next →";
  const next = button(nextLabel, "live-control is-next", () => {
    if (liveIndex === set.songIds.length - 1) {
      showToast(`${set.name} complete`);
      setView("sets");
    } else changeLiveSong(1);
  });
  controls.append(previous, counter, next);

  shell.append(topbar, track, content, controls);
  app.append(shell);
}

function openSongDialog(song = null) {
  document.querySelector("#song-dialog-title").textContent = song ? "Edit song" : "Add a song";
  document.querySelector("#song-id").value = song?.id ?? "";
  document.querySelector("#song-title").value = song?.title ?? "";
  document.querySelector("#song-artist").value = song?.artist ?? "";
  document.querySelector("#song-key").value = song?.key ?? "";
  document.querySelector("#song-bpm").value = song?.bpm ?? "";
  document.querySelector("#song-notes").value = song?.notes ?? "";
  document.querySelector("#song-performance-sheet").value = song?.performanceSheet ?? "";
  document.querySelector("#delete-song-button").classList.toggle("is-hidden", !song);
  songDialog.showModal();
  requestAnimationFrame(() => document.querySelector("#song-title").focus());
}

function openSetDialog(set = null) {
  document.querySelector("#set-dialog-title").textContent = set ? "Rename set" : "New set";
  document.querySelector("#set-id").value = set?.id ?? "";
  document.querySelector("#set-name").value = set?.name ?? "";
  setDialog.showModal();
  requestAnimationFrame(() => document.querySelector("#set-name").focus());
}

function openPicker() {
  const set = activeSet();
  document.querySelector("#picker-title").textContent = `Add songs to ${set.name}`;
  pickerSearch.value = "";
  renderPicker();
  pickerDialog.showModal();
  requestAnimationFrame(() => pickerSearch.focus());
}

function renderPicker() {
  const query = pickerSearch.value.trim().toLocaleLowerCase("en-GB");
  const songs = [...state.songs]
    .filter((song) => `${song.title} ${song.artist}`.toLocaleLowerCase("en-GB").includes(query))
    .sort((a, b) => a.title.localeCompare(b.title, "en-GB"));
  const set = activeSet();
  pickerList.replaceChildren();
  songs.forEach((song) => {
    const row = node("div", "picker-song");
    const copy = node("div");
    copy.append(node("strong", "", song.title));
    if (song.artist) copy.append(node("small", "", song.artist));
    const alreadyIncluded = set.songIds.includes(song.id);
    row.append(
      copy,
      button(alreadyIncluded ? "＋ Add again" : "＋ Add", "button button-quiet button-small", () => {
        state = addSongToSet(state, set.id, song.id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        render();
        renderPicker();
        showToast(`${song.title} added to ${set.name}`);
      })
    );
    pickerList.append(row);
  });
  if (!songs.length) pickerList.append(node("p", "results-label", "No songs match that search."));
}

function startLive(setId) {
  state = selectSet(state, setId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  liveIndex = 0;
  currentView = "live";
  requestWakeLock();
  render();
  window.scrollTo({ top: 0 });
}

function changeLiveSong(direction) {
  const set = activeSet();
  liveIndex = Math.min(Math.max(liveIndex + direction, 0), set.songIds.length - 1);
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function requestWakeLock() {
  if (currentView !== "live" || !navigator.wakeLock || document.visibilityState !== "visible") return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch (error) {
    console.info("Screen wake lock is unavailable.", error);
  }
}

async function releaseWakeLock() {
  if (!wakeLock) return;
  try {
    await wakeLock.release();
  } catch {
    // The browser may have released it already.
  }
  wakeLock = null;
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen?.();
  } catch (error) {
    console.info("Full screen is unavailable.", error);
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function exportBackup() {
  const content = JSON.stringify(state, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `set4u-backup-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Set4U backup exported");
}

async function importBackup(file) {
  try {
    const imported = normalizeState(JSON.parse(await file.text()));
    save(imported, "Backup imported");
    settingsDialog.close();
  } catch (error) {
    showToast(error instanceof Error ? error.message : "That backup could not be imported.");
  }
}

function updateConnectionStatus() {
  const status = document.querySelector("#connection-status");
  const label = status.lastElementChild;
  const online = navigator.onLine;
  status.classList.toggle("is-offline", !online);
  label.textContent = online ? "Online" : "Offline ready";
}

songForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const fields = Object.fromEntries(new FormData(songForm).entries());
  const details = {
    title: fields.title,
    artist: fields.artist,
    key: fields.key,
    bpm: fields.bpm,
    notes: fields.notes,
    performanceSheet: fields.performanceSheet
  };
  try {
    const nextState = fields.songId
      ? updateSong(state, fields.songId, details)
      : addSong(state, details);
    songDialog.close();
    save(nextState, fields.songId ? "Song updated" : "Song added");
  } catch (error) {
    showToast(error.message);
  }
});

performanceSheetInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  if (file.size > MAX_SHEET_FILE_SIZE) {
    showToast("Performance Sheet files must be under 1 MB");
    event.target.value = "";
    return;
  }

  try {
    const text = (await file.text()).replace(/\r\n/g, "\n");
    document.querySelector("#song-performance-sheet").value = text;
    showToast(`${file.name} added to the Performance Sheet`);
  } catch {
    showToast("That text file could not be read");
  } finally {
    event.target.value = "";
  }
});

setForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const fields = Object.fromEntries(new FormData(setForm).entries());
  try {
    const nextState = fields.setId
      ? renameSet(state, fields.setId, fields.name)
      : addSet(state, fields.name);
    setDialog.close();
    save(nextState, fields.setId ? "Set renamed" : "Set created");
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelector("#delete-song-button").addEventListener("click", () => {
  const songId = document.querySelector("#song-id").value;
  const song = songById(songId);
  if (song && confirm(`Delete “${song.title}” from the repertoire and every set?`)) {
    songDialog.close();
    save(deleteSong(state, songId), "Song deleted");
  }
});

document.querySelectorAll("[data-view]").forEach((item) => {
  item.addEventListener("click", () => setView(item.dataset.view));
});

document.querySelectorAll("[data-close-dialog]").forEach((item) => {
  item.addEventListener("click", () => document.querySelector(`#${item.dataset.closeDialog}`).close());
});

document.querySelector("#settings-button").addEventListener("click", () => settingsDialog.showModal());
document.querySelector("#export-button").addEventListener("click", exportBackup);
document.querySelector("#import-input").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importBackup(file);
  event.target.value = "";
});
document.querySelector("#reset-button").addEventListener("click", () => {
  if (confirm("Reset Set4U to the original two sets? This replaces changes stored on this device.")) {
    settingsDialog.close();
    save(createDefaultState(), "Original sets restored");
  }
});

pickerSearch.addEventListener("input", renderPicker);

document.querySelector("#install-button").addEventListener("click", async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  } else {
    installDialog.showModal();
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  showToast("Set4U installed");
});

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && currentView === "live") requestWakeLock();
});
document.addEventListener("keydown", (event) => {
  const dialogOpen = [...document.querySelectorAll("dialog")].some((dialog) => dialog.open);
  if (currentView !== "live" || dialogOpen) return;
  if (event.key === "ArrowRight") changeLiveSong(1);
  if (event.key === "ArrowLeft") changeLiveSong(-1);
  if (
    event.code === "Space" &&
    !["INPUT", "TEXTAREA", "BUTTON"].includes(document.activeElement?.tagName)
  ) {
    const autoScrollButton = document.querySelector("[data-live-auto-scroll]");
    if (autoScrollButton) {
      event.preventDefault();
      autoScrollButton.click();
    }
  }
  if (event.key === "Escape") setView("sets");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Set4U offline support could not start.", error);
    });
  });
}

updateConnectionStatus();
render();

