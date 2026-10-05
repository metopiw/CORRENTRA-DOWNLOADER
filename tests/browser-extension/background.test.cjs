const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vm = require("node:vm");

const background = readFileSync(resolve(__dirname, "../../browser-extension/background.js"), "utf8");
function event() {
  return { listeners: [], addListener(fn) { this.listeners.push(fn); } };
}
function fixture(options = {}) {
  const calls = { offers: [], paused: [], resumed: [], cancelled: [], erased: [] };
  const items = new Map();
  const storage = { captureEnabled: options.enabled !== false };
  const chrome = {
    runtime: { getURL: (p) => "chrome-extension://test/" + p, getPlatformInfo() {}, onInstalled: event(), onMessage: event() },
    storage: { local: {
      async get(defaults) { return { ...defaults, ...storage }; },
      async set(values) { Object.assign(storage, values); },
    } },
    action: { async setBadgeText() {}, async setBadgeBackgroundColor() {} },
    alarms: { create() {}, clear() {}, onAlarm: event() },
    tabs: { onRemoved: event() },
    contextMenus: { create() {}, onClicked: event() },
    webRequest: { onCompleted: event(), onBeforeSendHeaders: event() },
    downloads: {
      onCreated: event(), onDeterminingFilename: event(), onChanged: event(),
      async search({ id }) { return items.has(id) ? [items.get(id)] : []; },
      async pause(id) { calls.paused.push(id); if (options.pauseFails) throw Error("pause-failed"); },
      async resume(id) { calls.resumed.push(id); },
      async cancel(id) { calls.cancelled.push(id); },
      async erase({ id }) { calls.erased.push(id); },
    },
  };
  const context = vm.createContext({
    chrome, URL, AbortSignal,
    Date: class extends Date { static now() { return options.now ?? Date.now(); } },
    setTimeout() {},
    async fetch(url, init = {}) {
      if (url.endsWith("bridge-token.txt")) return { ok: true, text: async () => "test-token" };
      if (url.endsWith("/ping")) return { ok: options.online !== false };
      if (url.endsWith("/jobs")) return { ok: true };
      if (url.endsWith("/takeover")) {
        calls.offers.push(JSON.parse(init.body));
        if (options.throwOffer) throw Error("network-failed");
        return { ok: true, json: async () => ({ accepted: options.accepted !== false, jobId: "job-1" }) };
      }
      throw Error("Unexpected fetch " + url);
    },
  });
  vm.runInContext(background, context);
  const item = (overrides = {}) => ({ id: 1, url: "https://example.test/file.zip", finalUrl: "https://example.test/file.zip", filename: "file.zip", state: "in_progress", ...overrides });
  async function capture(initial, latest = initial, determining = false) {
    items.set(initial.id, latest);
    chrome.downloads.onCreated.listeners[0](initial);
    if (determining) chrome.downloads.onDeterminingFilename.listeners[0](initial, () => {});
    await settle();
  }
  return { calls, chrome, context, items, item, capture, storage, options };
}
async function settle() {
  for (let i = 0; i < 20; i++) await new Promise(setImmediate);
}
function request(f, url, headers, method = "GET", incognito = false) {
  f.chrome.webRequest.onBeforeSendHeaders.listeners[0]({ url, method, incognito, requestHeaders: Object.entries(headers).map(([name, value]) => ({ name, value })) });
}

test("Drive handoff uses refreshed final URL, actual session and basename", async () => {
  const f = fixture();
  const finalUrl = "https://drive.usercontent.google.com/download?id=test&confirm=t";
  request(f, finalUrl, { Cookie: "SID=fixture", "User-Agent": "Chrome-fixture", Authorization: "Bearer fixture", Range: "bytes=0-", Host: "wrong.test" });
  await f.capture(f.item({ url: "https://drive.google.com/uc?id=test", finalUrl: "", filename: "download" }),
    f.item({ url: "https://drive.google.com/uc?id=test", finalUrl, filename: "C:\\Users\\test\\Downloads\\belge.zip", referrer: "https://drive.google.com/" }));
  assert.equal(f.calls.offers[0].finalUrl, finalUrl);
  assert.equal(f.calls.offers[0].filename, "belge.zip");
  assert.deepEqual(f.calls.offers[0].headers, { Cookie: "SID=fixture", "User-Agent": "Chrome-fixture", Authorization: "Bearer fixture", Referer: "https://drive.google.com/" });
  assert.deepEqual(f.calls.cancelled, [1]);
});
test("simultaneous created, determining and changed events make one job", async () => {
  const f = fixture();
  await f.capture(f.item(), f.item(), true);
  f.chrome.downloads.onChanged.listeners[0]({ id: 1, filename: { current: "file.zip" } });
  await settle();
  assert.equal(f.calls.offers.length, 1);
  assert.equal(f.calls.paused.length, 1);
});
test("credentials from original redirect host do not reach final host", async () => {
  const f = fixture();
  request(f, "https://example.test/file.zip", { Cookie: "private=fixture", Authorization: "Bearer fixture" });
  await f.capture(f.item({ finalUrl: "https://cdn.test/file.zip" }));
  assert.deepEqual(f.calls.offers[0].headers, {});
});
test("expired cached session headers are discarded", async () => {
  const f = fixture({ now: 1000 });
  request(f, f.item().url, { Cookie: "old=fixture" });
  f.options.now += 120001;
  await f.capture(f.item());
  assert.deepEqual(f.calls.offers[0].headers, {});
});
test("incognito and normal sessions never share cached credentials", async () => {
  const f = fixture();
  request(f, f.item().url, { Cookie: "normal=fixture" });
  request(f, f.item().url, { Cookie: "private=fixture" }, "GET", true);
  await f.capture(f.item());
  assert.equal(f.calls.offers[0].headers.Cookie, "normal=fixture");
  await f.capture(f.item({ id: 2, incognito: true }));
  assert.equal(f.calls.offers[1].headers.Cookie, "private=fixture");
});
test("cancelled downloads are not handed off after asynchronous pause", async () => {
  const f = fixture();
  await f.capture(f.item(), f.item({ state: "interrupted" }));
  assert.equal(f.calls.offers.length, 0);
});
test("POST download stays in browser instead of being replayed as GET", async () => {
  const f = fixture();
  request(f, f.item().url, {}, "POST");
  await f.capture(f.item());
  assert.equal(f.calls.offers.length, 0);
  assert.deepEqual(f.calls.resumed, [1]);
});
for (const options of [{ accepted: false }, { throwOffer: true }]) {
  test("rejected or failed handoff resumes original download: " + JSON.stringify(options), async () => {
    const f = fixture(options);
    await f.capture(f.item());
    assert.deepEqual(f.calls.resumed, [1]);
    assert.deepEqual(f.calls.cancelled, []);
  });
}
test("disabled capture never pauses or offers", async () => {
  const f = fixture({ enabled: false });
  await f.capture(f.item());
  assert.deepEqual(f.calls.paused, []);
  assert.equal(f.calls.offers.length, 0);
});
test("completed tiny files and extension-initiated downloads are skipped", async () => {
  const f = fixture();
  await f.capture(f.item({ state: "complete" }));
  await f.capture(f.item({ id: 2, byExtensionId: "other" }));
  assert.equal(f.calls.offers.length, 0);
});
test("blob download becomes eligible once finalUrl is HTTP", async () => {
  const f = fixture();
  await f.capture(f.item({ url: "blob:https://example.test/id", finalUrl: "" }));
  f.items.set(1, f.item({ url: "blob:https://example.test/id" }));
  f.chrome.downloads.onChanged.listeners[0]({ id: 1, finalUrl: { current: f.item().url } });
  await settle();
  assert.equal(f.calls.offers.length, 1);
  assert.equal(f.calls.offers[0].url, f.item().url);
});
test("filename listener passes through without an invalid absolute suggestion", () => {
  const f = fixture();
  let suggestion = "not-called";
  f.chrome.downloads.onDeterminingFilename.listeners[0](f.item({ url: "blob:test", finalUrl: "blob:test", filename: "C:\\Downloads\\test.zip" }), (value) => { suggestion = value; });
  assert.equal(suggestion, undefined);
});
test("Drive page click waits for browser confirmation/download events", async () => {
  const f = fixture();
  const response = await vm.runInContext('handleMessage({type:"correntra.takeoverUrl", url:"https://drive.google.com/uc?id=test"}, {})', f.context);
  assert.equal(response.reason, "browser-download-required");
  assert.equal(f.calls.offers.length, 0);
});
