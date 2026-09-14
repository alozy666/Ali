/* محمّل المحرّك في بيئة Node للاختبار والتحقّق (يحاكي window في المتصفح) */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

const ENGINE_FILES = [
  'web/js/engine/arabic.js',
  'web/js/engine/rng.js',
  'web/js/engine/dedupe.js',
  'web/js/engine/bank.js',
  'web/js/engine/score.js',
  'web/js/engine/cards.js',
  'web/js/engine/timer.js',
  'web/js/engine/state.js'
];

const DATA_FILES = {
  config: ['data/config.json'],
  journey: ['data/journey/mecca.json', 'data/journey/medina.json', 'data/journey/najaf.json',
            'data/journey/karbala.json', 'data/journey/kadhimiya.json', 'data/journey/mashhad.json',
            'data/journey/samarra.json'],
  qa: ['data/qa/aqaid.json', 'data/qa/fiqh.json', 'data/qa/quran.json',
       'data/qa/history.json', 'data/qa/books.json'],
  hints: ['data/hints/hints.json'],
  bidding: ['data/bidding/bidding.json']
};

function readData() {
  const out = {};
  for (const [key, files] of Object.entries(DATA_FILES)) {
    const parsed = files.map(f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    out[key] = (key === 'config' || key === 'hints' || key === 'bidding') ? parsed[0] : parsed;
  }
  return out;
}

function loadEngine() {
  const sandbox = { console, Date, Math, JSON, setTimeout, clearTimeout, setInterval, clearInterval };
  sandbox.window = sandbox;           // في المتصفح window هو الكائن العام نفسه
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const f of ENGINE_FILES) {
    const file = path.join(ROOT, f);
    if (!fs.existsSync(file)) continue;
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: f });
  }
  return sandbox.WKM;
}

module.exports = { ROOT, ENGINE_FILES, DATA_FILES, readData, loadEngine };
