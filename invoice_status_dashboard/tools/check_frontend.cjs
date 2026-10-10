// Runs the real date helpers with the checkout's Luxon and real refresh method
// with mocked ORM/component services. Does NOT mount Owl or connect to Odoo.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const odoo = path.resolve(root, '..', '..');
const context = vm.createContext({ console, setTimeout, clearTimeout, performance });
vm.runInContext(fs.readFileSync(path.join(odoo, 'addons/web/static/lib/luxon/luxon.js'), 'utf8'), context);
vm.runInContext(`
    var Component = class {};
    var SearchBar = class {};
    var AccountMoveListController = class {};
    var Dialog = class {}, DateTimeInput = class {}, Dropdown = class {}, DropdownItem = class {};
    var registry = { category: () => ({ add() {} }) };
    var accountMoveUploadListView = {};
    var serializeDate = (value) => value.toISODate();
    var countDomain = (search) => search.domain || [];
    var _t = (text) => text;
`, context);
function load(file) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
    vm.runInContext(source, context, { filename: file });
}
load('static/src/js/date_ranges.js');
load('static/src/js/invoice_status_dashboard.js');
const ranges = vm.runInContext(`(() => {
    const day = luxon.DateTime.fromISO('2026-10-10');
    return {
        two: predefinedRange('today', day, 1),
        monday: predefinedRange('week', day, 1),
        sunday: predefinedRange('week', day, 7),
        month: predefinedRange('month', day, 1),
        year: predefinedRange('year', day, 1),
        crossover: predefinedRange('today', luxon.DateTime.fromISO('2026-01-01'), 1),
        valid: isValidRange(day, day),
        missing: isValidRange(false, day),
        reverse: isValidRange(day, day.minus({ days: 1 })),
        invalid: isValidRange(luxon.DateTime.invalid('invalid'), day),
        kolkata: luxon.DateTime.fromISO('2026-10-09T20:00:00Z').setZone('Asia/Calcutta').startOf('day').toISODate(),
    };
})()`, context);
const plain = JSON.parse(JSON.stringify(ranges));
assert.deepEqual(plain.two, { start: '2026-10-10', end: '2026-10-10' });
assert.equal(plain.monday.start, '2026-10-05');
assert.equal(plain.sunday.start, '2026-10-04');
assert.equal(plain.month.start, '2026-10-01');
assert.equal(plain.year.start, '2026-01-01');
assert.equal(plain.crossover.start, '2026-01-01');
assert.equal(plain.valid, true);
assert.equal(plain.missing, false);
assert.equal(plain.reverse, false);
assert.equal(plain.invalid, false);
assert.equal(plain.kolkata, '2026-10-10');
console.log('PASS 11 range/date-validation/timezone assertions (real local Luxon)');
(async () => {
    const result = await vm.runInContext(`(async () => {
        const pending = [];
        const dashboard = {
            search: { context: {}, domain: [] }, generation: 0, destroyed: false, sync() {},
            state: { counts: {}, loading: true, error: false },
            orm: { call: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) },
            notification: { add() {} },
        };
        const first = InvoiceDashboard.prototype.refresh.call(dashboard, true);
        const second = InvoiceDashboard.prototype.refresh.call(dashboard, true);
        pending[1].resolve({ draft: 2, posted: 3, cancel: 4 }); await second;
        pending[0].resolve({ draft: 99, posted: 99, cancel: 99 }); await first;
        const retained = dashboard.state.counts.draft;
        const loading = dashboard.state.loading;
        const failure = InvoiceDashboard.prototype.refresh.call(dashboard, true);
        pending[2].reject(new Error('network')); await failure;
        const error = dashboard.state.error;
        const retry = InvoiceDashboard.prototype.refresh.call(dashboard, true);
        pending[3].resolve({ draft: 5, posted: 6, cancel: 7 }); await retry;
        const dialog = { state: { start: false, end: false }, props: { apply() { throw Error('invalid apply'); }, close() { throw Error('invalid close'); } } };
        InvoiceDateDialog.prototype.apply.call(dialog);
        return { retained, loading, error, retry: dashboard.state.counts.draft, recovered: !dashboard.state.error, validationMessage: Boolean(dialog.state.error) };
    })()`, context);
    assert.equal(result.retained, 2);
    assert.equal(result.loading, false);
    assert.equal(result.error, true);
    assert.equal(result.retry, 5);
    assert.equal(result.recovered, true);
    assert.equal(result.validationMessage, true);
    console.log('PASS 6 stale-response/error/retry/dialog assertions (mocked ORM and services)');
    console.log('Standalone checks passed; no live Owl rendering or database tests run.');
})().catch((error) => { console.error(error); process.exitCode = 1; });

const revisionResults = vm.runInContext(`(() => {
    const data = { state: 'draft', invoice_date: luxon.DateTime.fromISO('2026-10-10') };
    data.activity_ids = { parent: data };
    const controller = { model: { root: { count: 1, records: [{ resId: 1, data }] } } };
    const get = Object.getOwnPropertyDescriptor(InvoiceDashboardController.prototype, 'dashboardRevision').get;
    const before = get.call(controller);
    const stable = get.call(controller) === before;
    data.state = 'posted';
    const posted = get.call(controller);
    data.invoice_date = luxon.DateTime.fromISO('2026-10-11');
    const dated = get.call(controller);
    controller.model.root.records[0].data = { ...data };
    return { stable, stateChanged: posted !== before, dateChanged: dated !== posted, reloadChanged: get.call(controller) !== dated };
})()`, context);
assert.equal(revisionResults.stable, true);
assert.equal(revisionResults.stateChanged, true);
assert.equal(revisionResults.dateChanged, true);
assert.equal(revisionResults.reloadChanged, true);
console.log('PASS 4 circular-record revision regression assertions');

const wheelCheck = vm.runInContext(`(() => {
    const viewport = { clientHeight: 28, scrollHeight: 84, scrollTop: 0,
        children: [0, 28, 56].map(offsetTop => ({ offsetTop, offsetHeight: 28 })) };
    const bar = {};
    let prevented = false, stopped = false;
    const event = { currentTarget: viewport, deltaY: 40, ctrlKey: false,
        preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } };
    const wheel = () => InvoiceSearchBar.prototype.onFacetWheel.call(bar, event);
    wheel(); const first = viewport.scrollTop;
    wheel(); const burst = viewport.scrollTop;
    bar._lastFacetWheel = -1000; wheel(); const second = viewport.scrollTop;
    bar._lastFacetWheel = -1000; event.deltaY = -1; wheel(); const previous = viewport.scrollTop;
    event.ctrlKey = true; wheel();
    return { first, burst, second, previous, prevented, stopped, zoomPreserved: viewport.scrollTop === previous };
})()`, context);
assert.equal(wheelCheck.first, 28);
assert.equal(wheelCheck.burst, 28);
assert.equal(wheelCheck.second, 56);
assert.equal(wheelCheck.previous, 28);
assert.equal(wheelCheck.prevented, true);
assert.equal(wheelCheck.stopped, true);
assert.equal(wheelCheck.zoomPreserved, true);
console.log('PASS 7 one-row wheel scrolling / burst / zoom assertions');
