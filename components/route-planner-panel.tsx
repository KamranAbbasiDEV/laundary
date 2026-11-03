"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Navigation,
  PackageCheck,
  Route,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import RouteMap from "./route-map";
import { DateField } from "./ui/date-field";
import type { Order } from "@/lib/types";
import { notifyDataChanged } from "@/lib/live-updates";

type RouteType =
  "pickup" | "processor_dropoff" | "processor_pickup" | "delivery";
type RouteStop = {
  id: string;
  order_id: string;
  route_type: RouteType;
  sequence: number;
  status?: string;
  latitude?: number | null;
  longitude?: number | null;
  orders?:
    | { order_number?: string | null; customer_name?: string | null; status?: string | null }
    | Array<{ order_number?: string | null; customer_name?: string | null; status?: string | null }>
    | null;
};
type Draft = {
  id: string;
  durationSeconds?: number | null;
  distanceMeters?: number | null;
  coordinates?: [number, number][];
  stopCoordinates?: [number, number][];
  source?: string;
  warning?: string;
  stops: RouteStop[];
};
type RouteFocus = { orderId?: string };
type PlanFilter = "overdue" | "draft" | "active" | "all";
type ExistingPlan = {
  id: string;
  route_date: string;
  route_type: RouteType | "mixed";
  status: string;
  driver_id: string;
  urgency?: "on_track" | "due_soon" | "at_risk" | "overdue";
  mapbox_route?: {
    durationSeconds?: number | null;
    distanceMeters?: number | null;
    coordinates?: [number, number][];
  } | null;
  route_stops: RouteStop[];
};

const formatDistance = (meters?: number | null) =>
  meters == null
    ? "Distance unavailable"
    : meters === 0
      ? "No travel required"
      : meters < 1000
        ? `${Math.round(meters)} m`
        : `${(meters / 1000).toFixed(1)} km`;
const formatDuration = (seconds?: number | null) =>
  seconds == null
    ? "Duration unavailable"
    : seconds === 0
      ? "No travel time"
      : seconds < 60
        ? `${Math.max(1, Math.round(seconds))} sec`
        : `${Math.max(1, Math.round(seconds / 60))} min`;
const calendarDateInTimezone = (
  value: string | null | undefined,
  timezone: string,
): string => {
  if (!value) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(value));
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return timezone === "UTC" ? "" : calendarDateInTimezone(value, "UTC");
  }
};
const routeTypeFor = (order: Order): RouteType | null =>
  order.status === "Capacity confirmed"
    ? "pickup"
    : order.status === "Picked up"
      ? "processor_dropoff"
      : order.status === "Ready for pickup"
        ? "processor_pickup"
        : order.status === "Out for delivery"
          ? "delivery"
          : null;
const routeTypeLabel = (type: RouteType | "mixed") =>
  type === "pickup"
    ? "Customer pickup"
    : type === "processor_dropoff"
      ? "Processor drop-off"
      : type === "processor_pickup"
        ? "Processor pickup"
        : type === "delivery"
          ? "Customer delivery"
          : "Mixed stops";

export default function RoutePlannerPanel({
  orders,
  notify,
}: {
  orders: Order[];
  notify: (message: string) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [timezone, setTimezone] = useState("UTC");
  const [driverId, setDriverId] = useState("");
  const [drivers, setDrivers] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [plans, setPlans] = useState<ExistingPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [planFilter, setPlanFilter] = useState<PlanFilter>("overdue");
  const [showRoutedOrders, setShowRoutedOrders] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const routableForDate = useMemo(
    () =>
      orders.filter((order) => {
        const type = routeTypeFor(order);
        if (!type) return false;
        if (type === "pickup" && order.pickupWindowStartAt)
          return (
            calendarDateInTimezone(order.pickupWindowStartAt, timezone) === date
          );
        if (
          ["processor_pickup", "delivery"].includes(type) &&
          order.deliveryWindowStartAt
        )
          return (
            calendarDateInTimezone(order.deliveryWindowStartAt, timezone) ===
            date
          );
        return true;
      }),
    [orders, date, timezone],
  );
  const eligible = routableForDate.filter(
    (order) => !order.routeAssigned && !order.routeDrafted && !order.failedStop,
  );
  const alreadyRouted = routableForDate.filter(
    (order) => order.routeAssigned || order.routeDrafted || order.failedStop,
  );
  const selectedOrders = eligible.filter(
    (order) => order.internalId && selected.includes(order.internalId),
  );
  const selectableIds = eligible
    .map((order) => order.internalId)
    .filter((id): id is string => Boolean(id));
  const allEligibleSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id));
  const selectedDriverIsActive = drivers.some((driver) => driver.id === driverId);
  const selectedStopCount = selectedOrders.reduce(
    (count, order) =>
      count +
      (["pickup", "processor_pickup"].includes(routeTypeFor(order) ?? "")
        ? 2
        : 1),
    0,
  );
  const isRouteOverdue = (plan: ExistingPlan) => plan.urgency === "overdue";
  const sortedPlans = [...plans].sort((a, b) => {
    const overdueDifference = Number(isRouteOverdue(b)) - Number(isRouteOverdue(a));
    if (overdueDifference) return overdueDifference;
    return b.route_date.localeCompare(a.route_date);
  });
  const overduePlans = sortedPlans.filter(isRouteOverdue);
  const draftPlans = sortedPlans.filter((plan) => plan.status === "draft");
  const activePlans = sortedPlans.filter((plan) =>
    ["approved", "in_progress"].includes(plan.status),
  );
  const filteredPlans =
    planFilter === "overdue"
      ? overduePlans
      : planFilter === "draft"
      ? draftPlans
      : planFilter === "active"
        ? activePlans
        : sortedPlans;
  const visiblePlans = filteredPlans;
  const plansForOrder = (orderId?: string) =>
    orderId
      ? sortedPlans.filter((plan) =>
          plan.route_stops.some((stop) => stop.order_id === orderId),
        )
      : [];
  const orderNumberForStop = (stop: RouteStop) => {
    const linkedOrder = Array.isArray(stop.orders) ? stop.orders[0] : stop.orders;
    return (
      linkedOrder?.order_number ??
      orders.find((order) => order.internalId === stop.order_id)?.id ??
      "Order"
    );
  };
  const showRouteRegister = (filter: PlanFilter) => {
    setPlanFilter(filter);
    window.setTimeout(
      () =>
        document
          .querySelector(".route-plan-register")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  };
  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const response = await fetch("/api/route-plans", { cache: "no-store" });
      const body = await response.json();
      if (response.ok) setPlans(body.plans ?? []);
    } finally {
      setPlansLoading(false);
    }
  }, []);
  useEffect(() => {
    void fetch("/api/drivers")
      .then((response) => (response.ok ? response.json() : { drivers: [] }))
      .then((body) => setDrivers(body.drivers ?? []));
  }, []);
  useEffect(() => {
    if (driverId && drivers.length && !selectedDriverIsActive) setDriverId("");
  }, [driverId, drivers, selectedDriverIsActive]);
  useEffect(() => {
    setActionError("");
  }, [date, driverId, selected]);
  useEffect(() => {
    void fetch("/api/settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (body?.settings?.timezone) setTimezone(body.settings.timezone);
      });
  }, []);
  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);
  const openPlan = useCallback((plan: ExistingPlan) => {
    setDate(plan.route_date);
    setDriverId(plan.driver_id);
    const orderedStops = [...plan.route_stops].sort(
      (a, b) => a.sequence - b.sequence,
    );
    setSelected([...new Set(orderedStops.map((stop) => stop.order_id))]);
    const route = plan.mapbox_route ?? {};
    setDraft({
      id: plan.id,
      ...route,
      stops: orderedStops,
      stopCoordinates: orderedStops.flatMap((stop) =>
        typeof stop.longitude === "number" && typeof stop.latitude === "number"
          ? [[stop.longitude, stop.latitude] as [number, number]]
          : [],
      ),
    });
  }, []);
  useEffect(() => {
    const refresh = () => void loadPlans();
    window.addEventListener("rinseline:data-changed", refresh);
    return () => window.removeEventListener("rinseline:data-changed", refresh);
  }, [loadPlans]);
  useEffect(() => {
    if (plansLoading) return;
    const planFocus = window.localStorage.getItem("rinseline:route-plan-focus");
    if (planFocus) {
      const focusedPlan = plans.find(
        (plan) => plan.id === planFocus && plan.status === "draft",
      );
      window.localStorage.removeItem("rinseline:route-plan-focus");
      if (focusedPlan) {
        openPlan(focusedPlan);
        return;
      }
    }
    const raw = window.localStorage.getItem("rinseline:route-focus");
    if (!raw) return;
    try {
      const focus = JSON.parse(raw) as RouteFocus;
      const order = orders.find(
        (item) =>
          (item.internalId ?? item.id) === focus.orderId ||
          item.id === focus.orderId,
      );
      if (!order?.internalId) return;
      const existingDraft = plans.find(
        (plan) =>
          plan.status === "draft" &&
          plan.route_stops.some((stop) => stop.order_id === order.internalId),
      );
      if (existingDraft) {
        openPlan(existingDraft);
        return;
      }
      if (routeTypeFor(order) === "pickup" && order.pickupWindowStartAt)
        setDate(calendarDateInTimezone(order.pickupWindowStartAt, timezone));
      if (
        ["processor_pickup", "delivery"].includes(routeTypeFor(order) ?? "") &&
        order.deliveryWindowStartAt
      )
        setDate(calendarDateInTimezone(order.deliveryWindowStartAt, timezone));
      setSelected([order.internalId]);
      setDraft(null);
    } finally {
      window.localStorage.removeItem("rinseline:route-focus");
    }
  }, [openPlan, orders, plans, plansLoading, timezone]);
  const toggle = (id?: string) => {
    if (id && !draft)
      setSelected((current) =>
        current.includes(id)
          ? current.filter((value) => value !== id)
          : [...current, id],
      );
  };

  async function generate() {
    setActionError("");
    const stops: Array<{ orderId: string; routeType: RouteType }> = [];
    selectedOrders.forEach((order) => {
      if (!order.internalId) return;
      const routeType = routeTypeFor(order);
      if (routeType === "pickup")
        stops.push(
          { orderId: order.internalId, routeType },
          { orderId: order.internalId, routeType: "processor_dropoff" },
        );
      else if (routeType === "processor_pickup")
        stops.push(
          { orderId: order.internalId, routeType },
          { orderId: order.internalId, routeType: "delivery" },
        );
      else if (routeType) stops.push({ orderId: order.internalId, routeType });
    });
    if (!selectedDriverIsActive) return setActionError("Select an active driver for this route.");
    if (!stops.length) return setActionError("Select at least one eligible order from the list below.");
    if (stops.length > 25) return setActionError("Mapbox supports at most 25 stops per route. Deselect orders and create a second route.");
    setBusy(true);
    try {
      const response = await fetch("/api/route-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeDate: date, driverId, stops }),
      });
      const body = await response.json();
      if (!response.ok) {
        const message = body.error || "Unable to generate route.";
        setActionError(message);
        return notify(message);
      }
      setDraft({
        id: body.plan.id,
        ...body.route,
        stops: body.stops ?? [],
        stopCoordinates: (body.geocoded ?? []).flatMap(
          (item: { coordinates?: [number, number] | null }) =>
            item.coordinates ? [item.coordinates] : [],
        ),
      });
      void loadPlans();
      notifyDataChanged();
      notify("Draft route generated. Review or reorder stops before approval.");
    } catch {
      setActionError("Unable to generate route. Check the destination addresses and Mapbox configuration, then try again.");
      notify("Unable to generate route.");
    } finally {
      setBusy(false);
    }
  }
  async function reorder(index: number, delta: -1 | 1) {
    if (!draft) return;
    const target = index + delta;
    if (target < 0 || target >= draft.stops.length) return;
    const next = [...draft.stops];
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    try {
      const response = await fetch("/api/route-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorder",
          planId: draft.id,
          stopIds: next.map((stop) => stop.id),
        }),
      });
      const body = await response.json();
      if (!response.ok) return notify(body.error || "Unable to reorder draft.");
      setDraft({
        ...draft,
        ...body.route,
        stops: next.map((stop, sequence) => ({
          ...stop,
          sequence: sequence + 1,
        })),
        stopCoordinates: body.stopCoordinates ?? draft.stopCoordinates,
      });
      notifyDataChanged();
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    if (!draft) return;
    setBusy(true);
    try {
      const response = await fetch("/api/route-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: draft.id }),
      });
      const body = await response.json();
      if (!response.ok) return notify(body.error || "Unable to approve route.");
      notifyDataChanged();
      notify("Route approved and assigned.");
      setDraft(null);
      setSelected([]);
      await loadPlans();
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!draft) return;
    setBusy(true);
    try {
      const response = await fetch("/api/route-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          planId: draft.id,
          reason: "Dispatcher cancelled draft route",
        }),
      });
      const body = await response.json();
      if (!response.ok) return notify(body.error || "Unable to cancel draft.");
      notifyDataChanged();
      setDraft(null);
      setSelected([]);
      notify("Draft route cancelled.");
      await loadPlans();
    } finally {
      setBusy(false);
    }
  }
  const destination = (order: Order) => {
    const type = routeTypeFor(order);
    const processorDestination = order.processorAddress
      ? `${order.processor} · ${order.processorAddress}`
      : `${order.processor} facility`;
    return type === "pickup"
      ? `${order.address} → ${processorDestination}`
      : type === "processor_pickup"
        ? `${processorDestination} → ${order.deliveryAddress ?? order.address}`
        : type === "processor_dropoff"
          ? processorDestination
          : type === "delivery"
            ? (order.deliveryAddress ?? order.address)
            : order.address;
  };
  const stopLabel = (order: Order) => {
    const type = routeTypeFor(order);
    return type === "pickup"
      ? "Customer pickup → Processor drop-off"
      : type === "processor_pickup"
        ? "Processor pickup → Customer delivery"
        : type
          ? routeTypeLabel(type)
          : "Unavailable";
  };
  return (
    <>
      <section className="route-command-summary" aria-label="Route overview">
        <div className="route-summary-item">
          <PackageCheck size={18} />
          <span><strong>{eligible.length}</strong> ready to route</span>
        </div>
        <div className="route-summary-item">
          <Navigation size={18} />
          <span><strong>{alreadyRouted.length}</strong> already routed</span>
        </div>
        <div className={`route-summary-item${overduePlans.length ? " is-alert" : ""}`}>
          <AlertTriangle size={18} />
          <span><strong>{overduePlans.length}</strong> overdue routes</span>
        </div>
        <div className="route-summary-item">
          <Truck size={18} />
          <span><strong>{activePlans.length}</strong> active routes</span>
        </div>
      </section>
      <section className="panel route-builder-controls">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Build route</div>
            <h2>Driver and schedule</h2>
            <p>
              {draft
                ? "This setup is locked to the open draft. Cancel it before changing the date, driver, or orders."
                : "Choose a driver, then combine any eligible pickup, drop-off, processor, or delivery stops."}
            </p>
          </div>
        </div>
        <div className="panel-body form-grid">
          <div className="form-field">
            <label><CalendarDays size={15} /> Route date</label>
            <DateField
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-label="Route date"
              disabled={Boolean(draft)}
            />
          </div>
          <div className="form-field">
            <label><UserRound size={15} /> Driver</label>
            <select
              className="form-control"
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
              disabled={Boolean(draft)}
            >
              <option value="">Select driver</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ alignSelf: "end" }}>
            <Button
              onClick={() => void generate()}
              disabled={
                busy ||
                Boolean(draft) ||
                !selectedDriverIsActive ||
                !selectedOrders.length ||
                selectedStopCount > 25
              }
            >
              {busy ? (
                <LoaderCircle className="spin" size={14} />
              ) : (
                <Route size={14} />
              )}
              Generate route{selectedStopCount ? ` (${selectedStopCount} stops)` : ""}
            </Button>
            {!draft && !selectedDriverIsActive && <span className="field-helper">Choose a driver to continue.</span>}
            {!draft && selectedDriverIsActive && !selectedOrders.length && <span className="field-helper">Select one or more orders below.</span>}
            {selectedStopCount > 25 && (
              <span className="field-error">
                {selectedStopCount} stops selected; split this into routes of 25
                stops or fewer.
              </span>
            )}
            {actionError && <span className="field-error" role="alert">{actionError}</span>}
          </div>
        </div>
      </section>
      {draft && (
        <section className="panel route-preview-panel">
          <div className="route-map-wrap">
            <RouteMap
              routeCoordinates={draft.coordinates ?? []}
              stopCoordinates={draft.stopCoordinates ?? []}
            />
          </div>
          <div className="route-preview-details">
            <span className="status status-teal">Draft route</span>
            <strong>
              {formatDistance(draft.distanceMeters)} ·{" "}
              {formatDuration(draft.durationSeconds)}
            </strong>
            {draft.source === "direct_fallback" && (
              <div className="route-fallback-note" role="status">
                <AlertTriangle size={15} />
                <span>{draft.warning ?? "Testing fallback route with estimated geometry."}</span>
              </div>
            )}
            {draft.distanceMeters === 0 && (
              <div className="customer-location">
                This route has one stop or all stops share the same location.
              </div>
            )}
            <div className="route-list">
              {draft.stops.map((stop, index) => (
                <div className="route-row" key={stop.id}>
                  <span className="route-index">{index + 1}</span>
                  <span>
                    {orders.find((order) => order.internalId === stop.order_id)
                      ?.id || "Order"}{" "}
                    · {routeTypeLabel(stop.route_type)}
                  </span>
                  <span style={{ marginLeft: "auto" }}>
                    <button
                      className="icon-button"
                      disabled={busy || index === 0}
                      onClick={() => void reorder(index, -1)}
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      className="icon-button"
                      disabled={busy || index === draft.stops.length - 1}
                      onClick={() => void reorder(index, 1)}
                    >
                      <ChevronDown size={15} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
            <div className="route-draft-actions">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void cancel()}
                disabled={busy}
              >
                <X size={14} />
                Cancel
              </Button>
              <Button size="sm" onClick={() => void approve()} disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={14} />
                ) : (
                  <Check size={14} />
                )}
                Approve route
              </Button>
            </div>
          </div>
        </section>
      )}
      <section className="panel route-eligible-work">
        <div className="panel-heading">
          <div>
            <h2>Orders ready to move</h2>
            <p>
              {draft
                ? `${new Set(draft.stops.map((stop) => stop.order_id)).size} order${new Set(draft.stops.map((stop) => stop.order_id)).size === 1 ? "" : "s"} in the open draft · cancel the draft to change stops`
                : selectedOrders.length
                  ? `${selectedOrders.length} of ${eligible.length} selected`
                  : `${eligible.length} available`}
            </p>
          </div>
          <button
            className="button button-quiet"
            disabled={Boolean(draft) || selectableIds.length === 0}
            onClick={() => setSelected(allEligibleSelected ? [] : selectableIds)}
          >
            {allEligibleSelected ? "Clear selection" : "Select all"}
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Select</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Stop sequence</th>
                <th>Destination</th>
              </tr>
            </thead>
            <tbody>
              {eligible.map((order) => (
                <tr key={order.id} className={order.internalId && selected.includes(order.internalId) ? "route-order-selected" : ""}>
                  <td>
                    <label className="route-selection-check">
                      <input
                        type="checkbox"
                        checked={Boolean(order.internalId && selected.includes(order.internalId))}
                        disabled={Boolean(draft) || !order.internalId}
                        onChange={() => toggle(order.internalId)}
                        aria-label={`Select ${order.id} for this route`}
                      />
                    </label>
                  </td>
                  <td>{order.id}</td>
                  <td>{order.customer}</td>
                  <td>{stopLabel(order)}</td>
                  <td>{destination(order)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!eligible.length && (
            <div className="empty">
              {alreadyRouted.length
                ? "No new orders are available. The routable orders for this stage are already in a draft or active route—review them below."
                : "No orders are eligible for routing on this date."}
            </div>
          )}
        </div>
        {alreadyRouted.length > 0 && (
          <div className="route-committed-work">
            <div className="route-committed-heading">
              <div>
                <strong>Already in a route</strong>
                <span>{alreadyRouted.length} order{alreadyRouted.length === 1 ? " is" : "s are"} already assigned.</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowRoutedOrders((current) => !current)}>
                {showRoutedOrders ? "Hide" : `Review ${alreadyRouted.length}`}
              </Button>
            </div>
            {showRoutedOrders && <div className="route-committed-grid">
              {alreadyRouted.map((order) => {
                const linkedPlans = plansForOrder(order.internalId);
                const activePlan = linkedPlans.find((plan) => ["approved", "in_progress"].includes(plan.status));
                const failedPlan = linkedPlans.find((plan) => plan.status === "failed");
                const linkedDrafts = linkedPlans.filter((plan) => plan.status === "draft");
                const primaryPlan = activePlan ?? failedPlan ?? linkedDrafts[0];
                const driverName = primaryPlan
                  ? drivers.find((driver) => driver.id === primaryPlan.driver_id)?.name ?? "Assigned driver"
                  : "Route assignment";
                return (
                  <article className={`route-committed-card${activePlan && linkedDrafts.length ? " has-conflict" : ""}`} key={order.id}>
                    <div className="route-committed-card-top">
                      <span>
                        <strong>{order.id}</strong>
                        <small>{order.customer}</small>
                      </span>
                      <span className={`status status-${failedPlan ? "red" : activePlan ? "teal" : "amber"}`}>
                        {failedPlan ? "Recovery needed" : activePlan ? "Scheduled" : "In draft"}
                      </span>
                    </div>
                    <div className="route-committed-detail">
                      <span>{stopLabel(order)}</span>
                      <small>
                        {primaryPlan
                          ? `${primaryPlan.route_date} · ${driverName} · ${primaryPlan.status.replaceAll("_", " ")}`
                          : "Route record is refreshing"}
                      </small>
                    </div>
                    {activePlan && linkedDrafts.length > 0 && (
                      <div className="route-conflict-note">
                        Active route takes precedence · also found in {linkedDrafts.length} legacy draft{linkedDrafts.length === 1 ? "" : "s"}
                      </div>
                    )}
                    <div className="route-committed-actions">
                      {!activePlan && linkedDrafts[0] ? (
                        <Button variant="outline" size="sm" onClick={() => openPlan(linkedDrafts[0])}>Continue draft</Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => showRouteRegister(activePlan ? "active" : "all")}>
                          {activePlan ? "View active route" : "View route"}
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>}
          </div>
        )}
      </section>
      <section className="panel route-plan-register">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Saved work</div>
            <h2>Route register</h2>
            <p>Resume drafts or check routes already handed to drivers.</p>
          </div>
          <div className="route-register-filters" role="group" aria-label="Filter routes">
            <button type="button" className={planFilter === "overdue" ? "is-active" : ""} onClick={() => setPlanFilter("overdue")}>Overdue <span>{overduePlans.length}</span></button>
            <button type="button" className={planFilter === "draft" ? "is-active" : ""} onClick={() => setPlanFilter("draft")}>Drafts <span>{draftPlans.length}</span></button>
            <button type="button" className={planFilter === "active" ? "is-active" : ""} onClick={() => setPlanFilter("active")}>Active <span>{activePlans.length}</span></button>
            <button type="button" className={planFilter === "all" ? "is-active" : ""} onClick={() => setPlanFilter("all")}>All <span>{plans.length}</span></button>
          </div>
        </div>
        <div className="focus-queue-list">
          {visiblePlans.map((plan) => (
            <div className={`focus-queue-row route-plan-register-row${isRouteOverdue(plan) ? " is-overdue" : ""}`} key={plan.id}>
              <span className="focus-queue-order">
                <strong>{plan.route_date} · {routeTypeLabel(plan.route_type)}</strong>
                <small>
                  {plan.route_stops.length} stop{plan.route_stops.length === 1 ? "" : "s"} ·{" "}
                  {drivers.find((driver) => driver.id === plan.driver_id)?.name ?? "Assigned driver"}
                </small>
                <small className="route-plan-order-numbers">
                  {[...new Set(plan.route_stops.map(orderNumberForStop))].join(", ")}
                </small>
              </span>
              <span className="focus-queue-context">
                <span className={`status status-${isRouteOverdue(plan) || plan.status === "failed" ? "red" : plan.status === "approved" || plan.status === "in_progress" ? "teal" : "amber"}`}>
                  {isRouteOverdue(plan) ? `Overdue · ${plan.status.replaceAll("_", " ")}` : plan.status.replaceAll("_", " ")}
                </span>
                {plan.status === "draft" && (
                  <Button variant="outline" size="sm" onClick={() => openPlan(plan)}>Continue draft</Button>
                )}
              </span>
            </div>
          ))}
          {!visiblePlans.length && (
            <div className="empty compact-empty">
              {plansLoading ? "Loading routes…" : `No ${planFilter === "all" ? "saved" : planFilter} routes.`}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
