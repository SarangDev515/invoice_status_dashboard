# Invoice Status Dashboard & Smart Dates — Odoo 19

Adds Draft / Posted / Cancelled count buttons and an invoice-date dropdown immediately before the standard invoice search bar. All existing list columns, accounting controls, upload controls, search, grouping, pagination, actions, and access rules remain inherited.

## Location and files

Installed source location: `D:\ODOO PROJECTS\ODOO-19\extra_addons\invoice_status_dashboard`.

- `__manifest__.py`, `__init__.py`: installation, dependencies and asset bundles.
- `models/account_move.py`: secured single-query grouped counts and date validation.
- `views/account_move_views.xml`: inherits `account.view_invoice_tree`; changes only `js_class`.
- `static/src/js/invoice_status_dashboard.js`: registered accounting-list controller, toolbar, custom date dialog, request sequencing.
- `static/src/js/domain_adapter.js`: isolated Odoo 19 search-model compatibility adapter.
- `static/src/js/date_ranges.js`: pure inclusive date-range helpers.
- `static/src/xml/invoice_status_dashboard.xml`: inherited list layout and Owl templates.
- `static/src/scss/invoice_status_dashboard.scss`: compact responsive styling.
- `tests/test_invoice_dashboard.py`: Odoo backend tests.
- `static/tests/dashboard.test.js`: Odoo HOOT helper, filtering, validation and race tests.
- `TESTING.md`: complete acceptance and manual regression checklist.
- `tools/validate_static.py`, `tools/check_frontend.cjs`: database-free validation.

## Behavior and deliberate defaults

The initial date state is **All Dates**, preserving the original screen's default scope. The dropdown has exactly five entries: Today, This Week, This Month, This Year, Custom Range. Remove its visible search facet to clear a predefined date filter; Custom Range also has a Clear button.

Today means the current calendar date only (start and end are the same date). Week start uses `localization.weekStart` (the Odoo user's language convention, 1=Monday through 7=Sunday). Month/year/week ranges end today, not at the future end of the period. Today's calendar date is calculated from the effective search/user timezone; browser/Luxon default is the fallback when no Odoo timezone is configured. All boundaries are inclusive, using `invoice_date`, and finite ranges exclude missing invoice dates.

Only one toolbar-owned status facet is active. Click its card again to remove it. Each date/status change keeps other facets. Counts intentionally exclude ONLY the toolbar's status facet, not arbitrary standard status filters. Thus a manually applied Posted filter makes Draft and Cancelled counts zero, and clicking Draft will intersect with that external Posted filter (zero results). This is intentional preservation of existing search criteria, not a replacement of user filters.

Removing the owned facets using the standard search UI updates the toolbar. Favorites still work normally: a saved favorite folds its domain into an opaque favorite facet, so any date/state conditions stored inside it are retained as user criteria. They are not reverse-engineered into owned toolbar controls; cards indicate only the toolbar's live facets. Additive toolbar facets can intersect with a favorite's date/state constraints.

Scoped to the inherited standard invoice list and actions with `default_move_type` equal to an invoice/credit-note/receipt type. Journal entries and embedded dialog lists are excluded. Custom actions without this context do not display the toolbar unless explicitly adapted. Both customer and vendor invoice variants inheriting this list are supported; their existing domain is never broadened.

Counts refresh on search-domain/context changes and visible row changes. They do not poll for invoices changed by other users: reload the list to fetch external changes. Request tokens prevent obsolete responses from overwriting newer results. Requests are coalesced for 80ms; successful identical domains avoid a repeat RPC. Failure shows an em dash and Retry without altering list data.

## Architecture and verified local Odoo 19 APIs

Inspected directly in the local source, whose `odoo/release.py` reports 19.0:

1. `account.view_invoice_tree` and invoice-derived primary views in `addons/account/views/account_move_views.xml`.
2. `accountMoveUploadListView` / `AccountMoveListController` from `@account/views/account_move_list/...`; subclassing retains accounting/upload behavior, renderer and button template.
3. `registry.category("views").add` registers `invoice_status_dashboard` without replacing the standard registry entry.
4. Primary Owl inheritance of `web.ListView`, inserting before `SearchBar` in its `layout-actions` slot. No global ControlPanel patch or DOM manipulation.
5. `SearchModel.createNewFilters`, `deactivateGroup`, `query`, `searchItems`, `context`, and the `update` event. Owned filters are ordinary removable facets.
6. Count-domain compatibility adapter reads `_getGroups`, `_getSearchItemDomain`, `_getSearchPanelDomain`, `globalDomain`, `domainEvalContext` and `display.searchPanel`, mirroring Odoo 19 `_getDomain` while omitting only the owned status criterion.
7. `Domain.and/or` (JavaScript) and `odoo.fields.Domain.AND` (Python).
8. `account.move._read_group(domain, groupby=["state"], aggregates=["__count"])`, returning `(state, count)` tuples. Standard read ACL checks and record rules; no sudo, public controller, raw SQL, or extra ACLs.
9. Owl lifecycle hooks, `useBus`, `useState`, `orm`, `dialog`, `notification`, `Dropdown`, `DropdownItem`, `Dialog`, and Odoo `DateTimeInput` with `type="date"` and Luxon date values.
10. Manifest `web.assets_backend` and `web.assets_unit_tests`; Odoo HOOT tests.

### Compatibility boundary

Odoo exposes no public count-domain API that omits just one arbitrary facet. Private read-only search helpers are confined to `domain_adapter.js`. Recheck that adapter and the layout slot after any major Odoo upgrade. Other add-ons that replace the same invoice `js_class` require a merged controller integration rather than competing overrides. The implementation was source-verified against this checkout, not certified against every enterprise/third-party installation.

## Windows development installation

1. Back up your target database first. Files are already in the extra_addons directory above.
2. In your Odoo config, ensure `addons_path` includes both standard directories and this directory, for example:
   ```ini
   addons_path = D:\ODOO PROJECTS\ODOO-19\odoo\addons,D:\ODOO PROJECTS\ODOO-19\addons,D:\ODOO PROJECTS\ODOO-19\extra_addons
   ```
   Keep all other existing addon paths; do not replace them blindly.
3. Stop your current Odoo process/service using your normal launcher. From PowerShell, start your usual server with:
   ```powershell
   Set-Location 'D:\ODOO PROJECTS\ODOO-19'
   & '.\venv\Scripts\python.exe' '.\odoo-bin' -c '.\odoo.conf'
   ```
4. Sign in as an administrator, activate developer mode, open Apps, and choose **Update Apps List**. Remove the default Apps-only search filter because this technical enhancement is not marked as an application.
5. Search for **Invoice Status Dashboard & Smart Dates**, then install. Open Accounting/Invoicing > Customers > Invoices in list mode.
6. To upgrade after code changes, stop the normal server first and run the following with your actual database name:
   ```powershell
   & '.\venv\Scripts\python.exe' '.\odoo-bin' -c '.\odoo.conf' -d YOUR_DATABASE -u invoice_status_dashboard --stop-after-init
   ```
   Restart the normal server afterward. Initial CLI installation uses `-i invoice_status_dashboard` instead of `-u`.
7. During development open the same Odoo URL with `?debug=assets` (or `&debug=assets` if it already has query parameters), upgrade the module, restart Odoo, and hard-refresh the browser. Do not delete arbitrary database asset records.
8. Review your configured Odoo logfile or launcher stderr; in the browser console/network panel look for missing module imports, Owl errors, and failed `invoice_dashboard_counts` calls.

`YOUR_DATABASE` is intentionally an installation parameter, not a source-code placeholder. Do not run upgrades against an unknown database.

## Typical Linux installation

Copy the complete folder to your configured custom-addons directory, such as `/opt/odoo/extra_addons/invoice_status_dashboard`, with readable ownership for the Odoo service user. Append `/opt/odoo/extra_addons` to existing `addons_path` in `/etc/odoo.conf`. Restart your actual service (often `sudo systemctl restart odoo`), update the Apps list and install as above.

Typical upgrade command, adjusted to your real service-user, executable and config paths:

```sh
sudo systemctl stop odoo
sudo -u odoo /opt/odoo/venv/bin/python /opt/odoo/odoo-bin -c /etc/odoo.conf -d YOUR_DATABASE -u invoice_status_dashboard --stop-after-init
sudo systemctl start odoo
```

Inspect `journalctl -u odoo` or the configured logfile. Never run two servers simultaneously against the same port during this procedure.

## Tests and deployment status

See `TESTING.md`. Database-free checks can be run with:

```powershell
& 'D:\ODOO PROJECTS\ODOO-19\venv\Scripts\python.exe' 'D:\ODOO PROJECTS\ODOO-19\extra_addons\invoice_status_dashboard\tools\validate_static.py'
node 'D:\ODOO PROJECTS\ODOO-19\extra_addons\invoice_status_dashboard\tools\check_frontend.cjs'
```

The add-on has **not been installed or tested in a running Odoo database by this delivery**. Static checks and standalone helper tests do not prove live installability, access-rule behavior, Owl rendering or browser regression acceptance. Run backend tests and the full browser checklist on a disposable test database before production deployment. No invoices, core source files, database settings, or running services were modified while creating the module.

## Uninstall

Uninstall from Apps using an authorized administrator, then restart and refresh the browser. Odoo removes the inherited view and asset declarations and the standard accounting view returns. The add-on has no custom records containing business data, stored fields, schema changes or invoice write operations. Remove the source directory only after uninstalling; removing files first can break the registry.
