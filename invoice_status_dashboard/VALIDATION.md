# Validation results — 2026-10-10

Source target: local `D:\ODOO PROJECTS\ODOO-19` checkout; `odoo/release.py` reports version 19.0.

## Executed successfully

- 15 database-free static checks: Python AST syntax, manifest data/asset paths, XML well-formedness, unique local Odoo inheritance XPath targets, and JavaScript module syntax.
- 11 standalone assertions using the actual checkout's Luxon: Two Days, Monday/Sunday week starts, month/year boundaries, year crossover, custom-range validation, and an Asia/Calcutta timezone date crossover.
- 6 standalone assertions using the implementation's actual component methods with mocked services: obsolete responses cannot overwrite newer counts, loading clears, count errors are handled, retry recovers, and invalid custom Apply neither applies nor closes.

Commands executed:

```powershell
& 'D:\ODOO PROJECTS\ODOO-19\venv\Scripts\python.exe' 'D:\ODOO PROJECTS\ODOO-19\extra_addons\invoice_status_dashboard\tools\validate_static.py'
node 'D:\ODOO PROJECTS\ODOO-19\extra_addons\invoice_status_dashboard\tools\check_frontend.cjs'
```

Both completed successfully. No dependency installation was required.

## Verified from actual source

Invoice view inheritance and existing accounting controller/renderer/button extension chain; ListView layout-actions SearchBar insertion point; SearchModel filter creation, group deactivation, active group composition and update events; date picker props; configured language week start; user context timezone access; `_read_group` signature and `__count` aggregation; Python Domain API; manifest backend and unit-test bundle conventions.

## Not executed / not claimed

- Installing/upgrading/uninstalling the module in an Odoo database.
- Odoo backend test suite, real ACL/record-rule/company assertions, or real large-data benchmarks.
- Browser HOOT suite, Owl/QWeb rendering, asset compilation in a live registry, or visual/manual accounting regressions.
- Enterprise and third-party controller compatibility tests.

These require a running authorized test environment. Acceptance criterion 15 (verified live install/upgrade) and the visual/integration acceptance checklist are not certified by static checks. See TESTING.md before production deployment.

The implementation process created files only under the new add-on directory (and a build script in the chat workspace). It did not edit Odoo core, change odoo.conf, restart services, install the module, or change invoices/database contents.

## Circular-record runtime fix — 2026-10-10

The reported live Owl crash was caused by dashboardRevision serializing record.data, including circular Odoo relational objects. Replaced it with weak data-object identity and scalar/Luxon-date snapshots. Added four standalone regression assertions and a HOOT regression test for circular relational values, stable repeated reads, scalar/date changes and replaced data objects. Rerun: all 15 static checks and all 21 standalone assertions passed. The patched frontend has not yet been verified in the running browser. Restart/upgrade and refresh assets before checking localhost:8091.
