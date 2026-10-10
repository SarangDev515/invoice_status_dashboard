{
    "name": "Invoice Status Dashboard & Smart Dates",
    "version": "19.0.1.0.0",
    "category": "Accounting/Accounting",
    "summary": "Invoice toolbar status counts and inclusive invoice-date filters",
    "license": "LGPL-3",
    "depends": ["account", "web"],
    "data": ["views/account_move_views.xml"],
    "assets": {
        "web.assets_backend": [
            "invoice_status_dashboard/static/src/js/*.js",
            "invoice_status_dashboard/static/src/xml/*.xml",
            "invoice_status_dashboard/static/src/scss/*.scss",
        ],
        "web.assets_unit_tests": ["invoice_status_dashboard/static/tests/*.test.js"],
    },
    "installable": True,
    "application": False,
}
