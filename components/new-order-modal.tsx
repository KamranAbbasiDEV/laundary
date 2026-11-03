"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  Search,
  X,
} from "lucide-react";
import { PickupWindowField } from "./ui/date-field";
import { orderWindowError } from "@/lib/order-scheduling";
import {
  defaultServiceCatalog,
  type ServiceCatalogItem,
} from "@/lib/service-catalog";
import type { CustomerAccount } from "@/lib/types";
import { Button } from "./ui/button";

const coordinate = z.number().finite().nullable().optional();
export const orderSchema = z
  .object({
    customerAccountId: z.string().uuid().optional(),
    accountType: z.enum(["person", "company"]),
    customer: z.string().min(2, "Customer name is required"),
    companyName: z.string().optional(),
    phone: z.string().min(7, "Phone number is required"),
    customerEmail: z
      .string()
      .email("Enter a valid email")
      .or(z.literal(""))
      .optional(),
    pickupAddress: z.string().min(5, "Pickup address is required"),
    pickupLatitude: coordinate,
    pickupLongitude: coordinate,
    sameAsPickup: z.boolean(),
    deliveryAddress: z.string().min(5, "Delivery address is required"),
    deliveryLatitude: coordinate,
    deliveryLongitude: coordinate,
    services: z.array(z.string()).min(1, "Choose at least one service"),
    bags: z.number().int().min(1, "At least one bag is required"),
    pickupStart: z.string().min(1, "Pickup start is required"),
    pickupEnd: z.string().min(1, "Pickup end is required"),
    deliveryStart: z.string().min(1, "Delivery start is required"),
    deliveryEnd: z.string().min(1, "Delivery end is required"),
    notes: z.string().max(4000).optional(),
  })
  .superRefine((value, context) => {
    if (value.accountType === "company" && !value.companyName?.trim())
      context.addIssue({
        code: "custom",
        path: ["companyName"],
        message: "Company name is required.",
      });
    const scheduleError = orderWindowError({
      pickupStartAt: value.pickupStart,
      pickupEndAt: value.pickupEnd,
      deliveryStartAt: value.deliveryStart,
      deliveryEndAt: value.deliveryEnd,
    }, {
      notBefore: new Date().toISOString(),
      toleranceMs: 60_000,
    });
    if (scheduleError)
      context.addIssue({
        code: "custom",
        path: [
          scheduleError.includes("Pickup start")
            ? "pickupStart"
            : scheduleError.includes("Pickup window end")
              ? "pickupEnd"
              : scheduleError.includes("must begin")
                ? "deliveryStart"
                : "deliveryEnd",
        ],
        message: scheduleError,
      });
  });

export type OrderForm = z.infer<typeof orderSchema>;
type Props = {
  onClose: () => void;
  onCreate: (data: OrderForm) => Promise<void>;
  title?: string;
  description?: string;
  submitLabel?: string;
  services?: ServiceCatalogItem[];
};
type Suggestion = {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
};
const stepFields: Array<Array<keyof OrderForm>> = [
  ["customer", "phone", "customerEmail", "companyName"],
  ["pickupAddress", "deliveryAddress", "services", "bags"],
  ["pickupStart", "pickupEnd", "deliveryStart", "deliveryEnd"],
];
const localDateTime = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const addLocalMinutes = (value: string, minutes: number) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  date.setMinutes(date.getMinutes() + minutes);
  return localDateTime(date);
};

export default function NewOrderModal({
  onClose,
  onCreate,
  title = "Create new order",
  description = "Staff intake with account, service, and scheduling review.",
  submitLabel = "Create order",
  services = defaultServiceCatalog,
}: Props) {
  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    trigger,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    mode: "onChange",
    defaultValues: {
      accountType: "person",
      customer: "",
      companyName: "",
      phone: "",
      customerEmail: "",
      pickupAddress: "",
      pickupLatitude: null,
      pickupLongitude: null,
      sameAsPickup: true,
      deliveryAddress: "",
      deliveryLatitude: null,
      deliveryLongitude: null,
      services: [services[0]?.name ?? "Wash & Fold"],
      bags: 1,
      pickupStart: "",
      pickupEnd: "",
      deliveryStart: "",
      deliveryEnd: "",
      notes: "",
    },
  });
  const [step, setStep] = useState(0);
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [accountQuery, setAccountQuery] = useState("");
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [submitError, setSubmitError] = useState("");
  const [availableServices, setAvailableServices] = useState(services);
  const [showServiceCreator, setShowServiceCreator] = useState(false);
  const [serviceDraft, setServiceDraft] = useState({
    name: "",
    description: "",
    price: "",
    turnaround: "",
  });
  const [serviceError, setServiceError] = useState("");
  const [savingService, setSavingService] = useState(false);
  const selectedAccountId = watch("customerAccountId");
  const selectedServices = watch("services") ?? [];
  const sameAsPickup = watch("sameAsPickup");
  const pickupAddress = watch("pickupAddress");
  const pickupLatitude = watch("pickupLatitude");
  const pickupLongitude = watch("pickupLongitude");
  const pickupStart = watch("pickupStart");
  const pickupEnd = watch("pickupEnd");
  const deliveryStart = watch("deliveryStart");
  const deliveryEnd = watch("deliveryEnd");
  const earliestPickup = useMemo(() => localDateTime(new Date()), []);
  const scheduleError = useMemo(
    () =>
      orderWindowError(
        {
          pickupStartAt: pickupStart,
          pickupEndAt: pickupEnd,
          deliveryStartAt: deliveryStart,
          deliveryEndAt: deliveryEnd,
        },
        { notBefore: earliestPickup, toleranceMs: 60_000 },
      ),
    [deliveryEnd, deliveryStart, earliestPickup, pickupEnd, pickupStart],
  );
  const scheduleComplete = Boolean(
    pickupStart && pickupEnd && deliveryStart && deliveryEnd,
  );
  useEffect(() => {
    let live = true;
    void fetch("/api/accounts", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (live) setAccounts(body.accounts ?? []);
      })
      .catch(() => {
        if (live) setAccounts([]);
      })
      .finally(() => {
        if (live) setLoadingAccounts(false);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    setAvailableServices(services);
  }, [services]);
  useEffect(() => {
    if (!sameAsPickup) return;
    setValue("deliveryAddress", pickupAddress, { shouldValidate: true });
    setValue("deliveryLatitude", pickupLatitude ?? null);
    setValue("deliveryLongitude", pickupLongitude ?? null);
  }, [sameAsPickup, pickupAddress, pickupLatitude, pickupLongitude, setValue]);
  const filteredAccounts = useMemo(() => {
    const needle = accountQuery.trim().toLowerCase();
    return accounts
      .filter(
        (account) =>
          account.active &&
          (!needle ||
            [
              account.displayName,
              account.companyName,
              account.contactName,
              account.phone,
              account.email,
            ].some((value) => value?.toLowerCase().includes(needle))),
      )
      .slice(0, 8);
  }, [accounts, accountQuery]);
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId),
    [accounts, selectedAccountId],
  );
  const chooseAccount = (account: CustomerAccount) => {
    const address =
      account.addresses.find((item) => item.isDefault) ?? account.addresses[0];
    setValue("customerAccountId", account.id);
    setValue("accountType", account.type);
    setValue("customer", account.contactName || account.displayName, {
      shouldValidate: true,
    });
    setValue("companyName", account.companyName ?? "");
    setValue("phone", account.phone ?? "", { shouldValidate: true });
    setValue("customerEmail", account.email ?? "", { shouldValidate: true });
    setValue("pickupAddress", address?.address ?? "", { shouldValidate: true });
    setValue("pickupLatitude", address?.latitude ?? null);
    setValue("pickupLongitude", address?.longitude ?? null);
  };
  const startNewAccount = () => {
    setValue("customerAccountId", undefined);
    setValue("customer", "");
    setValue("companyName", "");
    setValue("phone", "");
    setValue("customerEmail", "");
    setValue("pickupAddress", "");
    setValue("pickupLatitude", null);
    setValue("pickupLongitude", null);
    setAccountQuery("");
  };
  async function next() {
    setSubmitError("");
    if (await trigger(stepFields[step]))
      setStep((current) => Math.min(2, current + 1));
  }
  async function submit(data: OrderForm) {
    setSubmitError("");
    try {
      let accountId = data.customerAccountId;
      if (!accountId) {
        const response = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: data.accountType,
            displayName:
              data.accountType === "company" ? data.companyName : data.customer,
            companyName: data.companyName,
            contactName: data.customer,
            email: data.customerEmail,
            phone: data.phone,
            active: true,
            addresses: [
              {
                label: "Primary",
                address: data.pickupAddress,
                latitude: data.pickupLatitude ?? null,
                longitude: data.pickupLongitude ?? null,
                isDefault: true,
              },
            ],
          }),
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.error || "Unable to create the customer account.",
          );
        accountId = body.account.id;
      }
      await onCreate({ ...data, customerAccountId: accountId });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to create order.",
      );
    }
  }
  async function addService() {
    if (serviceDraft.name.trim().length < 2)
      return setServiceError("Enter a service name.");
    setSavingService(true);
    setServiceError("");
    try {
      const response = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serviceDraft),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Unable to add the service.");
      const service = body.service as ServiceCatalogItem;
      setAvailableServices((current) => [...current, service]);
      setValue("services", [...new Set([...selectedServices, service.name])], {
        shouldValidate: true,
      });
      setServiceDraft({ name: "", description: "", price: "", turnaround: "" });
      setShowServiceCreator(false);
      window.dispatchEvent(new CustomEvent("rinseline:data-changed"));
    } catch (error) {
      setServiceError(
        error instanceof Error ? error.message : "Unable to add the service.",
      );
    } finally {
      setSavingService(false);
    }
  }
  const steps = ["Account", "Services & addresses", "Pickup & delivery"];
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <section
        className="modal order-intake-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-order-title"
      >
        <header className="modal-header">
          <div>
            <h2 id="new-order-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close"
            disabled={isSubmitting}
          >
            <X size={16} />
          </button>
        </header>
        <div className="intake-steps" aria-label="Order intake progress">
          {steps.map((label, index) => (
            <div
              key={label}
              className={
                index === step ? "active" : index < step ? "complete" : ""
              }
            >
              <span>{index < step ? <Check size={13} /> : index + 1}</span>
              <small>{label}</small>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit(submit)}>
          <div className="modal-body">
            {step === 0 && (
              <section className="intake-step">
                <div className="intake-section-heading">
                  <div>
                    <strong>Select a CRM account</strong>
                    <small>
                      Choose an existing person or company, or add one during
                      intake.
                    </small>
                  </div>
                  {selectedAccountId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={startNewAccount}
                    >
                      <Plus size={14} />
                      New account
                    </Button>
                  )}
                </div>
                {!selectedAccountId && (
                  <>
                    <label className="orders-search">
                      <Search size={15} />
                      <input
                        className="form-control"
                        value={accountQuery}
                        onChange={(event) =>
                          setAccountQuery(event.target.value)
                        }
                        placeholder="Search people and companies"
                      />
                    </label>
                    <div className="intake-account-results">
                      {loadingAccounts ? (
                        <div className="empty compact-empty">Loading CRM…</div>
                      ) : (
                        filteredAccounts.map((account) => (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => chooseAccount(account)}
                          >
                            <span>
                              <strong>{account.displayName}</strong>
                              <small>
                                {[
                                  account.contactName,
                                  account.phone,
                                  account.email,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </small>
                            </span>
                            <ChevronRight size={15} />
                          </button>
                        ))
                      )}
                      {!loadingAccounts && !filteredAccounts.length && (
                        <div className="empty compact-empty">
                          No matching account. Complete the fields below to
                          create one.
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="form-grid">
                  <Field label="Account type">
                    {selectedAccountId ? (
                      <>
                        <input type="hidden" {...register("accountType")} />
                        <input
                          className="form-control"
                          value={
                            watch("accountType") === "company"
                              ? "Company"
                              : "Person"
                          }
                          readOnly
                        />
                      </>
                    ) : (
                      <select
                        className="form-control"
                        {...register("accountType")}
                      >
                        <option value="person">Person</option>
                        <option value="company">Company</option>
                      </select>
                    )}
                  </Field>
                  <Field label="Customer / contact">
                    <input
                      className="form-control"
                      {...register("customer")}
                      readOnly={Boolean(selectedAccountId)}
                    />
                    {errors.customer && (
                      <span className="field-error">
                        {errors.customer.message}
                      </span>
                    )}
                  </Field>
                  {watch("accountType") === "company" && (
                    <Field label="Company name">
                      <input
                        className="form-control"
                        {...register("companyName")}
                        readOnly={Boolean(selectedAccountId)}
                      />
                      {errors.companyName && (
                        <span className="field-error">
                          {errors.companyName.message}
                        </span>
                      )}
                    </Field>
                  )}
                  <Field label="Phone">
                    <input
                      className="form-control"
                      {...register("phone")}
                      readOnly={Boolean(selectedAccountId)}
                    />
                    {errors.phone && (
                      <span className="field-error">
                        {errors.phone.message}
                      </span>
                    )}
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      className="form-control"
                      {...register("customerEmail")}
                      readOnly={Boolean(selectedAccountId)}
                    />
                    {errors.customerEmail && (
                      <span className="field-error">
                        {errors.customerEmail.message}
                      </span>
                    )}
                  </Field>
                </div>
              </section>
            )}
            {step === 1 && (
              <section className="intake-step">
                <div className="form-grid">
                  <Field label="Services" full>
                    <div className="service-picker-heading">
                      <span>Select every service this order needs.</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowServiceCreator((current) => !current);
                          setServiceError('');
                        }}
                      >
                        <Plus size={14} />
                        {showServiceCreator ? 'Cancel new service' : 'Add service'}
                      </Button>
                    </div>
                    {showServiceCreator && (
                      <div className="inline-service-creator">
                        <input className="form-control" value={serviceDraft.name} onChange={(event) => setServiceDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Service name" />
                        <input className="form-control" value={serviceDraft.price} onChange={(event) => setServiceDraft((current) => ({ ...current, price: event.target.value }))} placeholder="Price or pricing note" />
                        <input className="form-control" value={serviceDraft.turnaround} onChange={(event) => setServiceDraft((current) => ({ ...current, turnaround: event.target.value }))} placeholder="Turnaround" />
                        <input className="form-control" value={serviceDraft.description} onChange={(event) => setServiceDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Short description" />
                        <div className="inline-service-actions">
                          {serviceError && <span className="field-error" role="alert">{serviceError}</span>}
                          <Button size="sm" onClick={() => void addService()} disabled={savingService}>{savingService ? 'Adding…' : 'Add and select'}</Button>
                        </div>
                      </div>
                    )}
                    <div className="service-choice-grid">
                      {availableServices.map((service) => {
                        const active = selectedServices.includes(service.name);
                        return (
                          <button
                            key={service.name}
                            type="button"
                            className={active ? "active" : ""}
                            onClick={() =>
                              setValue(
                                "services",
                                active
                                  ? selectedServices.filter(
                                      (value) => value !== service.name,
                                    )
                                  : [...selectedServices, service.name],
                                { shouldValidate: true },
                              )
                            }
                          >
                            <span>
                              {active && <Check size={13} />}
                              <strong>{service.name}</strong>
                            </span>
                            <small>
                              {[service.price, service.turnaround]
                                .filter(Boolean)
                                .join(" · ") || service.description}
                            </small>
                          </button>
                        );
                      })}
                    </div>
                    {errors.services && (
                      <span className="field-error">
                        {errors.services.message}
                      </span>
                    )}
                  </Field>
                  <Field label="Expected bags">
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      {...register("bags", { valueAsNumber: true })}
                    />
                    {errors.bags && (
                      <span className="field-error">{errors.bags.message}</span>
                    )}
                  </Field>
                  <Field label="Order notes">
                    <textarea className="form-control" {...register("notes")} />
                  </Field>
                  <Field label="Pickup address" full>
                    {selectedAccount &&
                      selectedAccount.addresses.length > 0 && (
                        <SavedAddresses
                          account={selectedAccount}
                          selected={pickupAddress}
                          onSelect={(address) => {
                            setValue("pickupAddress", address.address, {
                              shouldValidate: true,
                            });
                            setValue(
                              "pickupLatitude",
                              address.latitude ?? null,
                            );
                            setValue(
                              "pickupLongitude",
                              address.longitude ?? null,
                            );
                          }}
                        />
                      )}
                    <Controller
                      control={control}
                      name="pickupAddress"
                      render={({ field }) => (
                        <AddressAutocomplete
                          value={field.value}
                          onChange={(address, suggestion) => {
                            field.onChange(address);
                            setValue(
                              "pickupLatitude",
                              suggestion?.latitude ?? null,
                            );
                            setValue(
                              "pickupLongitude",
                              suggestion?.longitude ?? null,
                            );
                          }}
                        />
                      )}
                    />
                    {errors.pickupAddress && (
                      <span className="field-error">
                        {errors.pickupAddress.message}
                      </span>
                    )}
                  </Field>
                  <Field label="Delivery address" full>
                    <label className="same-address-check">
                      <input type="checkbox" {...register("sameAsPickup")} />
                      Same as pickup
                    </label>
                    {!sameAsPickup && (
                      <>
                        {selectedAccount &&
                          selectedAccount.addresses.length > 0 && (
                            <SavedAddresses
                              account={selectedAccount}
                              selected={watch("deliveryAddress")}
                              onSelect={(address) => {
                                setValue("deliveryAddress", address.address, {
                                  shouldValidate: true,
                                });
                                setValue(
                                  "deliveryLatitude",
                                  address.latitude ?? null,
                                );
                                setValue(
                                  "deliveryLongitude",
                                  address.longitude ?? null,
                                );
                              }}
                            />
                          )}
                        <Controller
                          control={control}
                          name="deliveryAddress"
                          render={({ field }) => (
                            <AddressAutocomplete
                              value={field.value}
                              onChange={(address, suggestion) => {
                                field.onChange(address);
                                setValue(
                                  "deliveryLatitude",
                                  suggestion?.latitude ?? null,
                                );
                                setValue(
                                  "deliveryLongitude",
                                  suggestion?.longitude ?? null,
                                );
                              }}
                            />
                          )}
                        />
                      </>
                    )}
                    {sameAsPickup && (
                      <div className="selected-address">
                        <MapPin size={15} />
                        {pickupAddress || "Add the pickup address first"}
                      </div>
                    )}
                    {errors.deliveryAddress && (
                      <span className="field-error">
                        {errors.deliveryAddress.message}
                      </span>
                    )}
                  </Field>
                </div>
              </section>
            )}
            {step === 2 && (
              <section className="intake-step">
                <WindowCard
                  title="Pickup window"
                  copy="The route planner uses this exact availability window."
                  start={pickupStart}
                  end={pickupEnd}
                  min={earliestPickup}
                  onStart={(value) =>
                    setValue("pickupStart", value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  onEnd={(value) =>
                    setValue("pickupEnd", value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  disabled={isSubmitting}
                  error={
                    errors.pickupStart?.message || errors.pickupEnd?.message
                  }
                />
                <WindowCard
                  title="Delivery window"
                  copy="The end of this window is the committed customer deadline."
                  start={deliveryStart}
                  end={deliveryEnd}
                  min={pickupEnd ? addLocalMinutes(pickupEnd, 1) : undefined}
                  onStart={(value) =>
                    setValue("deliveryStart", value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  onEnd={(value) =>
                    setValue("deliveryEnd", value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  disabled={isSubmitting}
                  error={
                    errors.deliveryStart?.message || errors.deliveryEnd?.message
                  }
                />
                {scheduleComplete && scheduleError && (
                  <div className="field-error intake-schedule-error" role="alert">
                    {scheduleError}
                  </div>
                )}
                <div className="intake-review">
                  <strong>Ready to create</strong>
                  <span>
                    {getValues("customer")} · {selectedServices.join(", ")} ·{" "}
                    {getValues("bags")} bag{getValues("bags") === 1 ? "" : "s"}
                  </span>
                  <small>
                    The order will enter the validation queue. After approval,
                    choose which ranked processor receives the first offer.
                  </small>
                </div>
              </section>
            )}
            {submitError && (
              <div className="field-error intake-submit-error" role="alert">
                {submitError}
              </div>
            )}
          </div>
          <footer className="modal-footer">
            <button
              type="button"
              className="button button-secondary"
              onClick={
                step === 0 ? onClose : () => setStep((current) => current - 1)
              }
              disabled={isSubmitting}
            >
              {step === 0 ? (
                "Cancel"
              ) : (
                <>
                  <ChevronLeft size={14} />
                  Back
                </>
              )}
            </button>
            {step < 2 ? (
              <button
                type="button"
                className="button button-primary"
                onClick={() => void next()}
                disabled={isSubmitting}
              >
                Continue
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                type="submit"
                className="button button-primary"
                disabled={isSubmitting || !scheduleComplete || Boolean(scheduleError)}
              >
                {isSubmitting ? "Creating…" : submitLabel}
              </button>
            )}
          </footer>
        </form>
      </section>
    </div>
  );
}

function WindowCard({
  title,
  copy,
  start,
  end,
  min,
  onStart,
  onEnd,
  disabled,
  error,
}: {
  title: string;
  copy: string;
  start: string;
  end: string;
  min?: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  disabled: boolean;
  error?: string;
}) {
  return (
    <div className="intake-window-card">
      <div>
        <strong>{title}</strong>
        <small>{copy}</small>
      </div>
      <PickupWindowField
        startValue={start}
        endValue={end}
        min={min}
        onStartChange={onStart}
        onEndChange={onEnd}
        disabled={disabled}
        aria-label={title}
      />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
function SavedAddresses({
  account,
  selected,
  onSelect,
}: {
  account: CustomerAccount;
  selected: string;
  onSelect: (address: CustomerAccount["addresses"][number]) => void;
}) {
  return (
    <div className="saved-address-options">
      {account.addresses.map((address) => (
        <button
          key={address.id}
          type="button"
          className={selected === address.address ? "active" : ""}
          onClick={() => onSelect(address)}
        >
          <MapPin size={12} />
          {address.label}
          {address.isDefault && <small>Default</small>}
        </button>
      ))}
    </div>
  );
}
export function AddressAutocomplete({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string, suggestion?: Suggestion) => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (!searching || value.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetch(`/api/mapbox/suggestions?q=${encodeURIComponent(value)}`, {
        signal: controller.signal,
      })
        .then((response) => response.json())
        .then((body) => setSuggestions(body.suggestions ?? []))
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searching, value]);
  return (
    <div className="address-autocomplete">
      <div className="address-input">
        <MapPin size={15} />
        <input
          className="form-control"
          value={value}
          onChange={(event) => { setSearching(true); onChange(event.target.value); }}
          onBlur={() => window.setTimeout(() => setSearching(false), 150)}
          autoComplete="off"
          placeholder="Start typing an address"
        />
      </div>
      {(suggestions.length > 0 || loading) && (
        <div className="address-suggestions">
          {loading && !suggestions.length ? (
            <span>Finding addresses…</span>
          ) : (
            suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => {
                  onChange(suggestion.address, suggestion);
                  setSuggestions([]);
                  setSearching(false);
                }}
              >
                <MapPin size={14} />
                <span>{suggestion.address}</span>
              </button>
            ))
          )}
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
    <div className={`form-field ${full ? "full" : ""}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}
