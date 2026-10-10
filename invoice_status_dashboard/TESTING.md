# Testing plan

## Delivery status

No live database install, upgrade, backend suite, or browser HOOT suite has been run by the implementation process. See VALIDATION.md for the database-free checks actually performed. Source verification is not a substitute for live acceptance.

## Backend automation

Use a disposable database with standard accounting/chart-of-accounts initialization and demo test fixtures; never a production database. Stop competing Odoo server processes first. From the Odoo root on Windows:

```powershell
& '.\venv\Scripts\python.exe' '.\odoo-bin' -c '.\odoo.conf' -d INVOICE_DASHBOARD_TEST_DB -i invoice_status_dashboard --test-enable --test-tags /invoice_status_dashboard --stop-after-init
```

For an already installed test module use `-u` instead of `-i`. Linux uses your actual venv Python and Odoo/config paths with the same flags. The supplied suite derives from `AccountTestInvoicingCommon` and is tagged post_install/-at_install.

Tests cover draft/posted/cancelled counts, empty results, inclusive single-day and multi-day ranges, missing invoice dates, invalid/incomplete dates and domains, preservation of caller domains, exclusion of journal entries, portal ACL denial, a restricting record rule, permitted company scoping, and one aggregation call returning a large count. The mocked large-count test verifies aggregation architecture, NOT real database query latency.

## Browser HOOT automation

On the disposable test server, open `/web/tests?mod=invoice_status_dashboard` (relative to your Odoo URL), enable the tests for this module, and inspect the HOOT report. `web.assets_unit_tests` includes `static/tests/dashboard.test.js`. If your checkout's test runner does not accept the `mod` parameter, open `/web/tests` and use its module filter.

Tests cover all four predefined ranges, configured week start, year crossover, custom-range validation, preservation of global/action and search-panel domains, external status constraints, status replacement/toggle-off, preservation of date/partner facets, invalid dialog Apply behavior, and out-of-order RPC responses. These are helper/component-method tests, not a full mounted-view test suite. Rendering, picker interaction, focus/keyboard behavior and integration with real action navigation are manual acceptance tests below.

## Manual frontend acceptance

Create known draft, posted and cancelled invoices with dates on each boundary and just outside the ranges; include an undated draft and other-company invoices. Use only a test database and authorized normal invoice actions.

1. Open Customers > Invoices list. Confirm exactly three cards precede the date dropdown and existing search bar, with original Create, Upload, list columns, search menus and pager intact.
2. Check each count against a standard search count, including beyond the visible pagination page. Start in All Dates.
3. Open and close dropdown by pointer and keyboard; confirm exactly Today / This Week / This Month / This Year / Custom Range.
4. Apply each predefined range, checking timezone-sensitive calendar dates and configured Monday/Sunday week start. Include month/year crossover. Confirm invoice_date, not accounting date or creation date, determines inclusion.
5. Open Custom Range. Independently pick Start Date and End Date. Try blank fields, invalid typed values and reversed dates; Apply must not close/apply invalid input. Same-day ranges are valid. Cancel retains previous applied selection; Clear removes only the owned date facet.
6. Apply boundary-inclusive custom dates; verify both list and count cards update and undated records disappear.
7. Click Draft, then Posted, then Cancelled; exactly one card is highlighted. Click the active card again to remove only its status facet.
8. With a status selected, change dates; state facet and highlight remain. Remove the state facet through the search bar; highlight clears. Remove the date facet; All Dates returns.
9. Apply partner, journal, overdue, standard state, Group By and search-panel filters where available. Check they remain intact. External contradictory state/date criteria intentionally intersect; do not expect toolbar clicks to delete user criteria.
10. Save and load favorites, including date and state criteria. Original favorite behavior is preserved; opaque favorite constraints are not mapped to owned card highlights. Confirm toggling toolbar facets never erases favorites.
11. Throttle network, quickly alternate date ranges and cards, and verify no stale response overwrites final counts. Count loading should be stable; list remains usable.
12. Block the count RPC only, verify em dash/error notification/Retry, then restore connectivity and retry. Verify empty results display zero, not errors.
13. Navigate list > form > back, change customer/vendor/credit-note actions, and switch view types. Confirm toolbar appears once per intended invoice list, never on journal-entry lists or embedded duplicate-move lists.
14. Resize to tablet/mobile widths, test light/dark theme where available, keyboard focus, screen-reader names, and reduced-motion preference. Search remains usable and buttons do not overlap.
15. Change active companies; compare counts with permitted standard list results. Test a restricted accounting user and invoice record rule. No unauthorized records may be counted.
16. Post/cancel/edit an invoice using standard authorized actions and return to list; compare counts again. Reload for updates made by another user; no cross-user polling is promised.

## Standard invoice regression

Verify search suggestions, Filters, Group By, Favorites, sorting, pagination, optional columns, Create, opening/editing drafts, posting/cancellation permissions, Send & Print, uploads, import/export, payment registration and ordinary action menus. Verify no change to totals, tax computation, journal entries, reconciliation or payment behavior. New module code must not invoke accounting write operations.

## Performance and release gate

- Test a realistically indexed disposable database with 100k+ invoices and applicable company/security rules. Monitor SQL and RPC counts in the Odoo profiler. A count request should use grouped ORM aggregation, not invoice search_read or page-by-page counting.
- Measure p50/p95 latency under representative partner/date/company domains; record environment and baseline. No arbitrary latency target is claimed by the supplied mocked test.
- Check narrow/large grouped lists, refresh after group member edits, and competing third-party list controllers. Integrate competing js_class controllers explicitly if necessary.
- Install, upgrade twice, restart, hard-refresh assets, then uninstall on the test database. Confirm assets/templates resolve and standard invoice views return.
- Release only after backend suite, HOOT suite, manual integration/regression and installation/upgrade checks pass on the actual edition and configuration. Record any remaining third-party compatibility exceptions.
