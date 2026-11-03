"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

type PendingOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  service_type: string;
  expected_bags: number;
  pickup_address: string;
  customer_delivery_address?: string | null;
  due_at_label: string | null;
  pickup_window_start_at?: string | null;
  pickup_window_end_at?: string | null;
  delivery_window_start_at?: string | null;
  delivery_window_end_at?: string | null;
  validation_reason: string | null;
};

const incompleteFields = (order: PendingOrder) => [
  !order.customer_delivery_address && "delivery address",
  (!order.pickup_window_start_at || !order.pickup_window_end_at) && "pickup window",
  (!order.delivery_window_start_at || !order.delivery_window_end_at) && "delivery window",
].filter((field): field is string => Boolean(field));

export default function ValidationQueue({
  notify,
  onRefresh,
  onValidated,
  onCorrect,
}: {
  notify: (message: string) => void;
  onRefresh: () => Promise<void>;
  onValidated: (order: { id: string; internalId: string }) => void;
  onCorrect: (order: { id: string; internalId: string }) => void;
}) {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selected = useMemo(
    () => orders.find((order) => order.id === selectedId) ?? null,
    [orders, selectedId],
  );
  const selectedIncomplete = selected ? incompleteFields(selected) : [];

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/orders/validation", {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Unable to load intake requests.");
      setOrders(body.orders ?? []);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Unable to load intake requests.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("rinseline:data-changed", refresh);
    return () => window.removeEventListener("rinseline:data-changed", refresh);
  }, [load]);
  useEffect(() => {
    setSelectedId((current) =>
      orders.some((order) => order.id === current)
        ? current
        : (orders[0]?.id ?? ""),
    );
  }, [orders]);
  useEffect(() => {
    const focus = window.localStorage.getItem("rinseline:dispatch-focus");
    if (!focus) return;
    const target = orders.find(
      (order) => order.id === focus || order.order_number === focus,
    );
    if (target) {
      setSelectedId(target.id);
      window.localStorage.removeItem("rinseline:dispatch-focus");
    }
  }, [orders]);

  async function decide(
    order: PendingOrder,
    action: "approve" | "request_changes",
  ) {
    if (action === "request_changes" && !reason[order.id]?.trim())
      return notify("Describe what must be corrected first.");
    setBusy(order.id);
    try {
      const response = await fetch("/api/orders/validation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          action,
          reason: reason[order.id],
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error || "Unable to save the validation decision.",
        );
      notify(
        action === "approve"
          ? "Order validated. Review the processor ranking and choose who receives the first offer."
          : "Correction request saved for dispatcher follow-up.",
      );
      await onRefresh();
      await load();
      if (action === "approve")
        onValidated({ id: order.order_number, internalId: order.id });
    } catch (value) {
      notify(
        value instanceof Error
          ? value.message
          : "Unable to save the validation decision.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="panel focus-panel validation-focus-panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">First step</div>
          <h2>Review new intake</h2>
          <p>
            Select one request, verify the essentials, then accept it or hold it
            for correction.
          </p>
        </div>
        <div className="row-actions">
          <span className="status status-amber">{orders.length} waiting</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={Boolean(busy) || loading}
          >
            <RefreshCw className={loading ? "spin" : ""} size={14} />
          </Button>
        </div>
      </div>
      {error ? (
        <div className="empty compact-empty error-empty">
          <strong>Intake queue unavailable</strong>
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : orders.length ? (
        <div className="intake-review-layout">
          <div className="intake-list" aria-label="Orders waiting for intake">
            {orders.map((order) => (
              <button
                type="button"
                key={order.id}
                className={order.id === selected?.id ? "active" : ""}
                onClick={() => setSelectedId(order.id)}
              >
                <span>
                  <strong>{order.order_number}</strong>
                  <small>
                    {order.customer_name} · {order.service_type}
                  </small>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
          {selected && (
            <div className="intake-detail">
              <div className="intake-detail-heading">
                <div>
                  <span className="eyebrow">Intake request</span>
                  <h3>{selected.order_number}</h3>
                </div>
                <span>
                  {selected.expected_bags} bag
                  {selected.expected_bags === 1 ? "" : "s"}
                </span>
              </div>
              <dl className="compact-facts">
                <div>
                  <dt>Customer</dt>
                  <dd>{selected.customer_name}</dd>
                </div>
                <div>
                  <dt>Service</dt>
                  <dd>{selected.service_type}</dd>
                </div>
                <div className="wide">
                  <dt>Pickup address</dt>
                  <dd>{selected.pickup_address}</dd>
                </div>
                <div className="wide">
                  <dt>Delivery address</dt>
                  <dd>{selected.customer_delivery_address || `${selected.pickup_address} (same as pickup)`}</dd>
                </div>
                <div>
                  <dt>Pickup</dt>
                  <dd>
                    {selected.pickup_window_start_at &&
                    selected.pickup_window_end_at
                      ? `${new Date(selected.pickup_window_start_at).toLocaleString()} – ${new Date(selected.pickup_window_end_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                      : selected.due_at_label
                        ? `${selected.due_at_label} (legacy request; add exact date and time)`
                        : "Needs exact date and time"}
                  </dd>
                </div>
                <div>
                  <dt>Delivery</dt>
                  <dd>
                    {selected.delivery_window_start_at &&
                    selected.delivery_window_end_at
                      ? `${new Date(selected.delivery_window_start_at).toLocaleString()} – ${new Date(selected.delivery_window_end_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                      : "Needs exact date and time"}
                  </dd>
                </div>
                <div>
                  <dt>Requested due</dt>
                  <dd>{selected.due_at_label || "Not provided"}</dd>
                </div>
              </dl>
              {selectedIncomplete.length > 0 && (
                <div className="intake-completion-callout" role="status">
                  <strong>Complete this legacy intake before validation</strong>
                  <span>Add {selectedIncomplete.join(", ")} so routing and delivery cannot fail later.</span>
                </div>
              )}
              <label className="form-field">
                <span>
                  Correction note <small>only if holding</small>
                </span>
                <textarea
                  className="form-control"
                  value={
                    reason[selected.id] ?? selected.validation_reason ?? ""
                  }
                  onChange={(event) =>
                    setReason((current) => ({
                      ...current,
                      [selected.id]: event.target.value,
                    }))
                  }
                  placeholder="Explain exactly what information is missing or conflicting."
                />
              </label>
              <div className="intake-actions">
                <Button
                  onClick={() => void decide(selected, "approve")}
                  disabled={busy === selected.id || selectedIncomplete.length > 0}
                >
                  {busy === selected.id ? (
                    <LoaderCircle className="spin" size={14} />
                  ) : (
                    <Check size={14} />
                  )}
                  Accept intake
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void decide(selected, "request_changes")}
                  disabled={busy === selected.id}
                >
                  Hold for correction
                </Button>
                {(selected.validation_reason || selectedIncomplete.length > 0) && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      onCorrect({
                        id: selected.order_number,
                        internalId: selected.id,
                      })
                    }
                    disabled={busy === selected.id}
                  >
                    Complete intake details
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="empty compact-empty">
          {loading ? "Loading intake requests…" : "No new intake is waiting."}
        </div>
      )}
    </section>
  );
}
