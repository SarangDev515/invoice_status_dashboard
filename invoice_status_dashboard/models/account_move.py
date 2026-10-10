from datetime import date

from odoo import api, models, _
from odoo.exceptions import ValidationError
from odoo.fields import Domain


class AccountMove(models.Model):
    _inherit = "account.move"

    @api.model
    def invoice_dashboard_counts(self, domain=None, start_date=None, end_date=None):
        """One grouped query; never sudo, SQL, or record materialization.

        The client supplies the action/search domain, excluding ONLY this add-on's
        own status facet. All other criteria (including external state filters)
        remain intact. ACLs and record rules are enforced by _read_group.
        """
        if domain is None:
            domain = []
        if not isinstance(domain, (list, tuple)):
            raise ValidationError(_("The invoice search domain must be a list."))
        if bool(start_date) != bool(end_date):
            raise ValidationError(_("Provide both Start Date and End Date."))
        dates = []
        if start_date and end_date:
            try:
                # Reject datetimes, non-ISO formats, and non-string RPC values.
                start = date.fromisoformat(start_date)
                end = date.fromisoformat(end_date)
                if start.isoformat() != start_date or end.isoformat() != end_date:
                    raise ValueError()
            except (TypeError, ValueError):
                raise ValidationError(_("Dates must use YYYY-MM-DD.")) from None
            if start > end:
                raise ValidationError(_("Start Date must not be later than End Date."))
            dates = [("invoice_date", ">=", start_date), ("invoice_date", "<=", end_date)]
        try:
            base = Domain(domain)
        except (TypeError, ValueError):
            raise ValidationError(_("Invalid invoice search domain.")) from None
        # Defensive exclusion of journal entries even if called with an empty domain.
        combined = Domain.AND([base, Domain([("move_type", "!=", "entry")]), Domain(dates)])
        rows = self._read_group(combined, groupby=["state"], aggregates=["__count"])
        counts = {"draft": 0, "posted": 0, "cancel": 0}
        for state, count in rows:
            if state in counts:
                counts[state] = count
        return counts
