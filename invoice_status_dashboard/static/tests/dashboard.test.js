import { describe, expect, test } from "@odoo/hoot";
import { Domain } from "@web/core/domain";
import { predefinedRange, isValidRange } from "@invoice_status_dashboard/js/date_ranges";
import { countDomain, activeOwnedFilters, replaceOwnedFilter } from "@invoice_status_dashboard/js/domain_adapter";
import { InvoiceDateDialog, InvoiceDashboard, InvoiceDashboardController } from "@invoice_status_dashboard/js/invoice_status_dashboard";

const { DateTime } = luxon;
describe.current.tags("headless");

test("all predefined ranges are inclusive and follow configured week start", () => {
    const day = DateTime.fromISO("2026-10-10");
    expect(predefinedRange("today", day, 1)).toEqual({ start: "2026-10-10", end: "2026-10-10" });
    expect(predefinedRange("week", day, 1).start).toBe("2026-10-05");
    expect(predefinedRange("week", day, 7).start).toBe("2026-10-04");
    expect(predefinedRange("month", day, 1).start).toBe("2026-10-01");
    expect(predefinedRange("year", day, 1).start).toBe("2026-01-01");
    expect(predefinedRange("today", DateTime.fromISO("2026-01-01"), 1).start).toBe("2026-01-01");
});

test("custom dates reject missing, invalid and reversed boundaries", () => {
    const a = DateTime.fromISO("2026-10-01"), b = DateTime.fromISO("2026-10-10");
    expect(isValidRange(a, b)).toBe(true);
    expect(isValidRange(a, a)).toBe(true);
    expect(isValidRange(b, a)).toBe(false);
    expect(isValidRange(false, b)).toBe(false);
    expect(isValidRange(DateTime.invalid("invalid"), b)).toBe(false);
});

function searchFixture() {
    const searchItems = {
        1: { groupId: 1, invoice_dashboard_kind: "status", domain: [["state", "=", "draft"]] },
        2: { groupId: 2, domain: [["partner_id", "=", 7]] },
        3: { groupId: 3, invoice_dashboard_kind: "date", domain: [["invoice_date", ">=", "2026-10-01"]] },
    };
    return {
        searchItems, query: [1, 2, 3].map((searchItemId) => ({ searchItemId })),
        globalDomain: [["move_type", "=", "out_invoice"]], display: { searchPanel: true }, domainEvalContext: {},
        _getGroups() { return this.query.map((q) => ({ activeItems: [q] })); },
        _getSearchItemDomain(q) { return this.searchItems[q.searchItemId].domain; },
        _getSearchPanelDomain() { return [["company_id", "=", 1]]; },
        deactivateGroup(groupId) { this.query = this.query.filter((q) => this.searchItems[q.searchItemId].groupId !== groupId); },
        createNewFilters(filters) { const id = Math.max(...Object.keys(this.searchItems).map(Number)) + 1; this.searchItems[id] = { ...filters[0], groupId: id }; this.query.push({ searchItemId: id }); },
    };
}

test("count domain excludes only owned status and preserves action, dates, search panel and partner", () => {
    const search = searchFixture();
    const before = JSON.stringify(search.query);
    const domain = new Domain(countDomain(search));
    const record = { move_type: "out_invoice", company_id: 1, invoice_date: "2026-10-10", partner_id: 7, state: "posted" };
    expect(domain.contains(record)).toBe(true);
    expect(domain.contains({ ...record, partner_id: 8 })).toBe(false);
    expect(domain.contains({ ...record, company_id: 2 })).toBe(false);
    expect(domain.contains({ ...record, move_type: "entry" })).toBe(false);
    expect(JSON.stringify(search.query)).toBe(before);
    search.searchItems[2].domain = [["state", "=", "cancel"]];
    expect(new Domain(countDomain(search)).contains(record)).toBe(false);
});

test("replacing status preserves date and search; toggling off removes only owned facet", () => {
    const search = searchFixture();
    replaceOwnedFilter(search, "status", { domain: [["state", "=", "posted"]] });
    expect(activeOwnedFilters(search, "status").length).toBe(1);
    expect(activeOwnedFilters(search, "date").length).toBe(1);
    expect(search.query.some((q) => q.searchItemId === 2)).toBe(true);
    replaceOwnedFilter(search, "status", null);
    expect(activeOwnedFilters(search, "status").length).toBe(0);
    expect(activeOwnedFilters(search, "date").length).toBe(1);
});

test("invalid dialog Apply does not apply or close", () => {
    let applied = false, closed = false;
    const dialog = { state: { start: false, end: false }, props: { apply: () => { applied = true; }, close: () => { closed = true; } } };
    InvoiceDateDialog.prototype.apply.call(dialog);
    expect(applied).toBe(false);
    expect(closed).toBe(false);
    expect(Boolean(dialog.state.error)).toBe(true);
});

test("stale count response never overwrites newer response", async () => {
    const search = searchFixture();
    const pending = [];
    const dashboard = {
        search, generation: 0, destroyed: false, sync() {},
        state: { loading: true, error: false, counts: {} },
        orm: { call: () => new Promise((resolve) => pending.push(resolve)) },
        notification: { add() {} },
    };
    const first = InvoiceDashboard.prototype.refresh.call(dashboard, true);
    const second = InvoiceDashboard.prototype.refresh.call(dashboard, true);
    pending[1]({ draft: 2, posted: 3, cancel: 4 });
    await second;
    pending[0]({ draft: 99, posted: 99, cancel: 99 });
    await first;
    expect(dashboard.state.counts.draft).toBe(2);
    expect(dashboard.state.loading).toBe(false);
});


test("revision safely handles circular relational values and tracks scalar changes", () => {
    const data = { state: "draft", invoice_date: DateTime.fromISO("2026-10-10") };
    data.activity_ids = { parent: data };
    const controller = { model: { root: { count: 1, records: [{ resId: 1, data }] } } };
    const get = Object.getOwnPropertyDescriptor(InvoiceDashboardController.prototype, "dashboardRevision").get;
    const before = get.call(controller);
    expect(get.call(controller)).toBe(before);
    data.state = "posted";
    expect(get.call(controller) === before).toBe(false);
    const posted = get.call(controller);
    data.invoice_date = DateTime.fromISO("2026-10-11");
    expect(get.call(controller) === posted).toBe(false);
    const dated = get.call(controller);
    controller.model.root.records[0].data = { ...data };
    expect(get.call(controller) === dated).toBe(false);
});
