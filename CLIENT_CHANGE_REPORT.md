# Laundry Dispatch Application

## Client Change Report

**Release:** `33ad213`
**Branch:** `main`
**Date:** 19 October 2026
**Status:** Implemented, validated, and pushed to `origin/main`

## Executive summary

The order-management experience was refined around a Kanban-first workflow while preserving the existing table view, role permissions, route-planning workflow, and operational safeguards.

The main improvements are:

- Kanban is now the default Orders view.
- Table view remains available through a clear Board/Table toggle.
- Orders can be searched, filtered, selected, inspected, and moved between workflow stages.
- Single-card and selected-card drag-and-drop are supported for dispatch users.
- Each Kanban column has its own Select all/Clear control.
- Order details open in a modal on Kanban, preventing the board layout from breaking.
- Route planning is kept on the dedicated Routes page; the Orders page links to it instead of duplicating the planner.
- Status colors are standardized across the Orders views.
- Route consistency rules now protect approved and active routes.
- Draft routes are automatically cleaned up when an order no longer matches their route category.
- The React list-key warning in Processor scorecards was fixed.
- Permanent deletion requires the order to be archived first and requires confirmation.

## Orders experience

### Kanban board

The Orders page now opens in a six-column Kanban layout:

1. Intake
2. Awaiting processor
3. Pickup
4. Processing
5. Return and delivery
6. Completed

Each order card displays its status, customer, service, bag quantity, due window, processor assignment, exception indicator, and an order-details action.

The board supports:

- Moving one order by drag-and-drop.
- Selecting multiple cards and moving them together.
- Selecting all orders inside a specific column.
- Selecting all currently filtered orders.
- Immediate optimistic visual movement while the server update is processed.
- Automatic rollback if the server rejects the transition.
- Opening order details without leaving or distorting the board.

Normal workflow transition rules remain enforced by the API. A drag operation cannot bypass required operational steps such as processor acceptance or driver handoff evidence.

### Table view

The original table view remains available and includes:

- Search.
- Stage filtering.
- Exact status filtering where applicable.
- Sorting.
- Active, archived, or all-record filtering for Super Admin.
- Select-all and row selection.
- Pagination.
- Order inspection drawer.
- Consistent status colors matching the Kanban board.

### Order details

Kanban order details now open in a focused modal overlay. Closing the modal returns the user directly to the same board position and filter context.

The table view retains its side drawer behavior so the list and details can be reviewed together.

## Route-planning behavior

The Orders page no longer embeds a duplicate route planner. The existing route planner remains available on the Routes page, and the Orders page provides a direct Plan routes action for authorized users.

### Route eligibility

Route categories continue to use their required order statuses:

| Route category | Required order status |
| --- | --- |
| Customer pickup | Capacity confirmed |
| Processor drop-off | Picked up |
| Processor pickup | Ready for pickup |
| Customer delivery | Picked up from processor |

This means Kanban status changes automatically affect which route category can include an order.

### Protection for active routes

Dispatcher and Super Admin status changes are blocked when an order belongs to an approved or in-progress route. This prevents a manual Kanban change from silently corrupting a route already assigned to a driver.

The user receives a clear message explaining that the route must be completed or cancelled before changing the stage.

Driver and processor execution flows are not blocked by this protection. They can continue the operational handoff and production workflow normally.

### Draft route synchronization

If a status change causes an order to become ineligible for a draft route:

- The order is removed from that draft route.
- Remaining stops are resequenced.
- The draft route map is invalidated so it can be regenerated with correct stops.
- The order update is retained and any synchronization warning is surfaced to the user.

This prevents stale draft routes from being approved with orders that no longer belong to their selected route category.

## Roles and permissions

### Super Admin

- Full order management access.
- Kanban movement and bulk status actions.
- Archive, restore, and confirmed permanent deletion.
- Route planning and route approval.
- Protected from accidentally changing orders on approved or active routes.

### Dispatcher

- Kanban movement and operational order management.
- Single and bulk order movement subject to workflow rules.
- Exception recording.
- Route planning and approval.
- Cannot archive or permanently delete orders.
- Cannot silently alter orders already assigned to approved or active routes.

### Processor

- Existing processor work queue remains intact.
- Can start processing and mark eligible work ready for pickup.
- Facility ownership restrictions remain enforced.

### Driver

- Existing assigned-route and handoff restrictions remain intact.
- Required handoff evidence is still required before advancing relevant stages.

### Customer

- Customer permissions and operational restrictions remain unchanged.

## Other fixes included

- Standardized status color tones across Kanban, table, drawers, and other shared order views.
- Improved full-width application layout styling without changing the existing visual theme or adding animations.
- Preserved the Overview code while hiding it from the primary Super Admin and Dispatcher navigation where Orders is the operational priority.
- Fixed the `ScorecardsPanel` React unique-key warning.
- Added malformed drag-payload handling so an invalid browser drag event cannot crash the Kanban drop handler.
- Added archive-before-delete server enforcement.

## Validation performed

The following checks passed after implementation:

- `npm run lint`
  - TypeScript compilation completed successfully.
- `npm run build`
  - Production build completed successfully.
  - All 36 application routes compiled.
- `git diff --check`
  - No whitespace errors detected.
- Final repository state
  - Working tree clean.
  - Local `main` matches `origin/main`.

## Files changed in the release

- `components/orders-kanban.tsx`
- `components/orders-workspace.tsx`
- `components/orders-workspace-experimental.tsx`
- `components/dispatch-app.tsx`
- `components/workspace-module-enhanced.tsx`
- `components/scorecards-panel.tsx`
- `lib/order-statuses.ts`
- `lib/route-consistency.ts`
- `app/globals.css`
- `app/api/orders/[id]/route.ts`
- `app/api/orders/[id]/lifecycle/route.ts`
- `app/api/orders/bulk/route.ts`

## Screenshot note

No screenshot is embedded in this report because the final validation was performed through source checks, TypeScript validation, and the production build rather than a browser session. The recommended client review screenshots are:

1. Orders page opened in Kanban view.
2. A selected-card bulk drag from one stage to another.
3. Kanban order-details modal.
4. Table view with filters and status colors.
5. Routes page showing eligible orders and route generation.

## Client acceptance checklist

- [ ] Confirm Kanban is the preferred daily dispatcher workflow.
- [ ] Confirm single-card and multi-card movement behavior.
- [ ] Confirm unauthorized roles cannot perform dispatcher-only actions.
- [ ] Confirm an approved/in-progress route cannot be silently changed from Orders.
- [ ] Confirm draft routes are regenerated after eligibility changes.
- [ ] Confirm table view remains suitable for detailed inspection.
- [ ] Confirm the final appearance on the deployed environment at desktop and mobile widths.

