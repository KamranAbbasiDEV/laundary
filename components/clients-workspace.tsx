"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Building2,
  MapPin,
  Pencil,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";
import type { CustomerAccount, CustomerAddress } from "@/lib/types";
import { Button } from "./ui/button";
import { AddressAutocomplete } from "./new-order-modal";

type DraftAddress = Omit<CustomerAddress, "id"> & { id?: string };
type Draft = {
  id?: string;
  type: "person" | "company";
  displayName: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  notes: string;
  active: boolean;
  addresses: DraftAddress[];
};

const emptyDraft = (): Draft => ({
  type: "person",
  displayName: "",
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  notes: "",
  active: true,
  addresses: [{ label: "Primary", address: "", latitude: null, longitude: null, isDefault: true }],
});

export default function ClientsWorkspace({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | "person" | "company">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/accounts", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Unable to load customer accounts.");
      setAccounts(body.accounts ?? []);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load customer accounts.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return accounts.filter(
      (account) =>
        (type === "all" || account.type === type) &&
        (!needle ||
          [
            account.displayName,
            account.companyName,
            account.contactName,
            account.email,
            account.phone,
            ...account.addresses.map((address) => address.address),
          ].some((value) => value?.toLowerCase().includes(needle))),
    );
  }, [accounts, query, type]);
  const summary = useMemo(() => ({
    total: accounts.length,
    people: accounts.filter((account) => account.type === "person").length,
    companies: accounts.filter((account) => account.type === "company").length,
    addresses: accounts.reduce((count, account) => count + account.addresses.length, 0),
  }), [accounts]);

  const edit = (account: CustomerAccount) =>
    setDraft({
      id: account.id,
      type: account.type,
      displayName: account.displayName,
      companyName: account.companyName ?? "",
      contactName: account.contactName ?? "",
      email: account.email ?? "",
      phone: account.phone ?? "",
      notes: account.notes ?? "",
      active: account.active,
      addresses: account.addresses.map((address) => ({ ...address })),
    });
  const updateAddress = (index: number, patch: Partial<DraftAddress>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            addresses: current.addresses.map((address, addressIndex) =>
              addressIndex === index
                ? { ...address, ...patch }
                : patch.isDefault
                  ? { ...address, isDefault: false }
                  : address,
            ),
          }
        : current,
    );
  const removeAddress = (index: number) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            addresses: current.addresses
              .filter((_, addressIndex) => addressIndex !== index)
              .map((address, addressIndex) => ({
                ...address,
                isDefault: address.isDefault || addressIndex === 0,
              })),
          }
        : current,
    );

  async function save() {
    if (!draft) return;
    if (draft.displayName.trim().length < 2)
      return setError("A customer or account name is required.");
    if (draft.type === "company" && !draft.companyName.trim())
      return setError("Company name is required.");
    if (!draft.phone.trim() && !draft.email.trim())
      return setError("Add a phone number or email address.");
    if (draft.addresses.some((address) => address.address.trim().length < 5))
      return setError("Complete or remove each saved address.");
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/accounts", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Unable to save the account.");
      setAccounts((current) =>
        draft.id
          ? current.map((account) =>
              account.id === body.account.id ? body.account : account,
            )
          : [...current, body.account].sort((a, b) =>
              a.displayName.localeCompare(b.displayName),
            ),
      );
      setDraft(null);
      notify(`${body.account.displayName} was saved.`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to save the account.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="role-workspace clients-workspace">
      <div className="page-heading role-page-heading">
        <div>
          <div className="eyebrow">Lightweight CRM</div>
          <h1>People and companies</h1>
          <p>
            Keep contact details and service addresses ready for staff-created
            orders.
          </p>
        </div>
        <Button
          onClick={() => {
            setError("");
            setDraft(emptyDraft());
          }}
        >
          <Plus size={15} />
          Add account
        </Button>
      </div>
      <section className="crm-summary" aria-label="CRM summary">
        <div><strong>{summary.total}</strong><span>Accounts</span></div>
        <div><strong>{summary.people}</strong><span>People</span></div>
        <div><strong>{summary.companies}</strong><span>Companies</span></div>
        <div><strong>{summary.addresses}</strong><span>Saved addresses</span></div>
      </section>
      <section className="panel crm-panel">
        <div className="crm-toolbar">
          <label className="orders-search">
            <Search size={15} />
            <input
              className="form-control"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, phone, email, or address"
            />
          </label>
          <div className="crm-type-tabs" role="tablist">
            {(["all", "person", "company"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={type === value ? "active" : ""}
                onClick={() => setType(value)}
              >
                {value === "all"
                  ? "All"
                  : value === "person"
                    ? "People"
                    : "Companies"}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="empty">Loading customer accounts…</div>
        ) : error && !draft ? (
          <div className="empty">
            <div>
              <strong>CRM unavailable</strong>
              <p>{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadAccounts()}
              >
                Try again
              </Button>
            </div>
          </div>
        ) : filtered.length ? (
          <div className="crm-list">
            {filtered.map((account) => (
              <article key={account.id} className="crm-card">
                <div className="crm-avatar">
                  {account.type === "company" ? (
                    <Building2 size={18} />
                  ) : (
                    <UserRound size={18} />
                  )}
                </div>
                <div className="crm-card-main">
                  <div>
                    <strong>{account.displayName}</strong>
                    {!account.active && (
                      <span className="status status-muted">Inactive</span>
                    )}
                  </div>
                  <small>
                    {[
                      account.companyName,
                      account.contactName,
                      account.phone,
                      account.email,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Contact details pending"}
                  </small>
                  <span>
                    <MapPin size={13} />
                    {account.addresses.length
                      ? `${account.addresses.find((address) => address.isDefault)?.address ?? account.addresses[0].address}${account.addresses.length > 1 ? ` · +${account.addresses.length - 1} more` : ""}`
                      : "No saved addresses"}
                  </span>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Edit ${account.displayName}`}
                  onClick={() => edit(account)}
                >
                  <Pencil size={15} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">No accounts match this view.</div>
        )}
      </section>
      {draft && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setDraft(null);
          }}
        >
          <section
            className="modal crm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="crm-modal-title"
          >
            <header className="modal-header">
              <div>
                <h2 id="crm-modal-title">
                  {draft.id ? "Edit account" : "Add customer account"}
                </h2>
                <p>Store the details dispatch needs for future orders.</p>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setDraft(null)}
                disabled={saving}
              >
                <X size={16} />
              </button>
            </header>
            <div className="modal-body">
              <div className="form-grid">
                <Field label="Account type">
                  <select
                    className="form-control"
                    value={draft.type}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        type: event.target.value as Draft["type"],
                      })
                    }
                  >
                    <option value="person">Person</option>
                    <option value="company">Company</option>
                  </select>
                </Field>
                <Field label="Display name">
                  <input
                    className="form-control"
                    value={draft.displayName}
                    placeholder={draft.type === "company" ? "Account label shown to dispatch" : "Customer name"}
                    onChange={(event) =>
                      setDraft({ ...draft, displayName: event.target.value })
                    }
                  />
                </Field>
                {draft.type === "company" && (
                  <Field label="Company name">
                    <input
                      className="form-control"
                      value={draft.companyName}
                      placeholder="Legal or trading name"
                      onChange={(event) =>
                        setDraft({ ...draft, companyName: event.target.value })
                      }
                    />
                  </Field>
                )}
                <Field label="Primary contact">
                  <input
                    className="form-control"
                    value={draft.contactName}
                    placeholder="Main person to contact"
                    onChange={(event) =>
                      setDraft({ ...draft, contactName: event.target.value })
                    }
                  />
                </Field>
                <Field label="Phone">
                  <input
                    className="form-control"
                    value={draft.phone}
                    placeholder="Phone number"
                    onChange={(event) =>
                      setDraft({ ...draft, phone: event.target.value })
                    }
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    className="form-control"
                    value={draft.email}
                    placeholder="Email address"
                    onChange={(event) =>
                      setDraft({ ...draft, email: event.target.value })
                    }
                  />
                </Field>
                <Field label="Notes" full>
                  <textarea
                    className="form-control"
                    value={draft.notes}
                    placeholder="Access instructions, preferences, or account notes"
                    onChange={(event) =>
                      setDraft({ ...draft, notes: event.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="crm-address-heading">
                <div>
                  <strong>Saved addresses</strong>
                  <small>
                    Pickup and delivery locations available during order intake.
                  </small>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      addresses: [
                        ...draft.addresses,
                        {
                          label: `Address ${draft.addresses.length + 1}`,
                          address: "",
                          latitude: null,
                          longitude: null,
                          isDefault: draft.addresses.length === 0,
                        },
                      ],
                    })
                  }
                >
                  <Plus size={14} />
                  Add address
                </Button>
              </div>
              <div className="crm-address-list">
                {draft.addresses.map((address, index) => (
                  <div className="crm-address-row" key={address.id ?? index}>
                    <input
                      className="form-control"
                      aria-label="Address label"
                      value={address.label}
                      placeholder="Home, Office…"
                      onChange={(event) =>
                        updateAddress(index, { label: event.target.value })
                      }
                    />
                    <AddressAutocomplete value={address.address} onChange={(value, suggestion) => updateAddress(index, { address: value, latitude: suggestion?.latitude ?? null, longitude: suggestion?.longitude ?? null })} />
                    <label className="crm-default-check">
                      <input
                        type="radio"
                        name="default-address"
                        checked={address.isDefault}
                        onChange={() =>
                          updateAddress(index, { isDefault: true })
                        }
                      />
                      Default
                    </label>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => removeAddress(index)}
                      aria-label="Remove address"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {!draft.addresses.length && (
                  <div className="empty compact-empty">
                    No saved addresses yet.
                  </div>
                )}
              </div>
              {error && (
                <div className="field-error" role="alert">
                  {error}
                </div>
              )}
            </div>
            <footer className="modal-footer">
              <label className="crm-active-check">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(event) =>
                    setDraft({ ...draft, active: event.target.checked })
                  }
                />
                Active account
              </label>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setDraft(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save account"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`form-field ${full ? "full" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
