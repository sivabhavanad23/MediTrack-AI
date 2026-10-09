import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileWarning,
  Globe2,
  HeartPulse,
  LayoutDashboard,
  MapPin,
  Menu,
  Pill,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
  Warehouse,
} from "lucide-react";
import {
  daysUntilExpiry,
  findMedicineMatches,
  getDistanceKm,
  getStockStatus,
  initialInventory,
  isPubliclyAvailable,
  medicines,
  pharmacies,
  type StockBatch,
} from "./data";
import "./meditrack.css";

const DashboardCharts = lazy(() => import("./DashboardCharts"));

const dateLabel = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
const parsePackageDate = (value: string, isExpiry: boolean) => {
  const parts = value.split(/[/.\-]/).map(Number);
  if (parts.length < 2) return "";
  const yearValue = parts.at(-1)!;
  const year = yearValue < 100 ? 2000 + yearValue : yearValue;
  const month = parts.length === 2 ? parts[0] : parts[1];
  const day =
    parts.length === 2
      ? isExpiry
        ? new Date(Date.UTC(year, month, 0)).getUTCDate()
        : 1
      : parts[0];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (month < 1 || month > 12 || parsed.getUTCMonth() !== month - 1) return "";
  return parsed.toISOString().slice(0, 10);
};
const statusLabels: Record<string, string> = {
  AVAILABLE: "Available",
  LOW_STOCK: "Low stock",
  NEAR_EXPIRY: "≤ 30 days",
  EXPIRING_SOON: "≤ 60 days",
  UPCOMING_EXPIRY: "≤ 90 days",
  EXPIRED: "Expired",
  QUARANTINED: "Quarantined",
  RETURN_PENDING: "Return pending",
  RETURNED: "Returned",
  DISPOSAL_PENDING: "Disposal pending",
  DISPOSED: "Disposed",
};

function App() {
  const [inventory, setInventory] = useState<StockBatch[]>(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("meditrack.inventory") ?? "null") ??
        initialInventory
      );
    } catch {
      return initialInventory;
    }
  });
  const [page, setPage] = useState("dashboard");
  const [role, setRole] = useState("pharmacy");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [telugu, setTelugu] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionBatch, setActionBatch] = useState<string | null>(null);
  const [actionStatus, setActionStatus] =
    useState<NonNullable<StockBatch["actionStatus"]>>("RETURN_PENDING");
  const [actionNote, setActionNote] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [barcodeMessage, setBarcodeMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControls = useRef<IScannerControls | null>(null);
  const own = inventory.filter((item) => item.pharmacyId === "pharmacy-1");
  const units = own.reduce((sum, item) => sum + item.quantity, 0);
  const expired = own.filter((item) => daysUntilExpiry(item.expiryDate) < 0);
  const upcoming = own.filter(
    (item) =>
      daysUntilExpiry(item.expiryDate) >= 0 &&
      daysUntilExpiry(item.expiryDate) <= 90,
  );
  const stockValue = own.reduce(
    (sum, item) => sum + item.quantity * item.purchasePrice,
    0,
  );
  const searchResults = useMemo(() => {
    const matches = findMedicineMatches(query);
    const bestMatch = matches[0];
    return inventory
      .filter(
        (item) =>
          isPubliclyAvailable(item) &&
          item.medicineId === bestMatch?.id &&
          pharmacies.find((pharmacy) => pharmacy.id === item.pharmacyId)
            ?.verified === true,
      )
      .map((batch) => ({
        batch,
        medicine: medicines.find(
          (medicine) => medicine.id === batch.medicineId,
        )!,
        pharmacy: pharmacies.find(
          (pharmacy) => pharmacy.id === batch.pharmacyId,
        )!,
      }))
      .sort(
        (a, b) =>
          getDistanceKm(pharmacies[0], a.pharmacy) -
          getDistanceKm(pharmacies[0], b.pharmacy),
      );
  }, [inventory, query]);
  useEffect(() => {
    localStorage.setItem("meditrack.inventory", JSON.stringify(inventory));
  }, [inventory]);
  useEffect(() => () => scannerControls.current?.stop(), []);
  const go = (next: string) => {
    setPage(next);
    setMenuOpen(false);
  };
  const title =
    page === "dashboard"
      ? "Dashboard"
      : page === "search"
        ? "Find a medicine"
        : page === "scan"
          ? "Scan medicine"
          : page === "expiry"
            ? "Expiry management"
            : page === "expired"
              ? "Expired stock"
              : page === "forecast"
                ? "Demand forecast"
                : page === "analytics"
                  ? "Analytics"
                  : page === "notifications"
                    ? "Notifications"
                    : page === "profile"
                      ? "Pharmacy profile"
                      : page === "admin"
                        ? "Admin overview"
                        : page === "catalog"
                          ? "Medicine master"
                          : page === "settings"
                            ? "Settings"
                            : "Help & safety";
  const nav = [
    ["dashboard", "Overview", <LayoutDashboard size={17} />],
    ["inventory", "Inventory", <Boxes size={17} />],
    ["scan", "Scan medicine", <Pill size={17} />],
    ["expiry", "Expiry management", <CalendarDays size={17} />],
    ["expired", "Expired stock", <FileWarning size={17} />],
    ["forecast", "Demand forecast", <TrendingUp size={17} />],
    ["analytics", "Analytics", <BarChart3 size={17} />],
    ["notifications", "Notifications", <Bell size={17} />],
    ["profile", "Pharmacy profile", <Warehouse size={17} />],
    ["settings", "Settings", <Settings size={17} />],
    ["help", "Help & safety", <CircleHelp size={17} />],
  ] as const;
  const addBatch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const batch: StockBatch = {
      id: crypto.randomUUID(),
      pharmacyId: "pharmacy-1",
      medicineId: String(values.get("medicineId")),
      batchNumber: String(values.get("batchNumber")),
      supplier: String(values.get("supplier")),
      manufacturingDate: String(values.get("manufacturingDate")),
      expiryDate: String(values.get("expiryDate")),
      quantity: Number(values.get("quantity")),
      purchasePrice: Number(values.get("purchasePrice")),
      sellingPrice: Number(values.get("sellingPrice")),
      updatedAt: new Date().toISOString(),
    };
    if (
      batch.expiryDate < batch.manufacturingDate ||
      batch.quantity < 0 ||
      batch.purchasePrice < 0 ||
      batch.sellingPrice < 0
    ) {
      setNotice("Check dates, quantity, and prices before saving.");
      return;
    }
    setInventory((items) => [batch, ...items]);
    setNotice("Stock batch saved");
    go("inventory");
  };
  const scanFile = async (file?: File) => {
    if (!file) return;
    setSaving(true);
    setOcrText("Reading package text…");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const result = await worker.recognize(file);
      await worker.terminate();
      const text = result.data.text;
      setOcrText(text || "No readable text. Try a closer, brighter image.");
      const medicine = findMedicineMatches(text, 1)[0];
      const batch =
        text.match(
          /(?:batch|b\.?\s*no\.?|lot)\s*[:#\-]?\s*([A-Z0-9\-]{4,})/i,
        )?.[1] ?? "";
      const expiry = text.match(
        /(?:exp(?:iry)?\.?\s*(?:date)?|use before)\s*[:\-]?\s*(\d{1,2}[/. -]\d{1,2}[/. -]\d{2,4}|\d{1,2}[/. -]\d{4})/i,
      )?.[1];
      const manufacture = text.match(
        /(?:mfg|mfd|manufactured)\.?\s*[:\-]?\s*(\d{1,2}[/. -]\d{1,2}[/. -]\d{2,4}|\d{1,2}[/. -]\d{4})/i,
      )?.[1];
      if (medicine)
        document.querySelector<HTMLSelectElement>("#medicineId")!.value =
          medicine.id;
      if (batch)
        document.querySelector<HTMLInputElement>("#batchNumber")!.value =
          batch.toUpperCase();
      if (manufacture)
        document.querySelector<HTMLInputElement>("#manufacturingDate")!.value =
          parsePackageDate(manufacture, false);
      if (expiry)
        document.querySelector<HTMLInputElement>("#expiryDate")!.value =
          parsePackageDate(expiry, true);
    } catch {
      setOcrText("OCR could not run. Enter the details manually.");
    } finally {
      setSaving(false);
    }
  };
  const startBarcodeScan = async () => {
    if (!videoRef.current) return;
    setCameraOpen(true);
    setBarcodeMessage("Allow camera access to scan the package barcode.");
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      scannerControls.current = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (!result) return;
          const code = result.getText();
          const medicine = medicines.find((item) => item.barcode === code);
          scannerControls.current?.stop();
          setCameraOpen(false);
          if (medicine) {
            const select =
              document.querySelector<HTMLSelectElement>("#medicineId");
            if (select) {
              select.value = medicine.id;
              select.dispatchEvent(new Event("change", { bubbles: true }));
            }
            setBarcodeMessage(
              `${medicine.name} matched. Verify batch and expiry details before saving.`,
            );
          } else
            setBarcodeMessage(
              `Barcode ${code} is not in the verified medicine master. Enter details manually or ask an administrator to add it.`,
            );
        },
      );
    } catch {
      setCameraOpen(false);
      setBarcodeMessage(
        "Camera unavailable. Check browser permission or enter details manually.",
      );
    }
  };
  const saveExpiredAction = () => {
    if (!actionBatch) return;
    setInventory((items) =>
      items.map((item) =>
        item.id === actionBatch
          ? {
              ...item,
              actionStatus,
              actionNote,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    setActionBatch(null);
    setActionNote("");
    setNotice("Expired-stock action recorded");
  };
  const stat = (
    label: string,
    value: string,
    note: string,
    icon: React.ReactNode,
    tone: string,
  ) => (
    <article className="panel stat-card">
      <span className={`stat-icon ${tone}`}>{icon}</span>
      <small>{label}</small>
      <b>{value}</b>
      <span>{note}</span>
    </article>
  );
  const table = (rows: StockBatch[]) => (
    <div className="table-scroll">
      <table className="inventory-table">
        <thead>
          <tr>
            <th>MEDICINE</th>
            <th>BATCH</th>
            <th>EXPIRY</th>
            <th>QUANTITY</th>
            <th>PRICE</th>
            <th>STATUS</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((batch) => {
            const medicine = medicines.find(
              (item) => item.id === batch.medicineId,
            )!;
            const state = getStockStatus(batch);
            const isExpired = daysUntilExpiry(batch.expiryDate) < 0;
            return (
              <tr key={batch.id}>
                <td>
                  <b>{medicine.name}</b>
                  <small className="subcell">
                    {medicine.manufacturer} · {medicine.form}
                  </small>
                </td>
                <td>{batch.batchNumber}</td>
                <td>{dateLabel(batch.expiryDate)}</td>
                <td>{batch.quantity} units</td>
                <td>{money(batch.sellingPrice)}</td>
                <td>
                  <div className="status-stack">
                    <span className={`status status-${state.toLowerCase()}`}>
                      {statusLabels[state]}
                    </span>
                    {batch.actionStatus && (
                      <span
                        className={`status status-${batch.actionStatus.toLowerCase()}`}
                      >
                        {statusLabels[batch.actionStatus]}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  {isExpired ? (
                    <button
                      className="text-action"
                      onClick={() => {
                        setActionBatch(batch.id);
                        setActionStatus(batch.actionStatus ?? "RETURN_PENDING");
                        setActionNote(batch.actionNote ?? "");
                      }}
                    >
                      Manage
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="empty-cell">
                No batches found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
  const panelTitle = (
    name: string,
    caption: string,
    action?: string,
    target?: string,
  ) => (
    <div className="panel-heading">
      <div>
        <h3>{name}</h3>
        <p>{caption}</p>
      </div>
      {action && (
        <button className="text-action" onClick={() => target && go(target)}>
          {action} <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
  const dashboard = () => (
    <>
      <div className="welcome-band">
        <div className="welcome-icon">
          <HeartPulse size={20} />
        </div>
        <div>
          <small>
            PHARMACY OVERVIEW ·{" "}
            {new Date().toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
            })}
          </small>
          <h2>Good morning, Green Care</h2>
          <p>Your inventory is steady. Here’s what needs attention today.</p>
        </div>
        <button className="button button-light" onClick={() => go("scan")}>
          <Plus size={16} /> Add stock
        </button>
      </div>
      <div className="stat-grid">
        {stat(
          "Medicine types",
          new Set(own.map((item) => item.medicineId)).size.toString(),
          "Across active batches",
          <Pill size={18} />,
          "tone-sage",
        )}
        {stat(
          "Total stock units",
          units.toLocaleString("en-IN"),
          "All batch quantities",
          <Boxes size={18} />,
          "tone-blue",
        )}
        {stat(
          "Expiring in 90 days",
          upcoming.length.toString(),
          "Across all batches",
          <CalendarDays size={18} />,
          "tone-amber",
        )}
        {stat(
          "Expired stock",
          expired.reduce((sum, item) => sum + item.quantity, 0).toString(),
          "Units removed from sale",
          <FileWarning size={18} />,
          "tone-rose",
        )}
        {stat(
          "Low stock batches",
          own
            .filter((item) => item.quantity > 0 && item.quantity <= 10)
            .length.toString(),
          "10 units or fewer",
          <TrendingUp size={18} />,
          "tone-lilac",
        )}
        {stat(
          "Estimated stock value",
          money(stockValue),
          "At purchase price",
          <ShoppingBasket size={18} />,
          "tone-sea",
        )}
      </div>
      <Suspense
        fallback={<div className="chart-loading">Loading analytics…</div>}
      >
        <DashboardCharts
          categories={[
            "Pain relief",
            "Allergy",
            "Antibiotic",
            "Gastrointestinal",
            "Rehydration",
            "Vitamins",
          ].map((category) => ({
            category,
            units: own
              .filter(
                (batch) =>
                  medicines.find((medicine) => medicine.id === batch.medicineId)
                    ?.category === category,
              )
              .reduce((sum, batch) => sum + batch.quantity, 0),
          }))}
          expiry={[
            {
              name: "0–30 days",
              value: own.filter(
                (batch) =>
                  daysUntilExpiry(batch.expiryDate) >= 0 &&
                  daysUntilExpiry(batch.expiryDate) <= 30,
              ).length,
            },
            {
              name: "31–60 days",
              value: own.filter(
                (batch) =>
                  daysUntilExpiry(batch.expiryDate) > 30 &&
                  daysUntilExpiry(batch.expiryDate) <= 60,
              ).length,
            },
            {
              name: "61–90 days",
              value: own.filter(
                (batch) =>
                  daysUntilExpiry(batch.expiryDate) > 60 &&
                  daysUntilExpiry(batch.expiryDate) <= 90,
              ).length,
            },
            { name: "Expired", value: expired.length },
          ]}
          onInventory={() => go("inventory")}
          onExpiry={() => go("expiry")}
        />
      </Suspense>
      <section className="panel">
        {panelTitle(
          "Recent stock updates",
          "Latest activity at Green Care Pharmacy",
          "View inventory",
          "inventory",
        )}
        {table(own.slice(0, 5))}
      </section>
    </>
  );
  const pageBody = () => {
    if (page === "dashboard")
      return role === "admin" ? (
        <Admin
          pharmacies={pharmacies}
          medicines={medicines}
          expired={
            inventory.filter((item) => daysUntilExpiry(item.expiryDate) < 0)
              .length
          }
        />
      ) : role === "patient" ? (
        <SearchPage query={query} setQuery={setQuery} results={searchResults} />
      ) : (
        dashboard()
      );
    if (page === "search")
      return (
        <SearchPage query={query} setQuery={setQuery} results={searchResults} />
      );
    if (page === "inventory" || page === "expiry" || page === "expired") {
      const rows =
        page === "expired"
          ? own.filter(
              (item) =>
                daysUntilExpiry(item.expiryDate) < 0 || item.actionStatus,
            )
          : page === "expiry"
            ? own.filter(
                (item) =>
                  daysUntilExpiry(item.expiryDate) >= 0 &&
                  daysUntilExpiry(item.expiryDate) <= 90,
              )
            : own;
      return (
        <>
          <div className="section-toolbar">
            <div>
              <h2>
                {page === "inventory"
                  ? "Stock batches"
                  : page === "expiry"
                    ? "Upcoming expiry"
                    : "Expired-stock records"}
              </h2>
              <p>
                {rows.length} batches · expiry states are recalculated from the
                current date
              </p>
            </div>
            {page === "inventory" && (
              <button
                className="button button-primary"
                onClick={() => go("scan")}
              >
                <Plus size={16} /> Add stock
              </button>
            )}
          </div>
          {page === "expired" && (
            <div className="safety-banner">
              <AlertTriangle size={19} />
              <span>
                <b>Expired medicines are removed from patient availability.</b>{" "}
                Follow applicable waste requirements and supplier/manufacturer
                return procedures.
              </span>
            </div>
          )}
          {page === "expiry" && (
            <div className="expiry-counts">
              {[30, 60, 90].map((days) => (
                <div key={days}>
                  <small>WITHIN {days} DAYS</small>
                  <b>
                    {
                      own.filter(
                        (item) =>
                          daysUntilExpiry(item.expiryDate) >= 0 &&
                          daysUntilExpiry(item.expiryDate) <= days,
                      ).length
                    }
                  </b>
                  <span>batches to review</span>
                </div>
              ))}
            </div>
          )}
          <section className="panel">
            {page === "inventory" && (
              <div className="table-tools">
                <label>
                  <Search size={15} />
                  <input
                    placeholder="Search medicine or batch"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="all">All batches</option>
                  <option value="available">Available</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            )}
            {table(
              rows.filter(
                (item) =>
                  (page !== "inventory" ||
                    `${medicines.find((m) => m.id === item.medicineId)?.name} ${item.batchNumber}`
                      .toLowerCase()
                      .includes(query.toLowerCase())) &&
                  (filter === "all" ||
                    (filter === "available"
                      ? isPubliclyAvailable(item)
                      : daysUntilExpiry(item.expiryDate) < 0)),
              ),
            )}
          </section>
        </>
      );
    }
    if (page === "scan")
      return (
        <div className="scan-grid">
          <section className="panel scan-panel">
            <h2>Package scanner</h2>
            <p>
              Upload a clear medicine-package photo. OCR suggestions must be
              verified before saving.
            </p>
            <label className="upload-zone">
              <Upload size={22} />
              <b>
                {saving ? "Reading package…" : "Choose photo or take a picture"}
              </b>
              <span>JPG, PNG · Camera available on mobile</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => void scanFile(event.target.files?.[0])}
              />
            </label>
            {ocrText && (
              <div className="ocr-box">
                <Sparkles size={16} />
                <div>
                  <b>Review extracted text</b>
                  <p>{ocrText}</p>
                </div>
              </div>
            )}
            <div className="safety-inline">
              <ShieldCheck size={16} /> AI extraction is not verified until you
              review the package.
            </div>
            <div className="barcode-tools">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => void startBarcodeScan()}
              >
                <Camera size={15} /> Scan barcode
              </button>
              {cameraOpen && (
                <button
                  className="text-action"
                  type="button"
                  onClick={() => {
                    scannerControls.current?.stop();
                    setCameraOpen(false);
                  }}
                >
                  Stop camera
                </button>
              )}
            </div>
            <video
              ref={videoRef}
              className={`barcode-video ${cameraOpen ? "visible" : "hidden"}`}
              aria-label="Barcode camera preview"
            />
            {barcodeMessage && (
              <p className="barcode-message">{barcodeMessage}</p>
            )}
          </section>
          <section className="panel scan-panel">
            <h2>Confirm batch details</h2>
            <p>Complete and verify before adding stock.</p>
            <form className="stock-form" onSubmit={addBatch}>
              <label className="field wide">
                Medicine
                <select id="medicineId" name="medicineId">
                  {medicines.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {[
                ["Batch number", "batchNumber", "text"],
                ["Supplier", "supplier", "text"],
                ["Manufacturing date", "manufacturingDate", "date"],
                ["Expiry date", "expiryDate", "date"],
                ["Quantity", "quantity", "number"],
                ["Purchase price ₹", "purchasePrice", "number"],
                ["Selling price ₹", "sellingPrice", "number"],
              ].map(([label, name, type]) => (
                <label className="field" key={name}>
                  {label}
                  <input
                    id={name}
                    name={name}
                    type={type}
                    required
                    min={type === "number" ? 0 : undefined}
                  />
                </label>
              ))}
              <button className="button button-primary wide" type="submit">
                <CheckCircle2 size={16} /> Confirm & save batch
              </button>
            </form>
          </section>
        </div>
      );
    if (page === "forecast" || page === "analytics")
      return (
        <Forecast
          rows={medicines.map((medicine) => {
            const available = own
              .filter(
                (batch) =>
                  batch.medicineId === medicine.id &&
                  isPubliclyAvailable(batch),
              )
              .reduce((sum, batch) => sum + batch.quantity, 0);
            const avg =
              (
                {
                  "med-1": 85,
                  "med-2": 42,
                  "med-3": 18,
                  "med-4": 31,
                  "med-5": 54,
                } as Record<string, number>
              )[medicine.id] ?? 24;
            return {
              medicine,
              available,
              avg,
              predicted: Math.round(avg * 1.08),
            };
          })}
        />
      );
    if (page === "notifications")
      return (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Active alerts</h3>
              <p>Expiry and stock warnings calculated from current batches</p>
            </div>
          </div>
          {[...expired, ...upcoming].map((batch) => {
            const medicine = medicines.find(
              (item) => item.id === batch.medicineId,
            )!;
            const days = daysUntilExpiry(batch.expiryDate);
            return (
              <div className="alert-row" key={batch.id}>
                <span
                  className={days < 0 ? "alert-icon red" : "alert-icon amber"}
                >
                  {days < 0 ? (
                    <AlertTriangle size={17} />
                  ) : (
                    <Clock3 size={17} />
                  )}
                </span>
                <div>
                  <b>
                    {days < 0
                      ? `${medicine.name} batch expired`
                      : `${batch.quantity} units expire in ${days} days`}
                  </b>
                  <small>
                    {medicine.name} · ${batch.batchNumber} ·{" "}
                    {days < 0
                      ? "Removed from sale"
                      : dateLabel(batch.expiryDate)}
                  </small>
                </div>
              </div>
            );
          })}
        </section>
      );
    if (page === "profile")
      return (
        <section className="panel profile-panel">
          <span className="profile-mark">
            <HeartPulse size={26} />
          </span>
          <span className="verified">
            {" "}
            <ShieldCheck size={13} /> Verified pharmacy
          </span>
          <h2>Green Care Pharmacy</h2>
          <p>
            <MapPin size={15} /> Road No. 12, Banjara Hills, Hyderabad,
            Telangana 500034
          </p>
          <div className="profile-facts">
            <span>
              <b>+91 40 2345 6789</b>
              <small>PHONE</small>
            </span>
            <span>
              <b>Open until 10:00 PM</b>
              <small>HOURS</small>
            </span>
            <span>
              <b>17.4156, 78.4347</b>
              <small>LOCATION</small>
            </span>
          </div>
        </section>
      );
    if (page === "admin")
      return (
        <Admin
          pharmacies={pharmacies}
          medicines={medicines}
          expired={expired.length}
        />
      );
    if (page === "catalog")
      return (
        <section className="panel">
          {medicines.map((item) => (
            <div className="catalog-row" key={item.id}>
              <b>{item.name}</b>
              <span>{item.ingredient}</span>
              <small>
                {item.manufacturer} · {item.category} · Verified
              </small>
            </div>
          ))}
        </section>
      );
    if (page === "settings")
      return (
        <section className="panel setting-row">
          <div>
            <b>Language</b>
            <small>
              Medicine names stay in standard database representation.
            </small>
          </div>
          <button
            className="button button-secondary"
            onClick={() => setTelugu(!telugu)}
          >
            {telugu ? "తెలుగు" : "English"} · Switch
          </button>
        </section>
      );
    return (
      <section className="help-content">
        <h2>
          Information shown by MediTrack AI is for inventory and
          medicine-availability purposes only.
        </h2>
        <p>
          It does not provide medical advice, diagnosis, prescriptions, or
          dosage recommendations.
        </p>
        <div className="safety-banner">
          <ShieldCheck size={20} />
          <span>
            OCR suggestions require manual review. Fuzzy spelling matches do not
            determine clinical equivalence. Follow applicable
            pharmaceutical-waste requirements and supplier/manufacturer return
            procedures.
          </span>
        </div>
      </section>
    );
  };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">
            <HeartPulse size={19} />
          </span>
          <span>
            MediTrack<em>AI</em>
            <small>PHARMACY OPERATIONS</small>
          </span>
        </div>
        <button
          className="workspace"
          onClick={() =>
            setRole(
              role === "pharmacy"
                ? "patient"
                : role === "patient"
                  ? "admin"
                  : "pharmacy",
            )
          }
        >
          <span className="workspace-mark">
            <Warehouse size={16} />
          </span>
          <span>
            <b>
              {role === "pharmacy"
                ? "Green Care Pharmacy"
                : role === "patient"
                  ? "Medicine search"
                  : "Admin workspace"}
            </b>
            <small>
              {role === "pharmacy"
                ? "Verified pharmacy"
                : role === "patient"
                  ? "Patient view"
                  : "System administrator"}
            </small>
          </span>
          <ChevronDown size={15} />
        </button>
        <nav>
          {nav.map(([id, label, icon]) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => go(id)}
            >
              {icon}
              <span>
                {telugu && id === "dashboard"
                  ? "డాష్‌బోర్డ్"
                  : telugu && id === "inventory"
                    ? "నిల్వలు"
                    : label}
              </span>
            </button>
          ))}
          {role === "admin" && (
            <button
              className={`nav-item ${page === "catalog" ? "active" : ""}`}
              onClick={() => go("catalog")}
            >
              <Pill size={17} />
              <span>Medicine master</span>
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => go("help")}>
            <CircleHelp size={16} /> Help & safety
          </button>
          <div className="sidebar-user">
            <span>GC</span>
            <div>
              <b>Green Care Pharmacy</b>
              <small>Pharmacist account</small>
            </div>
          </div>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="scrim"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <main className="main">
        <header className="topbar">
          <button
            className="menu-toggle"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div className="crumb">
            Workspace <ChevronRight size={13} /> <b>{title}</b>
          </div>
          <div className="top-actions">
            <label className="top-search">
              <Search size={15} />
              <input
                placeholder="Search medicine…"
                value={query}
                onFocus={() => role !== "patient" && setRole("patient")}
                onChange={(event) => {
                  setQuery(event.target.value);
                  go("search");
                }}
              />
            </label>
            <button
              className="lang-toggle"
              onClick={() => setTelugu(!telugu)}
              aria-label="Switch language"
            >
              <Globe2 size={15} />
              {telugu ? "తెలుగు" : "EN"}
            </button>
            <button
              className="bell-button"
              aria-label="Notifications"
              onClick={() => go("notifications")}
            >
              <Bell size={18} />
              {upcoming.length + expired.length > 0 && <i />}
            </button>
            <button className="user-token" onClick={() => go("profile")}>
              GC
            </button>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <small>MEDI TRACK / {title.toUpperCase()}</small>
              <h1>{title}</h1>
              <p>
                {page === "dashboard"
                  ? "A clear view of what needs attention today."
                  : page === "search"
                    ? "Search current pharmacy-reported listings nearby."
                    : "Keep stock records accurate and up to date."}
              </p>
            </div>
            <span className="live-status">
              <i /> Live inventory
            </span>
          </div>
          {role === "patient" && (
            <div className="patient-note">
              <MapPin size={15} /> Pharmacy-reported listings only. Confirm
              availability before visiting.
              <button
                onClick={() => {
                  setRole("pharmacy");
                  go("dashboard");
                }}
              >
                Return to pharmacy
              </button>
            </div>
          )}
          {pageBody()}
          <footer>
            <span>
              © 2026 MediTrack AI · Inventory intelligence for pharmacy teams
            </span>
            <button onClick={() => go("help")}>Safety & limitations</button>
            <span>● All systems operational</span>
          </footer>
        </div>
      </main>
      {notice && (
        <button className="toast" onClick={() => setNotice("")}>
          <CheckCircle2 size={17} />
          {notice}
        </button>
      )}
      {actionBatch && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActionBatch(null);
          }}
        >
          <section
            className="action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="action-title"
          >
            <div className="modal-heading">
              <span>
                <FileWarning size={18} />
              </span>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setActionBatch(null)}
              >
                ×
              </button>
            </div>
            <h2 id="action-title">Record expired-stock action</h2>
            <p>
              Expired batches are excluded from public availability. Keep the
              record for traceability.
            </p>
            <label className="field">
              Next action
              <select
                value={actionStatus}
                onChange={(event) =>
                  setActionStatus(
                    event.target.value as NonNullable<
                      StockBatch["actionStatus"]
                    >,
                  )
                }
              >
                <option value="RETURN_PENDING">
                  Return to supplier · pending
                </option>
                <option value="RETURNED">Returned to supplier</option>
                <option value="DISPOSAL_PENDING">Disposal · pending</option>
                <option value="DISPOSED">Disposed · completed</option>
              </select>
            </label>
            <label className="field modal-notes">
              Notes (optional)
              <textarea
                rows={3}
                value={actionNote}
                onChange={(event) => setActionNote(event.target.value)}
                placeholder="Reference or responsible staff member"
              />
            </label>
            <p className="modal-safety">
              Follow applicable pharmaceutical-waste requirements and
              supplier/manufacturer return procedures.
            </p>
            <div className="modal-actions">
              <button
                className="button button-secondary"
                onClick={() => setActionBatch(null)}
              >
                Cancel
              </button>
              <button
                className="button button-primary"
                onClick={saveExpiredAction}
              >
                Save action
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;

function SearchPage({
  query,
  setQuery,
  results,
}: {
  query: string;
  setQuery: (value: string) => void;
  results: {
    batch: StockBatch;
    medicine: (typeof medicines)[number];
    pharmacy: (typeof pharmacies)[number];
  }[];
}) {
  const matches = findMedicineMatches(query);
  const selected = matches[0];
  const ingredientRecords = selected
    ? medicines.filter(
        (item) =>
          item.id !== selected.id &&
          item.ingredient.toLowerCase() === selected.ingredient.toLowerCase(),
      )
    : [];
  return (
    <>
      <section className="search-hero">
        <small>MEDICINE AVAILABILITY</small>
        <h2>Find it nearby.</h2>
        <p>Search pharmacy-reported stock around Banjara Hills, Hyderabad.</p>
        <label>
          <Search size={19} />
          <input
            autoFocus
            placeholder="Try “Paracetmol 500”"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <span>
          <MapPin size={14} /> Near Banjara Hills <ChevronDown size={14} />
        </span>
      </section>
      {query &&
        matches[0] &&
        !matches[0].name.toLowerCase().includes(query.toLowerCase()) && (
          <p className="did-you-mean">
            Did you mean{" "}
            <button onClick={() => setQuery(matches[0].name)}>
              {matches[0].name}
            </button>
            ?
          </p>
        )}
      {query ? (
        results.map(({ batch, medicine, pharmacy }) => (
          <article className="search-result panel" key={batch.id}>
            <Pill size={20} />
            <div>
              <b>{medicine.name}</b>
              <small>
                {pharmacy.name} · {pharmacy.address.split(",")[0]}
              </small>
              <small>
                <MapPin size={12} />{" "}
                {getDistanceKm(pharmacies[0], pharmacy).toFixed(1)} km · Updated{" "}
                {Math.max(
                  1,
                  Math.round(
                    (Date.now() - Date.parse(batch.updatedAt)) / 60000,
                  ),
                )}{" "}
                min ago
              </small>
            </div>
            <span className="status status-available">In stock</span>
            <b>{money(batch.sellingPrice)}</b>
            <a href={`tel:${pharmacy.phone}`}>Contact pharmacy</a>
          </article>
        ))
      ) : (
        <div className="search-empty">
          Enter a medicine name to see nearby availability.
          <div>
            {["Paracetamol 500 mg", "Cetirizine 10 mg", "ORS Orange 21 g"].map(
              (term) => (
                <button key={term} onClick={() => setQuery(term)}>
                  {term} →
                </button>
              ),
            )}
          </div>
        </div>
      )}
      {query && !results.length && (
        <div className="search-empty">
          <b>No currently available listing</b>
          <p>Expired, quarantined, and zero-quantity stock is never shown.</p>
        </div>
      )}
      {query && !results.length && ingredientRecords.length > 0 && (
        <section className="ingredient-notice">
          <ShieldCheck size={17} />
          <div>
            <b>Verified ingredient records</b>
            <p>
              These products are listed in the catalog as containing the same
              active ingredient. Ask a pharmacist or qualified healthcare
              professional before considering a substitution.
            </p>
            <span>
              {ingredientRecords.map((item) => item.name).join(" · ")}
            </span>
          </div>
        </section>
      )}
      <p className="search-disclaimer">
        Information shown by MediTrack AI is for inventory and
        medicine-availability purposes only. It does not provide medical advice,
        diagnosis, prescriptions, or dosage recommendations.
      </p>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <article className="panel stat-card">
      <span className={`stat-icon ${tone}`}>{icon}</span>
      <small>{label}</small>
      <b>{value}</b>
      <span>{note}</span>
    </article>
  );
}
function Panel({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
function Forecast({
  rows,
}: {
  rows: {
    medicine: (typeof medicines)[number];
    available: number;
    avg: number;
    predicted: number;
  }[];
}) {
  return (
    <>
      <div className="safety-banner">
        <TrendingUp size={19} />
        <span>
          <b>Inventory planning estimate only.</b> Baseline moving average uses
          illustrative sample history, not your pharmacy's sales data.
        </span>
      </div>
      <Panel
        title="Next 30-day demand"
        subtitle="Available stock compared with baseline estimated demand"
      >
        {rows.map((row) => (
          <div className="forecast-row" key={row.medicine.id}>
            <b>{row.medicine.name}</b>
            <span>{row.available} units on hand</span>
            <span>{row.avg} avg / month</span>
            <span>{row.predicted} estimated</span>
            <strong>
              {row.available < row.avg
                ? "Shortage risk"
                : row.available > row.avg * 1.7
                  ? "Expiry risk"
                  : "Balanced"}
            </strong>
          </div>
        ))}
      </Panel>
    </>
  );
}
function Admin({
  pharmacies: shops,
  medicines: catalog,
  expired,
}: {
  pharmacies: typeof pharmacies;
  medicines: typeof medicines;
  expired: number;
}) {
  return (
    <>
      <div className="stat-grid">
        <Stat
          icon={<Warehouse size={18} />}
          label="Pharmacies"
          value={shops.length.toString()}
          note="1 verified in sample data"
          tone="tone-sage"
        />
        <Stat
          icon={<Pill size={18} />}
          label="Medicine master"
          value={catalog.length.toString()}
          note="Verified demo records"
          tone="tone-blue"
        />
        <Stat
          icon={<FileWarning size={18} />}
          label="Expired records"
          value={expired.toString()}
          note="Across sample pharmacies"
          tone="tone-rose"
        />
        <Stat
          icon={<Users size={18} />}
          label="Review queue"
          value="2"
          note="Illustrative reports"
          tone="tone-amber"
        />
      </div>
      <Panel
        title="Pharmacy directory"
        subtitle="Verification and listing status"
      >
        {shops.map((shop) => (
          <div className="catalog-row" key={shop.id}>
            <b>{shop.name}</b>
            <span>{shop.address}</span>
            <small>{shop.verified ? "✓ Verified" : "Needs review"}</small>
          </div>
        ))}
      </Panel>
    </>
  );
}
