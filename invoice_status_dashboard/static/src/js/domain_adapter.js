import { Domain } from "@web/core/domain";

export const FILTER_MARKER = "invoice_dashboard_kind";

export function activeOwnedFilters(searchModel, kind) {
    return searchModel.query.map((q) => searchModel.searchItems[q.searchItemId])
        .filter((item) => item && item[FILTER_MARKER] === kind);
}

/**
 * Odoo 19 compatibility boundary. Mirrors SearchModel._getDomain without its
 * one owned status group. Never mutate query, caches or globalDomain.
 * Private read-only helpers are isolated here and covered by domain tests.
 * Arbitrary user state filters / favorites must NOT be stripped or rewritten.
 */
export function countDomain(searchModel) {
    const domains = [searchModel.globalDomain];
    for (const group of searchModel._getGroups()) {
        const parts = group.activeItems
            .filter((active) => searchModel.searchItems[active.searchItemId]?.[FILTER_MARKER] !== "status")
            .map((active) => searchModel._getSearchItemDomain(active))
            .filter(Boolean);
        domains.push(Domain.or(parts));
    }
    if (searchModel.display.searchPanel) {
        domains.push(searchModel._getSearchPanelDomain());
    }
    return Domain.and(domains).toList(searchModel.domainEvalContext);
}

export function replaceOwnedFilter(searchModel, kind, filter) {
    const groups = new Set(activeOwnedFilters(searchModel, kind).map((item) => item.groupId));
    for (const group of groups) {
        searchModel.deactivateGroup(group);
    }
    if (filter) {
        searchModel.createNewFilters([{ ...filter, [FILTER_MARKER]: kind }]);
    }
}
