// ── Shared module-level state for main process handlers ──
// All handler modules import this for shared caches, constants, and global references.

let mainWindow = null;
let pythonProcess = null;
let tray = null;

// Cache maps
const repoSpeedCache = new Map();
const repoNegativeCache = new Map();
const depotKeysCache = new Map(); // key: repo name, value: { data: Buffer, parsed: object|null, timestamp: number }
const downloadControllers = new Map(); // key: controller ID, value: AbortController
const repoManifestCountCache = new Map(); // key: repo name, value: { count: number, timestamp: number }
const repoHitCache = new Set();
const repoAppIndex = new Map(); // key: appid (string), value: Array<{ repo: string, depots: object }>

// ── Install settings (persisted) ──
let skipDepotStages = false;

// DLC info cache
const dlcInfoCache = new Map();

// ── Cache size limits ──
const MAX_CACHE_SIZE = 1000;

/**
 * Prune a Map to maxSize entries (deletes oldest inserted entries).
 * No-op if already within limit.
 */
function pruneMap(map, maxSize = MAX_CACHE_SIZE) {
  if (map.size <= maxSize) return;
  const toDelete = map.size - maxSize;
  let i = 0;
  for (const key of map.keys()) {
    if (i >= toDelete) break;
    map.delete(key);
    i++;
  }
}

/**
 * Prune a Set to maxSize entries.
 */
function pruneSet(set, maxSize = MAX_CACHE_SIZE) {
  if (set.size <= maxSize) return;
  const toDelete = set.size - maxSize;
  let i = 0;
  for (const val of set.values()) {
    if (i >= toDelete) break;
    set.delete(val);
    i++;
  }
}

/** Prune ALL unbounded caches to stay within size limits. */
function pruneAllCaches() {
  pruneMap(repoSpeedCache);
  pruneMap(repoNegativeCache);
  pruneMap(depotKeysCache);
  pruneMap(repoManifestCountCache);
  pruneSet(repoHitCache);
  pruneMap(dlcInfoCache);
  // repoAppIndex: structured index, prune by staleness is risky — leave unbounded for now
}

// Constants
const REPO_CONCURRENCY = 15;
const REPO_TIMEOUT_MS = 1000;
const NEGATIVE_CACHE_TTL = 1800000; // 30 min for failed repos
const INDEX_CHUNK_SIZE = 20;

const DEFAULT_STEAM_PATH = 'C:\\Program Files (x86)\\Steam';
const DLC_CACHE_FILE = 'dlc_info_cache.json';

// Config state
let customSteamConfig = {};
let apiConfig = {};

// Discord auth state
let discordAuthData = null;

// Module-level promise for repo indexing
let repoIndexPromise = null;
let dlcCacheLoaded = false;

// ── Top repos and APIs ──

const TOP_INDEX_REPOS = [
  "WARDEN-DEV/Steam_ManifestHub",
  "SteamAutoCracks/ManifestHub",
  "pjy612/SteamManifestCache",
  "pjy612/ManifestAutoUpdate-bak",
  "X06W90X/pjy612",
  "SSMGAlt/ManifestHub2",
  "ManifestHub/ManifestHub",
  "BlankTMing/ManifestAutoUpdate",
  "Auiowu/ManifestAutoUpdate",
  "eudaimence/OpenDepot",
  "tympanicblock61/SteamManifestMirror",
  "isurfer21/steam-manifests",
  "WoodenTiger000/SteamManifestHub",
  "TheSecondComing001/SteamManifestHub",
  "frostheaven/steam-manifest-cache",
  "SteamHome/BestManifests",
  "nuclear12345/steam_manifests",
  "legiond2/steam_manifests",
  "MaeBeStuppid/SteamManifests",
  "sergiopereira/steam-manifests",
  "DeckManifests/ManifestHub",
  "pvzcxw/cai-install_stloader",
  "wsxsdyx/ManifestHub1",
  "a60nt1/SteamManifest",
  "Confused712/SteamDeck-Keys",
  "Sora276/SteamDeckManifests",
  "NicksWorldOf/SteamManifests",
  "GHubGamer/SteamDeck-Manifests",
  "mikee251/SteamDeck-Manifests",
  "LizardMode/SteamDeck-Manifests",
  "JannikCZE/SteamDeck-Keys",
  "tenderloincoder/steam-keys",
  "thecyberphunk/steam-depot-keys",
  "RetroDECK/SteamDeck-Keys",
  "AcidRain206/steam-keys",
  "Amiitx/switch-local",
  "SPIN0ZAi/SB_manifest_DB",
  "Metastem/ManifestHub",
  "leiyang3148/ManifestHub2LYY",
  "speedstory/ManifestHub2",
  "skylayer/ManifestHub",
  "ikun0014/ManifestHub",
  "wxy1343/manifest",
  "tymolu233/ManifestAutoUpdate",
  "tymolu233/ManifestAutoUpdate-fix",
  "centricxd/ManifestHub",
  "Knuc/ManifestHub2",
  "IDoCute/ManifestHub2",
  "tmzgit/Steam-ManifestHub2",
  "zkb2006/ManifestHub",
  "IBackupStuff/ManifestHub2",
  "lifan424/ManifestHub",
  "SlowOstrich/ManifestHub2",
  "yeti-yeti/ManifestHub3",
  "zeinoux/ManifestHub",
  "mst111203/ManifestHub",
  "Chengxidaxia/ManifestHub2",
  "nykcursor/ManifestHub2",
  "r0y1z2/ManifestHub2_SteamDepot",
  "siyeqi/steam",
  "864383356/ManifestHub2",
  "shepardzby/ManifestHub2",
  "Ravex0/Ravex-ManifestHu",
  "3569372265/ManifestHub2",
  "dnasdw/ManifestHub2",
  "crybwl/ManifestHub2",
  "shakr9/ManifestHub2shakr",
  "HaiYangawa/ManifestHub2Backup",
  "highly1579/ManifestHub",
  "jinx0030/ManifestHub",
  "355055780/SteamAppImport",
  "AprDeci/ManifestAutoUpdate-bak",
  "chaosxt/ManifestHub2",
  "Chatqing/ManifestHub2",
  "Scropiouos/ManifestAutoUpdate_backup",
  "cwhhk/ManifestHub2",
  "fairy-root/steam-depot-online",
  "MCbabel/Steam-Manifest-Downloader",
  "SteamTracking/SteamFileDownloader",
  "Sainan/steam-manifest-tools",
  "mysfad/depot-downloader",
  "ourevryday/ManifestHub",
  "xPaw/SteamFileDownloader",
  "Zero-wyc/ManifestHub-Steam",
  "Anckerioc/STEAM-",
  "WoodenTiger000/SteamManifestHub",
];

const LUATOOLS_APIS = [
  { name: 'Sushi', url: 'https://raw.githubusercontent.com/sushi-dev55-alt/sushitools-games-repo-alt/refs/heads/main/<appid>.zip' },
  { name: 'Ryuu', url: 'http://167.235.229.108/<appid>' },
];

const MIRROR_ALT_URLS = [
  'refs/heads/main',
  'refs/heads/master',
  'main',
  'master',
];

module.exports = {
  // Getters/setters for mutable globals
  get mainWindow() { return mainWindow; },
  setMainWindow(w) { mainWindow = w; },
  get pythonProcess() { return pythonProcess; },
  setPythonProcess(p) { pythonProcess = p; },
  get tray() { return tray; },
  setTray(t) { tray = t; },
  get customSteamConfig() { return customSteamConfig; },
  setCustomSteamConfig(c) { customSteamConfig = c; },
  get apiConfig() { return apiConfig; },
  setApiConfig(c) { apiConfig = c; },
  get discordAuthData() { return discordAuthData; },
  setDiscordAuthData(d) { discordAuthData = d; },
  get repoIndexPromise() { return repoIndexPromise; },
  setRepoIndexPromise(p) { repoIndexPromise = p; },
  get dlcCacheLoaded() { return dlcCacheLoaded; },
  setDlcCacheLoaded(v) { dlcCacheLoaded = v; },
  get skipDepotStages() { return skipDepotStages; },
  setSkipDepotStages(v) { skipDepotStages = v; },

  // Cache maps (read-write by reference)
  repoSpeedCache,
  repoNegativeCache,
  depotKeysCache,
  downloadControllers,
  repoManifestCountCache,
  repoHitCache,
  repoAppIndex,
  dlcInfoCache,
  pruneAllCaches,

  // Constants
  REPO_CONCURRENCY,
  REPO_TIMEOUT_MS,
  NEGATIVE_CACHE_TTL,
  INDEX_CHUNK_SIZE,
  DEFAULT_STEAM_PATH,
  DLC_CACHE_FILE,
  TOP_INDEX_REPOS,
  MIRROR_REPOS: TOP_INDEX_REPOS,
  LUATOOLS_APIS,
  MIRROR_ALT_URLS,
};
