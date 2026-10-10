import { Component, onWillStart, onWillDestroy, onWillUpdateProps, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { SearchBar } from "@web/search/search_bar/search_bar";
import { useBus, useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { localization } from "@web/core/l10n/localization";
import { deserializeDate, formatDate, serializeDate } from "@web/core/l10n/dates";
import { user } from "@web/core/user";
import { Dialog } from "@web/core/dialog/dialog";
import { DateTimeInput } from "@web/core/datetime/datetime_input";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { accountMoveUploadListView } from "@account/views/account_move_list/account_move_list_view";
import { AccountMoveListController } from "@account/views/account_move_list/account_move_list_controller";
import { activeOwnedFilters, countDomain, replaceOwnedFilter } from "./domain_adapter";
import { predefinedRange, isValidRange } from "./date_ranges";

export class InvoiceDateDialog extends Component {
    static template = "invoice_status_dashboard.DateDialog";
    static components = { Dialog, DateTimeInput };
    static props = { close: Function, apply: Function, clear: Function, start: { optional: true }, end: { optional: true } };
    setup() {
        this.state = useState({
            start: this.props.start ? deserializeDate(this.props.start) : false,
            end: this.props.end ? deserializeDate(this.props.end) : false,
            error: "",
        });
    }
    setStart(value) { this.state.start = value; this.state.error = ""; }
    setEnd(value) { this.state.end = value; this.state.error = ""; }
    apply() {
        if (!isValidRange(this.state.start, this.state.end)) {
            this.state.error = _t("Provide both dates, with Start Date no later than End Date.");
            return;
        }
        this.props.apply(serializeDate(this.state.start), serializeDate(this.state.end));
        this.props.close();
    }
    clear() { this.props.clear(); this.props.close(); }
}

export class InvoiceDashboard extends Component {
    static template = "invoice_status_dashboard.Toolbar";
    static components = { Dropdown, DropdownItem };
    static props = { revision: { type: String, optional: true } };
    setup() {
        this.orm = useService("orm");
        this.dialog = useService("dialog");
        this.notification = useService("notification");
        this.search = this.env.searchModel;
        this.state = useState({ counts: { draft: 0, posted: 0, cancel: 0 }, loading: true, error: false, status: null, dateLabel: _t("All Dates") });
        this.cards = [
            { key: "draft", label: _t("Draft"), icon: "fa-pencil-square-o" },
            { key: "posted", label: _t("Posted"), icon: "fa-check-circle-o" },
            { key: "cancel", label: _t("Cancelled"), icon: "fa-times-circle-o" },
        ];
        this.options = [
            { key: "today", label: _t("Today") },
            { key: "week", label: _t("This Week") },
            { key: "month", label: _t("This Month") },
            { key: "year", label: _t("This Year") },
            { key: "custom", label: _t("Custom Range") },
        ];
        this.generation = 0;
        this.destroyed = false;
        useBus(this.search, "update", () => this.schedule());
        onWillStart(() => this.refresh());
        onWillUpdateProps((props) => {
            if (props.revision !== this.props.revision) { this.schedule(true); }
        });
        onWillDestroy(() => { this.destroyed = true; this.generation++; clearTimeout(this.timer); });
    }
    sync() {
        const status = activeOwnedFilters(this.search, "status").at(-1);
        const date = activeOwnedFilters(this.search, "date").at(-1);
        this.state.status = status?.dashboardState || null;
        this.state.dateLabel = date?.dashboardLabel || _t("All Dates");
        this.dateFilter = date;
    }
    schedule(force = false) {
        // Invalidate immediately, not just when the next request starts.
        this.generation++;
        this.sync();
        this.force = this.force || force;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => { const force = this.force; this.force = false; this.refresh(force); }, 80);
    }
    async refresh(force = false) {
        if (this.destroyed) { return; }
        this.sync();
        const domain = countDomain(this.search);
        const context = this.search.context;
        const signature = JSON.stringify([domain, context]);
        if (!force && signature === this.lastSignature && !this.state.error && !this.state.loading) { return; }
        const token = ++this.generation;
        this.state.loading = true;
        this.state.error = false;
        try {
            const counts = await this.orm.call("account.move", "invoice_dashboard_counts", [
                domain, this.dateFilter?.dashboardStart || null, this.dateFilter?.dashboardEnd || null,
            ], { context });
            if (this.destroyed || token !== this.generation) { return; }
            this.state.counts = counts;
            this.lastSignature = signature;
        } catch {
            if (this.destroyed || token !== this.generation) { return; }
            this.state.error = true;
            this.notification.add(_t("Invoice counts could not be loaded. Use Retry; invoice search is still available."), { type: "warning" });
        } finally {
            if (!this.destroyed && token === this.generation) { this.state.loading = false; }
        }
    }
    toggleStatus(key) {
        this.sync();
        const active = this.state.status === key;
        replaceOwnedFilter(this.search, "status", active ? null : {
            description: _t("Invoice Status: %s", this.cards.find((card) => card.key === key).label),
            domain: [["state", "=", key]], dashboardState: key,
        });
        this.schedule();
    }
    chooseDate(key) {
        if (key === "custom") {
            this.dialog.add(InvoiceDateDialog, {
                start: this.dateFilter?.dashboardStart,
                end: this.dateFilter?.dashboardEnd,
                apply: (start, end) => this.applyDate(start, end),
                clear: () => { replaceOwnedFilter(this.search, "date", null); this.schedule(); },
            });
            return;
        }
        const zone = this.search.context.tz || user.context.tz || luxon.Settings.defaultZone;
        const currentDay = luxon.DateTime.now().setZone(zone).startOf("day");
        const { start, end } = predefinedRange(key, currentDay, localization.weekStart);
        this.applyDate(start, end, this.options.find((option) => option.key === key).label);
    }
    applyDate(start, end, label) {
        label = label || `${formatDate(deserializeDate(start))} – ${formatDate(deserializeDate(end))}`;
        replaceOwnedFilter(this.search, "date", {
            description: _t("Invoice Date: %s", label),
            domain: [["invoice_date", ">=", start], ["invoice_date", "<=", end]],
            dashboardStart: start, dashboardEnd: end, dashboardLabel: label,
        });
        this.schedule();
    }
    retry() { this.refresh(true); }
}

export class InvoiceSearchBar extends SearchBar {
    static template = "invoice_status_dashboard.SearchBar";
    onFacetWheel(event) {
        const viewport = event.currentTarget;
        if (event.ctrlKey || viewport.scrollHeight <= viewport.clientHeight || !event.deltaY) { return; }
        event.preventDefault();
        event.stopPropagation();
        // Wheel/trackpad bursts must advance one complete row, never half a tag.
        const now = performance.now();
        if (this._lastFacetWheel !== undefined && now - this._lastFacetWheel < 140) { return; }
        this._lastFacetWheel = now;
        const rows = Array.from(viewport.children).filter((row) => row.offsetHeight > 0);
        const tops = [...new Set(rows.map((row) => row.offsetTop - rows[0].offsetTop))];
        const current = viewport.scrollTop;
        const next = event.deltaY > 0
            ? tops.find((top) => top > current + 1)
            : tops.filter((top) => top < current - 1).at(-1);
        if (next !== undefined) { viewport.scrollTop = next; }
    }
}

export class InvoiceDashboardController extends AccountMoveListController {
    static template = "invoice_status_dashboard.ListView";
    static components = { ...AccountMoveListController.components, InvoiceDashboard, InvoiceSearchBar };
    get showInvoiceDashboard() {
        // Standard invoice actions set this context; leave journal-entry actions alone.
        return ["out_invoice", "out_refund", "out_receipt", "in_invoice", "in_refund", "in_receipt"].includes(this.props.context.default_move_type) && !this.env.inDialog;
    }
    get dashboardRevision() {
        // Relational values are live Odoo objects and may contain cycles.
        // Track data replacement by weak identity; serialize only scalar/date values.
        this._dashboardDataIds ||= new WeakMap();
        this._dashboardNextDataId ||= 1;
        const root = this.model.root;
        const records = (root.records || []).map((record) => {
            const data = record.data || {};
            if (!this._dashboardDataIds.has(data)) {
                this._dashboardDataIds.set(data, this._dashboardNextDataId++);
            }
            const values = Object.entries(data).sort(([a], [b]) => a.localeCompare(b))
                .flatMap(([name, value]) => {
                    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
                        return [[name, value]];
                    }
                    if (luxon.DateTime.isDateTime(value)) {
                        return [[name, value.toISO()]];
                    }
                    return [];
                });
            return [record.resId, this._dashboardDataIds.get(data), values];
        }).sort((a, b) => a[0] - b[0]);
        return JSON.stringify([root.count, records]);
    }
}

registry.category("views").add("invoice_status_dashboard", {
    ...accountMoveUploadListView, Controller: InvoiceDashboardController,
});
