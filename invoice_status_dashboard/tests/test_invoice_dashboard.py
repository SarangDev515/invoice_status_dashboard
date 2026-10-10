from unittest.mock import patch

from odoo import Command
from odoo.exceptions import AccessError, ValidationError
from odoo.tests import tagged, new_test_user
from odoo.addons.account.tests.common import AccountTestInvoicingCommon


@tagged("post_install", "-at_install")
class TestInvoiceDashboard(AccountTestInvoicingCommon):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.moves = cls.env["account.move"]
        cls.draft = cls._invoice("2026-10-01")
        cls.posted = cls._invoice("2026-10-10")
        cls.posted.action_post()
        cls.cancelled = cls._invoice("2026-09-30")
        cls.cancelled.button_cancel()
        cls.undated = cls._invoice(False)
        cls.undated.invoice_date = False
        cls.fixture = cls.draft | cls.posted | cls.cancelled | cls.undated
        cls.domain = [("id", "in", cls.fixture.ids), ("move_type", "=", "out_invoice")]

    @classmethod
    def _invoice(cls, invoice_date, company_data=None):
        data = company_data or cls.company_data
        return cls.moves.with_company(data["company"]).create({
            "move_type": "out_invoice", "invoice_date": invoice_date,
            "partner_id": cls.partner_a.id,
            "invoice_line_ids": [Command.create({
                "name": "Dashboard test", "quantity": 1, "price_unit": 10,
                "account_id": data["default_account_revenue"].id, "tax_ids": [Command.clear()],
            })],
        })

    def test_states_and_empty(self):
        self.assertEqual(self.moves.invoice_dashboard_counts(self.domain), {"draft": 2, "posted": 1, "cancel": 1})
        self.assertEqual(self.moves.invoice_dashboard_counts([("id", "=", 0)]), {"draft": 0, "posted": 0, "cancel": 0})

    def test_inclusive_dates_and_missing_dates(self):
        self.assertEqual(self.moves.invoice_dashboard_counts(self.domain, "2026-10-01", "2026-10-10"), {"draft": 1, "posted": 1, "cancel": 0})
        self.assertEqual(self.moves.invoice_dashboard_counts(self.domain, "2026-10-10", "2026-10-10"), {"draft": 0, "posted": 1, "cancel": 0})

    def test_existing_domain_preserved(self):
        self.assertEqual(self.moves.invoice_dashboard_counts(self.domain + [("state", "=", "posted")]), {"draft": 0, "posted": 1, "cancel": 0})
        self.assertEqual(self.moves.invoice_dashboard_counts([("move_type", "=", "entry")]), {"draft": 0, "posted": 0, "cancel": 0})

    def test_invalid_parameters(self):
        for start, end in [("2026-10-10", "2026-10-01"), ("bad", "2026-10-01"), ("2026-10-01", None), (20261001, 20261010), ("2026-02-30", "2026-03-01")]:
            with self.assertRaises(ValidationError):
                self.moves.invoice_dashboard_counts(self.domain, start, end)
        with self.assertRaises(ValidationError):
            self.moves.invoice_dashboard_counts("[]")

    def test_acl_denies_portal(self):
        portal = new_test_user(self.env, login="dashboard_portal", groups="base.group_portal")
        with self.assertRaises(AccessError):
            self.moves.with_user(portal).invoice_dashboard_counts(self.domain)

    def test_record_rule(self):
        user = new_test_user(self.env, login="dashboard_reader", groups="account.group_account_invoice")
        user.company_ids = self.env.company
        self.env["ir.rule"].create({
            "name": "Dashboard test restriction", "model_id": self.env["ir.model"]._get_id("account.move"),
            "domain_force": "[('id', '!=', %s)]" % self.posted.id,
        })
        self.assertEqual(self.moves.with_user(user).invoice_dashboard_counts(self.domain)["posted"], 0)

    def test_company_scope(self):
        other_data = self.setup_other_company()
        other = self._invoice("2026-10-01", other_data)
        user = new_test_user(self.env, login="dashboard_company_reader", groups="account.group_account_invoice")
        user.company_ids = self.env.company | other_data["company"]
        model = self.moves.with_user(user).with_context(allowed_company_ids=[self.env.company.id])
        self.assertEqual(model.invoice_dashboard_counts([("id", "in", [self.draft.id, other.id])])["draft"], 1)

    def test_one_aggregation_call(self):
        with patch.object(type(self.moves), "_read_group", autospec=True, return_value=[("draft", 100000)]) as grouped:
            self.assertEqual(self.moves.invoice_dashboard_counts(self.domain)["draft"], 100000)
            self.assertEqual(grouped.call_count, 1)
            self.assertEqual(grouped.call_args.kwargs["aggregates"], ["__count"])
