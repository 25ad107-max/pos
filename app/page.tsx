"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Box,
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  Clock3,
  CreditCard,
  Gauge,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Truck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Role = "SUPER_ADMIN" | "MANAGER" | "BILLING_STAFF" | "STAFF" | "DRIVER";
type User = { id: string; name: string; email: string; role: Role };
type Driver = {
  id: string;
  driverNumber: string;
  name: string;
  phone: string;
  alternatePhone: string | null;
  address: string | null;
  licenceNumber: string;
  licenceExpiry: string | null;
  joiningDate: string | null;
  salaryType: "PER_LOAD" | "DAILY_WAGE" | "MONTHLY" | "CUSTOM";
  ratePerLoad: string | number;
  baseSalary: string | number;
  bankOrUpi: string | null;
  emergencyContact: string | null;
  notes: string | null;
  status: "ACTIVE" | "INACTIVE";
  userId: string | null;
  _count: { loads: number; assignedVehicles: number };
  assignedVehicles: { id: string; vehicleNumber: string }[];
};
type Vehicle = {
  id: string;
  vehicleNumber: string;
  vehicleType: string;
  capacity: string | number;
  capacityUnit: string;
  assignedDriverId: string | null;
  assignedDriver: { id: string; driverNumber: string; name: string; phone: string } | null;
  insuranceExpiry: string | null;
  fitnessExpiry: string | null;
  permitExpiry: string | null;
  pollutionExpiry: string | null;
  status: "AVAILABLE" | "ASSIGNED" | "UNDER_MAINTENANCE" | "INACTIVE";
  notes: string | null;
  _count: { loads: number };
  documentAttention: boolean;
};
type Metrics = {
  activeDrivers: number;
  activeVehicles: number;
  todayOrders: number;
  todaysRevenue: number;
  pendingOrders: number;
  outstandingPayments: number;
  deliveredToday: number;
};
type Load = {
  id: string;
  loadNumber: string;
  status: string;
  order: { orderNumber: string; customer: { name: string }; material: { name: string } };
  driver: { name: string };
  vehicle: { vehicleNumber: string };
};
type DriverFormData = {
  name: string;
  phone: string;
  alternatePhone: string;
  address: string;
  licenceNumber: string;
  licenceExpiry: string;
  joiningDate: string;
  salaryType: Driver["salaryType"];
  ratePerLoad: string;
  baseSalary: string;
  bankOrUpi: string;
  emergencyContact: string;
  notes: string;
  status: Driver["status"];
};
type VehicleFormData = {
  vehicleNumber: string;
  vehicleType: string;
  capacity: string;
  capacityUnit: string;
  assignedDriverId: string;
  insuranceExpiry: string;
  fitnessExpiry: string;
  permitExpiry: string;
  pollutionExpiry: string;
  status: Vehicle["status"];
  notes: string;
};
type Expense = {
  id: string;
  expenseNumber: string;
  date: string;
  category: string;
  amount: number;
  vehicleId: string | null;
  driverId: string | null;
  description: string;
  receiptUrl: string | null;
};
type ExpenseFormData = {
  date: string;
  category: string;
  amount: string;
  vehicleId: string;
  driverId: string;
  description: string;
};
type BillingOrder = {
  id: string;
  orderNumber: string;
  customer: string;
  material: string;
  siteLocation: string;
  quantity: number;
  unit: string;
  rate: number;
  totalAmount: number;
  amountPaid: number;
  paymentStatus: string;
  paymentMethod: string;
  loadCount: number;
  createdAt: string;
};
type OrderMaterial = { id: string; name: string; unit: string; rate: number };
type OrderRecord = {
  id: string;
  orderNumber: string;
  customer: { name: string; phone: string };
  material: string;
  quantity: number;
  unit: string;
  rate: number;
  totalAmount: number;
  amountPaid: number;
  paymentStatus: string;
  paymentMethod: string;
  status: string;
  deliveryLocation: string;
  deliveryDate: string | null;
  createdAt: string;
  loadCount: number;
};

const navItems = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "drivers", label: "Drivers", icon: Users },
  { id: "vehicles", label: "Vehicles", icon: Truck },
  { id: "expenses", label: "Expenses", icon: Box },
  { id: "billing", label: "Billing & payments", icon: CreditCard },
  { id: "reports", label: "Reports & salary", icon: Activity },
] as const;

const expenseCategories = ["Tyres", "Diesel", "Loading", "Others"];

const blankDriver: DriverFormData = {
  name: "",
  phone: "",
  alternatePhone: "",
  address: "",
  licenceNumber: "",
  licenceExpiry: "",
  joiningDate: "",
  salaryType: "PER_LOAD",
  ratePerLoad: "0",
  baseSalary: "0",
  bankOrUpi: "",
  emergencyContact: "",
  notes: "",
  status: "ACTIVE",
};

const blankVehicle: VehicleFormData = {
  vehicleNumber: "",
  vehicleType: "Tipper",
  capacity: "",
  capacityUnit: "Ton",
  assignedDriverId: "",
  insuranceExpiry: "",
  fitnessExpiry: "",
  permitExpiry: "",
  pollutionExpiry: "",
  status: "AVAILABLE",
  notes: "",
};

function currency(value: number | string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const result = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (response.status === 401) {
    if (url !== "/api/auth/me") window.dispatchEvent(new Event("session-expired"));
    throw new Error(result.error || "Please sign in again.");
  }
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function todayText() {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [section, setSection] = useState<(typeof navItems)[number]["id"]>("dashboard");
  const [loadingSession, setLoadingSession] = useState(true);
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    let mounted = true;
    api<{ user: User | null }>("/api/auth/me")
      .then(({ user: current }) => {
        if (mounted) setUser(current);
      })
      .catch((error: Error) => {
        if (mounted && error.message !== "Authentication required.") setLoginError(error.message);
      })
      .finally(() => {
        if (mounted) setLoadingSession(false);
      });
    const expire = () => {
      setUser(null);
      setLoginError("Your session ended. Sign in to continue.");
    };
    window.addEventListener("session-expired", expire);
    return () => {
      mounted = false;
      window.removeEventListener("session-expired", expire);
    };
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoginPending(true);
    setLoginError("");
    try {
      const result = await api<{ user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: String(form.get("email") || ""),
          password: String(form.get("password") || ""),
        }),
      });
      setUser(result.user);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setLoginPending(false);
    }
  }

  async function signOut() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
      setSection("dashboard");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to sign out.");
    }
  }

  if (loadingSession) {
    return (
      <main className="loading-screen">
        <div className="brand-mark"><Truck size={21} /></div>
        <span>Loading Maruthi Transport</span>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-art">
          <div className="login-art-inner">
            <div className="brand-lockup brand-lockup-light">
              <span className="brand-mark"><Truck size={21} /></span>
              <span><strong>MARUTHI</strong><small>TRANSPORT</small></span>
            </div>
            <div className="login-message">
              <span className="eyebrow">CONSTRUCTION MATERIAL SUPPLY</span>
              <h1>Every load,<br />right on track.</h1>
              <p>One place to manage your fleet, drivers and daily operations across Chennai.</p>
            </div>
            <div className="login-art-meta">
              <span><ShieldCheck size={15} /> Private &amp; secure workspace</span>
              <span>IN · CHENNAI</span>
            </div>
          </div>
        </section>
        <section className="login-panel">
          <div className="login-form-wrap">
            <span className="mobile-brand brand-lockup">
              <span className="brand-mark"><Truck size={19} /></span>
              <span><strong>MARUTHI</strong><small>TRANSPORT</small></span>
            </span>
            <p className="eyebrow">WELCOME BACK</p>
            <h2>Sign in to your account</h2>
            <p className="muted">Use your Maruthi Transport staff or driver account.</p>
            <form className="login-form" onSubmit={signIn}>
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" autoComplete="username" required placeholder="you@maruthitransport.in" />
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required placeholder="Enter your password" />
              {loginError && <div className="form-error"><CircleAlert size={16} />{loginError}</div>}
              <button className="button button-primary login-submit" type="submit" disabled={loginPending}>
                {loginPending ? "Signing in…" : "Sign in securely"}
              </button>
            </form>
            <p className="login-help">Need access? Ask your manager to create an account.</p>
          </div>
          <span className="login-copyright">© {new Date().getFullYear()} Maruthi Transport · In and around Chennai</span>
        </section>
      </main>
    );
  }

  if (user.role === "DRIVER") {
    return <DriverPortal user={user} onSignOut={signOut} />;
  }

  return (
    <AppShell
      user={user}
      section={section}
      onSectionChange={(next) => {
        setSection(next);
        setMobileNav(false);
      }}
      mobileNav={mobileNav}
      setMobileNav={setMobileNav}
      onSignOut={signOut}
      notice={notice}
      setNotice={setNotice}
    />
  );
}

function AppShell({
  user,
  section,
  onSectionChange,
  mobileNav,
  setMobileNav,
  onSignOut,
  notice,
  setNotice,
}: {
  user: User;
  section: (typeof navItems)[number]["id"];
  onSectionChange: (section: (typeof navItems)[number]["id"]) => void;
  mobileNav: boolean;
  setMobileNav: (open: boolean) => void;
  onSignOut: () => void;
  notice: string;
  setNotice: (message: string) => void;
}) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recentLoads, setRecentLoads] = useState<Load[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [orderMaterials, setOrderMaterials] = useState<OrderMaterial[]>([]);
  const [billing, setBilling] = useState<{
    summary: { totalRevenue: number; totalCollected: number; outstanding: number; paidOrders: number; pendingOrders: number };
    openOrders: { id: string; orderNumber: string; customer: string; material: string; totalAmount: number; amountPaid: number; paymentStatus: string; createdAt: string }[];
    recentOrders: BillingOrder[];
    recentPayments: { id: string; orderNumber: string; customer: string; amount: number; method: string; receivedAt: string; reference: string }[];
  } | null>(null);
  const [reports, setReports] = useState<{
    summary: { payrollThisMonth: number; monthlyRevenue: number; totalExpenses: number; paidSalaryPeriods: number };
    monthlyRevenue: { label: string; revenue: number }[];
    recentSalaryPeriods: { id: string; driverName: string; periodStart: string; periodEnd: string; netSalary: number; paidAt: string | null }[];
  } | null>(null);
  const [activeDrivers, setActiveDrivers] = useState<{ id: string; driverNumber: string; name: string }[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState("");
  const [dialog, setDialog] = useState<"driver" | "vehicle" | "driver-account" | null>(null);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [accountDriver, setAccountDriver] = useState<Driver | null>(null);
  const canManage = user.role === "SUPER_ADMIN" || user.role === "MANAGER";
  const activePage = navItems.find((item) => item.id === section);
  const visibleNavItems = canManage ? navItems : [navItems[0]];

  const loadDashboard = useCallback(async () => {
    const result = await api<{ metrics: Metrics; recentLoads: Load[] }>("/api/dashboard");
    setMetrics(result.metrics);
    setRecentLoads(result.recentLoads);
  }, []);

  const loadDrivers = useCallback(async () => {
    const result = await api<{ drivers: Driver[] }>("/api/drivers");
    setDrivers(result.drivers);
  }, []);

  const loadVehicles = useCallback(async () => {
    const result = await api<{
      vehicles: Vehicle[];
      drivers: { id: string; driverNumber: string; name: string }[];
    }>("/api/vehicles");
    setVehicles(result.vehicles);
    setActiveDrivers(result.drivers);
  }, []);

  const loadExpenses = useCallback(async () => {
    const result = await api<{ expenses: Expense[] }>("/api/expenses");
    setExpenses(result.expenses);
  }, []);

  const loadOrders = useCallback(async () => {
    const result = await api<{ orders: OrderRecord[]; materials: OrderMaterial[] }>("/api/orders");
    setOrders(result.orders);
    setOrderMaterials(result.materials);
  }, []);

  const loadBilling = useCallback(async () => {
    const result = await api<{
      summary: {
        totalRevenue: number;
        totalCollected: number;
        outstanding: number;
        paidOrders: number;
        pendingOrders: number;
      };
      openOrders: { id: string; orderNumber: string; customer: string; material: string; totalAmount: number; amountPaid: number; paymentStatus: string; createdAt: string }[];
      recentOrders: BillingOrder[];
      recentPayments: { id: string; orderNumber: string; customer: string; amount: number; method: string; receivedAt: string; reference: string }[];
    }>("/api/billing");
    setBilling(result);
  }, []);

  const loadReports = useCallback(async () => {
    const result = await api<{
      summary: { payrollThisMonth: number; monthlyRevenue: number; totalExpenses: number; paidSalaryPeriods: number };
      monthlyRevenue: { label: string; revenue: number }[];
      recentSalaryPeriods: { id: string; driverName: string; periodStart: string; periodEnd: string; netSalary: number; paidAt: string | null }[];
    }>("/api/reports");
    setReports(result);
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    setPageError("");
    try {
      if (section === "dashboard") await loadDashboard();
      if (section === "drivers") await loadDrivers();
      if (section === "vehicles") await loadVehicles();
      if (section === "expenses") await loadExpenses();
      if (section === "orders") await loadOrders();
      if (section === "billing") await loadBilling();
      if (section === "reports") await loadReports();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to load this section.");
    } finally {
      setBusy(false);
    }
  }, [loadBilling, loadDashboard, loadDrivers, loadExpenses, loadOrders, loadReports, loadVehicles, section]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  const filteredDrivers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return drivers;
    return drivers.filter((driver) =>
      [driver.name, driver.driverNumber, driver.phone, driver.licenceNumber]
        .some((field) => field.toLowerCase().includes(needle)),
    );
  }, [drivers, query]);

  const filteredVehicles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return vehicles;
    return vehicles.filter((vehicle) =>
      [vehicle.vehicleNumber, vehicle.vehicleType, vehicle.assignedDriver?.name || ""]
        .some((field) => field.toLowerCase().includes(needle)),
    );
  }, [vehicles, query]);

  async function archiveRecord(kind: "drivers" | "vehicles", id: string, label: string) {
    if (!window.confirm(`Archive ${label}? Historical loads and records will be retained.`)) return;
    try {
      await api(`/api/${kind}/${id}`, { method: "DELETE" });
      setNotice(`${kind === "drivers" ? "Driver" : "Vehicle"} archived. History is preserved.`);
      await refresh();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Unable to archive record.");
    }
  }

  async function saveDriver(data: DriverFormData) {
    try {
      await api(editingDriver ? `/api/drivers/${editingDriver.id}` : "/api/drivers", {
        method: editingDriver ? "PATCH" : "POST",
        body: JSON.stringify({
          ...data,
          alternatePhone: data.alternatePhone || null,
          licenceExpiry: data.licenceExpiry || null,
          joiningDate: data.joiningDate || null,
          ratePerLoad: Number(data.ratePerLoad),
          baseSalary: Number(data.baseSalary),
          bankOrUpi: data.bankOrUpi || null,
          emergencyContact: data.emergencyContact || null,
          address: data.address || null,
          notes: data.notes || null,
        }),
      });
      setNotice(editingDriver ? "Driver details updated." : "Driver added successfully.");
      setDialog(null);
      setEditingDriver(null);
      await loadDrivers();
    } catch (error) {
      throw error instanceof Error ? error : new Error("Unable to save driver.");
    }
  }

  async function saveVehicle(data: VehicleFormData) {
    try {
      await api(editingVehicle ? `/api/vehicles/${editingVehicle.id}` : "/api/vehicles", {
        method: editingVehicle ? "PATCH" : "POST",
        body: JSON.stringify({
          ...data,
          capacity: Number(data.capacity),
          assignedDriverId: data.assignedDriverId || null,
          insuranceExpiry: data.insuranceExpiry || null,
          fitnessExpiry: data.fitnessExpiry || null,
          permitExpiry: data.permitExpiry || null,
          pollutionExpiry: data.pollutionExpiry || null,
          notes: data.notes || null,
        }),
      });
      setNotice(editingVehicle ? "Vehicle details updated." : "Vehicle added successfully.");
      setDialog(null);
      setEditingVehicle(null);
      await loadVehicles();
    } catch (error) {
      throw error instanceof Error ? error : new Error("Unable to save vehicle.");
    }
  }

  function startDriverEdit(driver: Driver) {
    setEditingDriver(driver);
    setDialog("driver");
  }

  function startVehicleEdit(vehicle: Vehicle) {
    setEditingVehicle(vehicle);
    setDialog("vehicle");
  }

  const currentDate = todayText();

  return (
    <div className="app-layout">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-lockup sidebar-brand">
          <span className="brand-mark"><Truck size={21} /></span>
          <span><strong>MARUTHI</strong><small>TRANSPORT</small></span>
        </div>
        <div className="sidebar-business">
          <span className="business-dot" /> OPERATIONS
          <span className="sidebar-business-place">CHENNAI · TN</span>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <span className="nav-group-label">WORKSPACE</span>
          {visibleNavItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-link ${section === id ? "nav-link-active" : ""}`}
              onClick={() => onSectionChange(id)}
              type="button"
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {section === id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-note"><ShieldCheck size={15} /><span>Secure workspace</span><span className="secure-pulse" /></div>
          <button className="profile-card" onClick={onSignOut} type="button" title="Sign out">
            <span className="avatar">{initials(user.name)}</span>
            <span className="profile-details"><strong>{user.name}</strong><small>{roleLabel(user.role)}</small></span>
            <LogOut size={16} className="profile-logout" />
          </button>
        </div>
      </aside>

      {mobileNav && <button className="mobile-backdrop" aria-label="Close menu" onClick={() => setMobileNav(false)} />}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu button-icon" onClick={() => setMobileNav(true)} aria-label="Open menu" type="button"><Menu size={20} /></button>
            <div className="breadcrumb"><span>Maruthi Transport</span><span className="crumb-divider">/</span><strong>{section === "dashboard" ? "Overview" : activePage?.label}</strong></div>
          </div>
          <div className="topbar-right">
            <span className="topbar-date">{currentDate}</span>
            <button className="button-icon notification-button" title="Notifications" type="button" onClick={() => setNotice("You're all caught up. New alerts will appear here.")}>
              <Bell size={18} /><i />
            </button>
            <span className="topbar-avatar">{initials(user.name)}</span>
          </div>
        </header>

        <div className="content">
          {notice && <div className="toast"><Check size={16} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss" type="button"><X size={15} /></button></div>}
          {pageError && <div className="page-error"><CircleAlert size={17} /><span>{pageError}</span><button onClick={() => setPageError("")} type="button" aria-label="Dismiss error"><X size={16} /></button><button className="retry-button" onClick={() => void refresh()} type="button">Retry</button></div>}
          {section === "dashboard" && (
            <Dashboard
              user={user}
              metrics={metrics}
              recentLoads={recentLoads}
              busy={busy}
              onAddDriver={() => { setEditingDriver(null); setDialog("driver"); }}
              onAddVehicle={() => { setEditingVehicle(null); setDialog("vehicle"); }}
              onNavigate={onSectionChange}
              canManage={canManage}
            />
          )}
          {section === "orders" && canManage && (
            <OrdersSection
              orders={orders}
              materials={orderMaterials}
              busy={busy}
              onRefresh={loadOrders}
              onCreated={async (orderNumber, totalAmount) => {
                setNotice(`Order ${orderNumber} created for ${currency(totalAmount)}.`);
                try {
                  await loadOrders();
                } catch (error) {
                  setPageError(error instanceof Error ? error.message : "Order was created, but the list could not be refreshed.");
                }
              }}
            />
          )}
          {dialog === "driver-account" && canManage && accountDriver && (
            <DriverAccountDialog
              driver={accountDriver}
              onClose={() => { setDialog(null); setAccountDriver(null); }}
              onCreate={async (email, password) => {
                await api(`/api/drivers/${accountDriver.id}/account`, {
                  method: "POST",
                  body: JSON.stringify({ email, password }),
                });
                setNotice(`Driver login created for ${accountDriver.name}. Share the credentials securely.`);
                setDialog(null);
                setAccountDriver(null);
                await loadDrivers();
              }}
            />
          )}
          {section === "drivers" && (
            <section className="management-page">
              <div className="page-heading">
                <div><span className="eyebrow">YOUR PEOPLE, ON THE MOVE</span><h1>Drivers</h1><p>Manage driver profiles, licence details and salary rates.</p></div>
                {canManage && <button className="button button-primary" onClick={() => { setEditingDriver(null); setDialog("driver"); }} type="button"><Plus size={17} /> Add driver</button>}
              </div>
              <div className="list-toolbar">
                <div className="list-count"><strong>{drivers.length}</strong> drivers <span>·</span> {drivers.filter((driver) => driver.status === "ACTIVE").length} active</div>
                <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone or licence" /></label>
              </div>
              <div className="table-card">
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>DRIVER</th><th>CONTACT</th><th>LICENCE</th><th>SALARY TYPE</th><th>RATE / LOAD</th><th>VEHICLES</th><th>STATUS</th>{canManage && <th />}</tr></thead>
                    <tbody>
                      {filteredDrivers.map((driver) => (
                        <tr key={driver.id}>
                          <td><div className="table-person"><span className="table-avatar">{initials(driver.name)}</span><span><strong>{driver.name}</strong><small>{driver.driverNumber}</small></span></div></td>
                          <td><strong className="table-primary">{driver.phone}</strong><small className="table-sub">{driver.alternatePhone || "No alternate"}</small></td>
                          <td><strong className="table-primary">{driver.licenceNumber}</strong><small className="table-sub">Expires {dateLabel(driver.licenceExpiry)}</small></td>
                          <td><span className="salary-pill">{salaryLabel(driver.salaryType)}</span></td>
                          <td><strong className="table-primary">{currency(driver.ratePerLoad)}</strong></td>
                          <td><strong className="table-primary">{driver._count.assignedVehicles}</strong><small className="table-sub">{driver._count.loads} loads</small></td>
                          <td><StatusBadge status={driver.status} /></td>
                          {canManage && <td className="driver-actions-cell">
                            {!driver.userId && driver.status === "ACTIVE" && (
                              <button
                                className="button button-ghost account-setup-button"
                                onClick={() => { setAccountDriver(driver); setDialog("driver-account"); }}
                                type="button"
                              >
                                Set up login
                              </button>
                            )}
                            {driver.userId && <span className="login-linked">Login enabled</span>}
                            <RowActions onEdit={() => startDriverEdit(driver)} onArchive={() => void archiveRecord("drivers", driver.id, driver.name)} />
                          </td>}
                        </tr>
                      ))}
                      {filteredDrivers.length === 0 && <tr><td colSpan={canManage ? 8 : 7}><EmptyState icon="driver" title={query ? "No matching drivers" : "No drivers added yet"} detail={query ? "Try another name, phone or licence number." : "Add a driver to start managing your team."} action={canManage && !query ? <button className="button button-secondary" onClick={() => setDialog("driver")} type="button"><Plus size={16} /> Add first driver</button> : undefined} /></td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="table-footer"><span>Showing {filteredDrivers.length} of {drivers.length} records</span><span><ShieldCheck size={14} /> Driver pay details are restricted by role</span></div>
              </div>
            </section>
          )}
          {section === "vehicles" && (
            <section className="management-page">
              <div className="page-heading">
                <div><span className="eyebrow">FLEET AT A GLANCE</span><h1>Vehicles</h1><p>Keep assignments, capacity and document dates up to date.</p></div>
                {canManage && <button className="button button-primary" onClick={() => { setEditingVehicle(null); setDialog("vehicle"); }} type="button"><Plus size={17} /> Add vehicle</button>}
              </div>
              <div className="list-toolbar">
                <div className="list-count"><strong>{vehicles.length}</strong> vehicles <span>·</span> {vehicles.filter((vehicle) => vehicle.status === "AVAILABLE" || vehicle.status === "ASSIGNED").length} in service</div>
                <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search vehicle or driver" /></label>
              </div>
              <div className="table-card">
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>VEHICLE</th><th>TYPE &amp; CAPACITY</th><th>ASSIGNED DRIVER</th><th>DOCUMENTS</th><th>COMPLETED LOADS</th><th>STATUS</th>{canManage && <th />}</tr></thead>
                    <tbody>
                      {filteredVehicles.map((vehicle) => (
                        <tr key={vehicle.id}>
                          <td><div className="table-person"><span className="vehicle-table-icon"><Truck size={18} /></span><span><strong>{vehicle.vehicleNumber}</strong><small>Fleet vehicle</small></span></div></td>
                          <td><strong className="table-primary">{vehicle.vehicleType}</strong><small className="table-sub">{vehicle.capacity} {vehicle.capacityUnit}</small></td>
                          <td>{vehicle.assignedDriver ? <div><strong className="table-primary">{vehicle.assignedDriver.name}</strong><small className="table-sub">{vehicle.assignedDriver.phone}</small></div> : <span className="muted">Not assigned</span>}</td>
                          <td><DocumentStatus vehicle={vehicle} /></td>
                          <td><strong className="table-primary">{vehicle._count.loads}</strong><small className="table-sub">total loads</small></td>
                          <td><StatusBadge status={vehicle.status} /></td>
                          {canManage && <td><RowActions onEdit={() => startVehicleEdit(vehicle)} onArchive={() => void archiveRecord("vehicles", vehicle.id, vehicle.vehicleNumber)} /></td>}
                        </tr>
                      ))}
                      {filteredVehicles.length === 0 && <tr><td colSpan={canManage ? 7 : 6}><EmptyState icon="vehicle" title={query ? "No matching vehicles" : "No vehicles registered yet"} detail={query ? "Try another registration or driver name." : "Add a vehicle to start building your fleet."} action={canManage && !query ? <button className="button button-secondary" onClick={() => setDialog("vehicle")} type="button"><Plus size={16} /> Add first vehicle</button> : undefined} /></td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="table-footer"><span>Showing {filteredVehicles.length} of {vehicles.length} records</span><span><ShieldCheck size={14} /> Vehicle assignments are logged</span></div>
              </div>
            </section>
          )}
          {section === "expenses" && <ExpensesSection expenses={expenses} activeDrivers={activeDrivers} vehicles={vehicles} busy={busy} onReload={refresh} canManage={canManage} />}
          {section === "billing" && <BillingSection billing={billing} busy={busy} />}
          {section === "reports" && <ReportsSection reports={reports} busy={busy} />}
        </div>
      </main>

      {dialog === "driver" && canManage && (
        <DriverDialog
          initial={editingDriver ? driverToForm(editingDriver) : blankDriver}
          editing={Boolean(editingDriver)}
          onClose={() => { setDialog(null); setEditingDriver(null); }}
          onSave={saveDriver}
        />
      )}
      {dialog === "vehicle" && canManage && (
        <VehicleDialog
          initial={editingVehicle ? vehicleToForm(editingVehicle) : blankVehicle}
          editing={Boolean(editingVehicle)}
          drivers={activeDrivers}
          onClose={() => { setDialog(null); setEditingVehicle(null); }}
          onSave={saveVehicle}
        />
      )}
    </div>
  );
}

type DriverLoad = {
  id: string;
  loadNumber: string;
  status: "ASSIGNED" | "ACCEPTED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
  quantity: string | number;
  deliveryDate: string | null;
  driverNotes: string | null;
  order: {
    orderNumber: string;
    deliveryLocation: string;
    deliveryDate: string | null;
    material: { name: string };
    customer: { name: string; phone: string };
  };
  vehicle: { vehicleNumber: string; vehicleType: string };
};

function DriverPortal({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [driver, setDriver] = useState<{
    driverNumber: string;
    name: string;
    assignedVehicles: { vehicleNumber: string; vehicleType: string }[];
  } | null>(null);
  const [loads, setLoads] = useState<DriverLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyLoad, setBusyLoad] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<{
        driver: NonNullable<typeof driver>;
        loads: DriverLoad[];
      }>("/api/driver/loads");
      setDriver(result.driver);
      setLoads(result.loads);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load your deliveries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  async function advanceLoad(load: DriverLoad) {
    const nextStatus = nextLoadStatus(load.status);
    if (!nextStatus) return;
    setBusyLoad(load.id);
    setError("");
    setNotice("");
    try {
      await api(`/api/driver/loads/${load.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setNotice(`Delivery ${load.loadNumber} updated to ${loadStatusLabel(nextStatus)}.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update this delivery.");
    } finally {
      setBusyLoad("");
    }
  }

  const activeLoads = loads.filter((load) => load.status !== "DELIVERED" && load.status !== "CANCELLED");
  const completedLoads = loads.filter((load) => load.status === "DELIVERED").length;

  return (
    <main className="driver-portal">
      <header className="driver-topbar">
        <Link className="brand-lockup" href="/" aria-label="Maruthi Transport">
          <span className="brand-mark"><Truck size={21} /></span>
          <span><strong>MARUTHI</strong><small>TRANSPORT</small></span>
        </Link>
        <div className="driver-user-menu">
          <span className="topbar-avatar">{initials(user.name)}</span>
          <span><strong>{user.name}</strong><small>Driver portal</small></span>
          <button className="button button-secondary" onClick={onSignOut} type="button"><LogOut size={15} /> Sign out</button>
        </div>
      </header>

      <div className="driver-content">
        <section className="driver-welcome">
          <div>
            <span className="eyebrow">YOUR DELIVERY WORKSPACE</span>
            <h1>Good day, {driver?.name || user.name}</h1>
            <p>View your assigned deliveries and update their progress as you go.</p>
          </div>
          <button className="button button-secondary" onClick={() => void refresh()} disabled={loading} type="button">
            <RefreshCw size={16} /> Refresh
          </button>
        </section>

        {error && <div className="page-error"><CircleAlert size={17} /><span>{error}</span><button className="retry-button" onClick={() => void refresh()} type="button">Retry</button></div>}
        {notice && <div className="toast"><Check size={16} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss" type="button"><X size={15} /></button></div>}

        <section className="driver-summary">
          <article className="driver-summary-card"><span>ACTIVE DELIVERIES</span><strong>{loading ? "—" : activeLoads.length}</strong><small>Assigned to you</small></article>
          <article className="driver-summary-card"><span>COMPLETED</span><strong>{loading ? "—" : completedLoads}</strong><small>In the recent list</small></article>
          <article className="driver-summary-card"><span>YOUR VEHICLE</span><strong>{driver?.assignedVehicles[0]?.vehicleNumber || "Not assigned"}</strong><small>{driver?.assignedVehicles[0]?.vehicleType || "Contact your manager"}</small></article>
        </section>

        <section className="driver-loads-section">
          <div className="driver-section-heading">
            <div><span className="eyebrow">ON THE ROAD</span><h2>Your deliveries</h2></div>
            {driver && <span className="driver-number">{driver.driverNumber}</span>}
          </div>
          {loading && <div className="driver-empty">Loading your deliveries…</div>}
          {!loading && loads.length === 0 && (
            <div className="driver-empty"><Truck size={24} /><strong>No deliveries assigned</strong><span>New assignments from your manager will appear here.</span></div>
          )}
          {!loading && loads.length > 0 && (
            <div className="driver-load-list">
              {loads.map((load) => {
                const nextStatus = nextLoadStatus(load.status);
                return (
                  <article className="driver-load-card" key={load.id}>
                    <div className="driver-load-card-top">
                      <div><span className="driver-load-label">LOAD {load.loadNumber}</span><h3>{load.order.material.name}</h3></div>
                      <StatusBadge status={load.status} />
                    </div>
                    <div className="driver-load-details">
                      <span><strong>Order</strong>{load.order.orderNumber}</span>
                      <span><strong>Quantity</strong>{load.quantity} loads</span>
                      <span><strong>Vehicle</strong>{load.vehicle.vehicleNumber} · {load.vehicle.vehicleType}</span>
                      <span><strong>Scheduled</strong>{dateLabel(load.deliveryDate || load.order.deliveryDate)}</span>
                    </div>
                    <div className="driver-delivery-destination">
                      <MapPin size={17} />
                      <span><strong>{load.order.customer.name}</strong><small>{load.order.deliveryLocation}</small></span>
                      <a href={`tel:${load.order.customer.phone}`} aria-label={`Call ${load.order.customer.name}`}><Phone size={16} /> Call</a>
                    </div>
                    {load.driverNotes && <p className="driver-instructions">{load.driverNotes}</p>}
                    {nextStatus && (
                      <button
                        className="button button-primary driver-status-button"
                        onClick={() => void advanceLoad(load)}
                        disabled={busyLoad === load.id}
                        type="button"
                      >
                        {busyLoad === load.id ? "Updating…" : nextStatus === "DELIVERED" ? "Mark delivered" : nextStatus === "IN_TRANSIT" ? "Start delivery" : "Accept delivery"}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          {!loading && loads.length === 50 && <p className="driver-history-note">Showing your 50 most recent deliveries.</p>}
        </section>
      </div>
    </main>
  );
}

function loadStatusLabel(status: DriverLoad["status"]) {
  return status.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function nextLoadStatus(status: DriverLoad["status"]): "ACCEPTED" | "IN_TRANSIT" | "DELIVERED" | null {
  if (status === "ASSIGNED") return "ACCEPTED";
  if (status === "ACCEPTED") return "IN_TRANSIT";
  if (status === "IN_TRANSIT") return "DELIVERED";
  return null;
}

function roleLabel(role: Role) {
  return ({
    SUPER_ADMIN: "Super admin",
    MANAGER: "Manager",
    BILLING_STAFF: "Billing staff",
    STAFF: "Staff",
    DRIVER: "Driver",
  })[role];
}

function ExpensesSection({ expenses, activeDrivers, vehicles, busy, onReload, canManage }: { expenses: Expense[]; activeDrivers: { id: string; driverNumber: string; name: string }[]; vehicles: Vehicle[]; busy: boolean; onReload: () => void; canManage: boolean; }) {
  const [form, setForm] = useState<ExpenseFormData>({
    date: new Date().toISOString().slice(0, 10),
    category: "Tyres",
    amount: "0",
    vehicleId: "",
    driverId: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          vehicleId: form.vehicleId || null,
          driverId: form.driverId || null,
          description: form.description || "General expense",
        }),
      });
      setForm({ date: new Date().toISOString().slice(0, 10), category: "Tyres", amount: "0", vehicleId: "", driverId: "", description: "" });
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save expense.");
    } finally {
      setSaving(false);
    }
  }

  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  return (
    <section className="management-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">OPERATIONS COSTS</span>
          <h1>Expenses</h1>
          <p>Track tyre, diesel, loading and other daily operating costs.</p>
        </div>
      </div>
      <div className="metric-grid">
        <article className="metric-card">
          <div className="metric-top"><span className="metric-icon metric-orange"><Box size={17} strokeWidth={1.9} /></span><span className="metric-period">TOTAL</span></div>
          <div className="metric-value">{busy ? <span className="skeleton skeleton-value" /> : currency(totalExpenses)}</div>
          <div className="metric-label">Recorded expenses</div>
          <div className="metric-note"><span>All categories</span><ArrowUpRight size={14} /></div>
        </article>
      </div>

      {canManage && (
        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">NEW EXPENSE</span><h2>Add an expense</h2></div></div>
          <form className="expense-form" onSubmit={submitExpense}>
            <div className="field-grid">
              <label>
                <span>Date</span>
                <input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} required />
              </label>
              <label>
                <span>Category</span>
                <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                  {expenseCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Amount (₹)</span>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required />
              </label>
              <label>
                <span>Vehicle</span>
                <select value={form.vehicleId} onChange={(event) => setForm((current) => ({ ...current, vehicleId: event.target.value }))}>
                  <option value="">No vehicle</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicleNumber}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Driver</span>
                <select value={form.driverId} onChange={(event) => setForm((current) => ({ ...current, driverId: event.target.value }))}>
                  <option value="">No driver</option>
                  {activeDrivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>{driver.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span>Description</span>
              <textarea rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Example: New set of tyres for tipper truck" />
            </label>
            {error && <div className="form-error"><CircleAlert size={16} />{error}</div>}
            <div className="form-actions">
              <button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save expense"}</button>
            </div>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">RECENT COSTS</span><h2>Expense log</h2></div></div>
        {expenses.length > 0 ? (
          <div className="recent-loads">
            {expenses.map((expense) => (
              <div className="recent-load" key={expense.id}>
                <span className="pulse-icon pulse-orange"><Box size={15} /></span>
                <span className="recent-load-main"><strong>{expense.category}</strong><small>{expense.description}</small></span>
                <span className="recent-load-driver"><strong>{currency(expense.amount)}</strong><small>{dateLabel(expense.date)}</small></span>
                <span className="status-badge status-paid"><i />{expense.category}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="activity-empty"><span className="activity-empty-icon"><Box size={21} /></span><strong>No expenses logged</strong><span>Add your first tyre, diesel or loading expense.</span></div>
        )}
      </section>
    </section>
  );
}

function OrdersSection({
  orders,
  materials,
  busy,
  onRefresh,
  onCreated,
}: {
  orders: OrderRecord[];
  materials: OrderMaterial[];
  busy: boolean;
  onRefresh: () => Promise<void>;
  onCreated: (orderNumber: string, totalAmount: number) => Promise<void>;
}) {
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    deliveryLocation: "",
    materialId: "",
    quantity: "1",
    rate: "0",
    deliveryCharge: "0",
    otherCharges: "0",
    discount: "0",
    amountPaid: "0",
    paymentMethod: "CREDIT",
    deliveryDate: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedMaterial = materials.find((material) => material.id === form.materialId);
  const quantity = Number(form.quantity) || 0;
  const rate = Number(form.rate) || 0;
  const totalAmount = Math.max(
    0,
    Math.round(
      (quantity * rate + (Number(form.deliveryCharge) || 0) +
        (Number(form.otherCharges) || 0) - (Number(form.discount) || 0)) * 100,
    ) / 100,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await api<{ order: { orderNumber: string; totalAmount: number } }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
          rate: Number(form.rate),
          deliveryCharge: Number(form.deliveryCharge),
          otherCharges: Number(form.otherCharges),
          discount: Number(form.discount),
          amountPaid: Number(form.amountPaid),
          deliveryDate: form.deliveryDate || null,
          notes: form.notes || null,
        }),
      });
      setForm({
        customerName: "",
        customerPhone: "",
        deliveryLocation: "",
        materialId: "",
        quantity: "1",
        rate: "0",
        deliveryCharge: "0",
        otherCharges: "0",
        discount: "0",
        amountPaid: "0",
        paymentMethod: "CREDIT",
        deliveryDate: "",
        notes: "",
      });
      await onCreated(result.order.orderNumber, result.order.totalAmount);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create the order.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshList() {
    setError("");
    try {
      await onRefresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to refresh orders.");
    }
  }

  return (
    <section className="management-page">
      <div className="page-heading">
        <div><span className="eyebrow">CUSTOMER SALES</span><h1>Orders</h1><p>Create customer orders and track delivery and payment status.</p></div>
      </div>
      <section className="panel order-entry-panel">
        <div className="panel-heading"><div><span className="eyebrow">NEW CUSTOMER ORDER</span><h2>Order details</h2></div></div>
        {materials.length === 0 && !busy && <div className="form-error order-form-message"><CircleAlert size={16} />No active materials found. Add or activate materials before creating orders.</div>}
        <form className="order-form" onSubmit={submit}>
          <div className="order-form-grid">
            <FormField label="Customer name" required>
              <input value={form.customerName} onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))} required minLength={2} maxLength={100} placeholder="Customer name" />
            </FormField>
            <FormField label="Customer phone" required>
              <input type="tel" value={form.customerPhone} onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))} required maxLength={20} placeholder="+91 98765 43210" />
            </FormField>
            <FormField label="Site / delivery location" required wide>
              <input value={form.deliveryLocation} onChange={(event) => setForm((current) => ({ ...current, deliveryLocation: event.target.value }))} required minLength={3} maxLength={500} placeholder="Delivery address or site name" />
            </FormField>
            <FormField label="Material / service" required>
              <select
                value={form.materialId}
                onChange={(event) => {
                  const material = materials.find((item) => item.id === event.target.value);
                  setForm((current) => ({
                    ...current,
                    materialId: event.target.value,
                    rate: material ? String(material.rate) : "0",
                  }));
                }}
                required
              >
                <option value="">Choose a material</option>
                {materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
              </select>
            </FormField>
            <FormField label={`Quantity (${selectedMaterial?.unit || "unit"})`} required>
              <input type="number" min="0.01" step="0.01" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} required />
            </FormField>
            <FormField label={`Rate per ${selectedMaterial?.unit || "unit"} (₹)`} required>
              <input type="number" min="0" step="0.01" value={form.rate} onChange={(event) => setForm((current) => ({ ...current, rate: event.target.value }))} required />
            </FormField>
            <FormField label="Delivery charge (₹)">
              <input type="number" min="0" step="0.01" value={form.deliveryCharge} onChange={(event) => setForm((current) => ({ ...current, deliveryCharge: event.target.value }))} />
            </FormField>
            <FormField label="Other charges (₹)">
              <input type="number" min="0" step="0.01" value={form.otherCharges} onChange={(event) => setForm((current) => ({ ...current, otherCharges: event.target.value }))} />
            </FormField>
            <FormField label="Discount (₹)">
              <input type="number" min="0" step="0.01" value={form.discount} onChange={(event) => setForm((current) => ({ ...current, discount: event.target.value }))} />
            </FormField>
            <FormField label="Amount received now (₹)">
              <input type="number" min="0" step="0.01" max={totalAmount} value={form.amountPaid} onChange={(event) => setForm((current) => ({ ...current, amountPaid: event.target.value }))} />
            </FormField>
            <FormField label="Payment method" required>
              <select value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}>
                <option value="CREDIT">Credit / unpaid</option>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
              </select>
            </FormField>
            <FormField label="Delivery date">
              <input type="date" value={form.deliveryDate} onChange={(event) => setForm((current) => ({ ...current, deliveryDate: event.target.value }))} />
            </FormField>
            <FormField label="Order notes" wide>
              <textarea rows={2} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} maxLength={1000} placeholder="Optional instructions" />
            </FormField>
          </div>
          <div className="order-form-footer">
            <div><span>Order total</span><strong>{currency(totalAmount)}</strong></div>
            <button className="button button-primary" type="submit" disabled={saving || busy || materials.length === 0 || totalAmount <= 0 || Number(form.amountPaid) > totalAmount}>
              {saving ? "Saving order…" : <><Plus size={16} /> Create order</>}
            </button>
          </div>
          {error && <div className="form-error order-form-message"><CircleAlert size={16} />{error}</div>}
        </form>
      </section>

      <section className="management-page order-list-section">
        <div className="list-toolbar">
          <div><span className="eyebrow">RECENT ORDERS</span><div className="list-count"><strong>{orders.length}</strong> {orders.length === 1 ? "order" : "orders"} shown</div></div>
          <button className="button button-secondary" onClick={() => void refreshList()} disabled={busy} type="button"><RefreshCw size={15} /> Refresh list</button>
        </div>
        <div className="table-card">
          <div className="table-scroll">
            <table>
              <thead><tr><th>ORDER / DATE</th><th>CUSTOMER</th><th>SITE</th><th>MATERIAL</th><th>QTY</th><th>TOTAL</th><th>PAID</th><th>PAYMENT</th><th>ORDER STATUS</th><th>LOADS</th></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td><strong className="table-primary">{order.orderNumber}</strong><small className="table-sub">{dateLabel(order.createdAt)}</small></td>
                    <td><strong className="table-primary">{order.customer.name}</strong><small className="table-sub">{order.customer.phone}</small></td>
                    <td className="order-site-cell">{order.deliveryLocation}</td>
                    <td>{order.material}</td>
                    <td>{order.quantity} {order.unit}</td>
                    <td><strong className="table-primary">{currency(order.totalAmount)}</strong></td>
                    <td>{currency(order.amountPaid)}</td>
                    <td><StatusBadge status={order.paymentStatus} /><small className="table-sub">{order.paymentMethod.replaceAll("_", " ")}</small></td>
                    <td><StatusBadge status={order.status} /></td>
                    <td>{order.loadCount}</td>
                  </tr>
                ))}
                {!busy && orders.length === 0 && <tr><td colSpan={10}><div className="activity-empty"><span className="activity-empty-icon"><ClipboardList size={21} /></span><strong>No orders yet</strong><span>Create your first order using the form above.</span></div></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="table-footer"><span>Showing the latest {orders.length} orders (up to 50)</span><span><ShieldCheck size={14} /> Order and payment details are restricted to managers</span></div>
        </div>
      </section>
    </section>
  );
}

function BillingSection({ billing, busy }: { billing: { summary: { totalRevenue: number; totalCollected: number; outstanding: number; paidOrders: number; pendingOrders: number }; openOrders: { id: string; orderNumber: string; customer: string; material: string; totalAmount: number; amountPaid: number; paymentStatus: string; createdAt: string }[]; recentOrders: BillingOrder[]; recentPayments: { id: string; orderNumber: string; customer: string; amount: number; method: string; receivedAt: string; reference: string }[] } | null; busy: boolean; }) {
  const cards = [
    { label: "Total revenue", value: billing ? currency(billing.summary.totalRevenue) : "—", icon: CreditCard, accent: "green", note: "All invoices" },
    { label: "Collected", value: billing ? currency(billing.summary.totalCollected) : "—", icon: Check, accent: "blue", note: "Payments received" },
    { label: "Outstanding", value: billing ? currency(billing.summary.outstanding) : "—", icon: ArrowDownRight, accent: "amber", note: "Open balance" },
    { label: "Paid orders", value: billing ? String(billing.summary.paidOrders) : "—", icon: ShieldCheck, accent: "orange", note: "Closed invoices" },
  ];

  return (
    <section className="management-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">FINANCE TRACKER</span>
          <h1>Billing &amp; payments</h1>
          <p>Track collections, receivables and recent settlements across the week.</p>
        </div>
      </div>
      <div className="metric-grid">
        {cards.map(({ label, value, icon: Icon, accent, note }) => (
          <article className="metric-card" key={label}>
            <div className="metric-top"><span className={`metric-icon metric-${accent}`}><Icon size={17} strokeWidth={1.9} /></span><span className="metric-period">LIVE</span></div>
            <div className="metric-value">{busy ? <span className="skeleton skeleton-value" /> : value}</div>
            <div className="metric-label">{label}</div>
            <div className="metric-note"><span>{note}</span><ArrowUpRight size={14} /></div>
          </article>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">COLLECTIONS</span><h2>Recent payments</h2></div></div>
          <div className="recent-loads">
            {billing?.recentPayments && billing.recentPayments.length > 0 ? (
              billing.recentPayments.map((payment) => (
                <div className="recent-load" key={payment.id}>
                  <span className="pulse-icon pulse-green"><Check size={15} /></span>
                  <span className="recent-load-main"><strong>{payment.customer}</strong><small>{payment.orderNumber} · {payment.method}</small></span>
                  <span className="recent-load-driver"><strong>{currency(payment.amount)}</strong><small>{dateLabel(payment.receivedAt)}</small></span>
                  <span className="status-badge status-paid"><i />Paid</span>
                </div>
              ))
            ) : (
              <div className="activity-empty"><span className="activity-empty-icon"><CreditCard size={21} /></span><strong>No recent payments</strong><span>Customer settlements will show up here.</span></div>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">CUSTOMER ORDERS</span><h2>Order details</h2></div></div>
          <div className="customer-order-list">
            {billing?.recentOrders && billing.recentOrders.length > 0 ? (
              billing.recentOrders.map((order) => (
                <article className="customer-order-card" key={order.id}>
                  <div className="customer-order-heading">
                    <div><span>{order.orderNumber} · {dateLabel(order.createdAt)}</span><h3>{order.customer}</h3></div>
                    <StatusBadge status={order.paymentStatus} />
                  </div>
                  <p className="customer-order-site"><MapPin size={14} />{order.siteLocation}</p>
                  <div className="customer-order-facts">
                    <span><small>Material</small><strong>{order.material}</strong></span>
                    <span><small>Quantity / loads</small><strong>{order.quantity} {order.unit} · {order.loadCount} {order.loadCount === 1 ? "load" : "loads"}</strong></span>
                    <span><small>Rate / {order.unit}</small><strong>{currency(order.rate)}</strong></span>
                    <span><small>Total amount</small><strong>{currency(order.totalAmount)}</strong></span>
                    <span><small>Payment method</small><strong>{order.paymentMethod.replaceAll("_", " ")}</strong></span>
                    <span><small>Balance due</small><strong>{currency(Math.max(0, order.totalAmount - order.amountPaid))}</strong></span>
                  </div>
                </article>
              ))
            ) : (
              <div className="activity-empty"><span className="activity-empty-icon"><ShieldCheck size={21} /></span><strong>No customer orders yet</strong><span>Customer order details will appear here.</span></div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function ReportsSection({ reports, busy }: { reports: { summary: { payrollThisMonth: number; monthlyRevenue: number; totalExpenses: number; paidSalaryPeriods: number }; monthlyRevenue: { label: string; revenue: number }[]; recentSalaryPeriods: { id: string; driverName: string; periodStart: string; periodEnd: string; netSalary: number; paidAt: string | null }[] } | null; busy: boolean; }) {
  const cards = [
    { label: "Payroll this month", value: reports ? currency(reports.summary.payrollThisMonth) : "—", icon: Activity, accent: "blue", note: "Salary payouts" },
    { label: "Monthly revenue", value: reports ? currency(reports.summary.monthlyRevenue) : "—", icon: ArrowUpRight, accent: "green", note: "Current month" },
    { label: "Expenses", value: reports ? currency(reports.summary.totalExpenses) : "—", icon: Box, accent: "amber", note: "Running costs" },
    { label: "Salary periods", value: reports ? String(reports.summary.paidSalaryPeriods) : "—", icon: Check, accent: "orange", note: "Settled cycles" },
  ];

  return (
    <section className="management-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">OPERATIONS REPORT</span>
          <h1>Reports &amp; salary</h1>
          <p>Review monthly revenue, expenses and driver payroll performance.</p>
        </div>
      </div>
      <div className="metric-grid">
        {cards.map(({ label, value, icon: Icon, accent, note }) => (
          <article className="metric-card" key={label}>
            <div className="metric-top"><span className={`metric-icon metric-${accent}`}><Icon size={17} strokeWidth={1.9} /></span><span className="metric-period">MONTHLY</span></div>
            <div className="metric-value">{busy ? <span className="skeleton skeleton-value" /> : value}</div>
            <div className="metric-label">{label}</div>
            <div className="metric-note"><span>{note}</span><ArrowUpRight size={14} /></div>
          </article>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">REVENUE</span><h2>Last 6 months</h2></div></div>
          <div className="recent-loads">
            {reports?.monthlyRevenue && reports.monthlyRevenue.length > 0 ? (
              reports.monthlyRevenue.map((entry) => (
                <div className="recent-load" key={entry.label}>
                  <span className="pulse-icon pulse-indigo"><Activity size={15} /></span>
                  <span className="recent-load-main"><strong>{entry.label}</strong><small>Gross revenue</small></span>
                  <span className="recent-load-driver"><strong>{currency(entry.revenue)}</strong><small>Orders booked</small></span>
                </div>
              ))
            ) : (
              <div className="activity-empty"><span className="activity-empty-icon"><Activity size={21} /></span><strong>No data yet</strong><span>Financial reports will appear after orders are created.</span></div>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">PAYROLL</span><h2>Salary periods</h2></div></div>
          <div className="recent-loads">
            {reports?.recentSalaryPeriods && reports.recentSalaryPeriods.length > 0 ? (
              reports.recentSalaryPeriods.map((item) => (
                <div className="recent-load" key={item.id}>
                  <span className="pulse-icon pulse-orange"><Users size={15} /></span>
                  <span className="recent-load-main"><strong>{item.driverName}</strong><small>{dateLabel(item.periodStart)} – {dateLabel(item.periodEnd)}</small></span>
                  <span className="recent-load-driver"><strong>{currency(item.netSalary)}</strong><small>{item.paidAt ? "Paid" : "Pending"}</small></span>
                  {item.paidAt ? <span className="status-badge status-paid"><i />Paid</span> : <StatusBadge status="PENDING" />}
                </div>
              ))
            ) : (
              <div className="activity-empty"><span className="activity-empty-icon"><Users size={21} /></span><strong>No salary periods</strong><span>Driver salary cycles will appear here.</span></div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function Dashboard({
  user,
  metrics,
  recentLoads,
  busy,
  onAddDriver,
  onAddVehicle,
  onNavigate,
  canManage,
}: {
  user: User;
  metrics: Metrics | null;
  recentLoads: Load[];
  busy: boolean;
  onAddDriver: () => void;
  onAddVehicle: () => void;
  onNavigate: (section: (typeof navItems)[number]["id"]) => void;
  canManage: boolean;
}) {
  const cards = [
    { label: "Orders today", value: metrics?.todayOrders ?? "—", icon: Box, accent: "blue", note: "Orders created today" },
    { label: "Revenue today", value: metrics ? currency(metrics.todaysRevenue) : "—", icon: CreditCard, accent: "green", note: "Order value today" },
    { label: "Pending orders", value: metrics?.pendingOrders ?? "—", icon: Clock3, accent: "amber", note: "Awaiting delivery" },
    { label: "Outstanding", value: metrics ? currency(metrics.outstandingPayments) : "—", icon: CircleAlert, accent: "rose", note: "Payments to collect" },
  ];

  return (
    <section className="dashboard-page">
      <div className="welcome-row">
        <div><span className="eyebrow">{todayText().toUpperCase()}</span><h1>{greeting()}, {user.name.split(" ")[0]} <span className="wave">✦</span></h1><p>Here&apos;s your business at a glance. Let&apos;s keep every load moving.</p></div>
        <div className="welcome-indicator"><span className="live-dot" /> OPERATIONS LIVE <span className="welcome-indicator-divider" /> {todayText()}</div>
      </div>
      <div className="quick-actions">
        <span className="quick-label">QUICK ACTIONS</span>
        {canManage && <><button className="quick-action quick-action-primary" onClick={onAddDriver} type="button"><Plus size={16} /> Add driver</button>
        <button className="quick-action" onClick={onAddVehicle} type="button"><Truck size={16} /> Add vehicle</button>
        <button className="quick-action" onClick={() => onNavigate("drivers")} type="button"><Users size={16} /> View team</button></>}
        {!canManage && <span className="quick-label">Your workspace is ready</span>}
      </div>
      <div className="metric-grid">
        {cards.map(({ label, value, icon: Icon, accent, note }) => (
          <article className="metric-card" key={label}>
            <div className="metric-top"><span className={`metric-icon metric-${accent}`}><Icon size={17} strokeWidth={1.9} /></span><span className="metric-period">TODAY</span></div>
            <div className="metric-value">{busy ? <span className="skeleton skeleton-value" /> : value}</div>
            <div className="metric-label">{label}</div>
            <div className="metric-note"><span>{note}</span>{label === "Revenue today" ? <ArrowUpRight size={14} /> : label === "Outstanding" ? <ArrowDownRight size={14} /> : <span className="metric-dash" />}</div>
          </article>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="panel fleet-panel">
          <div className="panel-heading"><div><span className="eyebrow">YOUR PEOPLE &amp; FLEET</span><h2>Operations pulse</h2></div><span className="panel-time"><Activity size={14} /> Live</span></div>
          <div className="pulse-grid">
            <button className="pulse-tile" onClick={() => canManage && onNavigate("drivers")} disabled={!canManage} type="button">
              <span className="pulse-icon pulse-indigo"><Users size={18} /></span><span className="pulse-copy"><strong>{metrics?.activeDrivers ?? "—"}</strong><small>Active drivers</small></span><ChevronDown size={16} className="pulse-arrow" />
            </button>
            <button className="pulse-tile" onClick={() => canManage && onNavigate("vehicles")} disabled={!canManage} type="button">
              <span className="pulse-icon pulse-orange"><Truck size={18} /></span><span className="pulse-copy"><strong>{metrics?.activeVehicles ?? "—"}</strong><small>Vehicles in service</small></span><ChevronDown size={16} className="pulse-arrow" />
            </button>
            <div className="pulse-tile pulse-static">
              <span className="pulse-icon pulse-green"><Check size={18} /></span><span className="pulse-copy"><strong>{metrics?.deliveredToday ?? "—"}</strong><small>Deliveries completed</small></span>
            </div>
          </div>
          <div className="fleet-footnote"><span className="mini-check"><Check size={12} /></span> Fleet status is up to date <span className="footnote-divider" /> Chennai, Tamil Nadu</div>
        </section>
        <section className="panel focus-panel">
          <div className="panel-heading"><div><span className="eyebrow">TODAY&apos;S FOCUS</span><h2>Keep things moving</h2></div><span className="focus-icon"><Gauge size={18} /></span></div>
          <div className="focus-row"><span className="focus-number">01</span><span className="focus-text"><strong>Confirm pending orders</strong><small>{metrics?.pendingOrders ?? "—"} orders need attention</small></span><span className="focus-check"><ArrowUpRight size={15} /></span></div>
          <div className="focus-row"><span className="focus-number">02</span><span className="focus-text"><strong>Follow up on collections</strong><small>{metrics ? currency(metrics.outstandingPayments) : "—"} outstanding</small></span><span className="focus-check"><ArrowUpRight size={15} /></span></div>
          {canManage && <div className="focus-row"><span className="focus-number">03</span><span className="focus-text"><strong>Review fleet assignments</strong><small>Keep your drivers in the loop</small></span><button className="text-link" type="button" onClick={() => onNavigate("vehicles")}>Review</button></div>}
        </section>
      </div>
      <section className="panel recent-panel">
        <div className="panel-heading recent-heading"><div><span className="eyebrow">LATEST ACTIVITY</span><h2>Recent loads</h2></div><span className="recent-subtitle">Latest 6 dispatches</span></div>
        {recentLoads.length > 0 ? (
          <div className="recent-loads">
            {recentLoads.map((load) => (
              <div className="recent-load" key={load.id}>
                <span className={`load-status-mark load-${load.status.toLowerCase()}`}><Truck size={16} /></span>
                <span className="recent-load-main"><strong>{load.loadNumber}</strong><small>{load.order.customer.name} · {load.order.material.name}</small></span>
                <span className="recent-load-driver"><strong>{load.driver.name}</strong><small>{load.vehicle.vehicleNumber}</small></span>
                <StatusBadge status={load.status} />
              </div>
            ))}
          </div>
        ) : (
          <div className="activity-empty"><span className="activity-empty-icon"><Box size={21} /></span><strong>Your dispatch activity will show up here</strong><span>Loads will appear as soon as orders are added.</span></div>
        )}
      </section>
    </section>
  );
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function RowActions({ onEdit, onArchive }: { onEdit: () => void; onArchive: () => void }) {
  return (
    <div className="row-actions">
      <button type="button" className="row-action-edit" onClick={onEdit}><Settings2 size={14} /> Edit</button>
      <button type="button" className="row-action-archive" onClick={onArchive} aria-label="Archive record"><X size={14} /></button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const formatted = status.toLowerCase().replaceAll("_", " ");
  return <span className={`status-badge status-${status.toLowerCase()}`}><i />{formatted.charAt(0).toUpperCase() + formatted.slice(1)}</span>;
}

function salaryLabel(type: Driver["salaryType"]) {
  return ({ PER_LOAD: "Per load", DAILY_WAGE: "Daily wage", MONTHLY: "Monthly", CUSTOM: "Custom" })[type];
}

function DocumentStatus({ vehicle }: { vehicle: Vehicle }) {
  const dates = [vehicle.insuranceExpiry, vehicle.fitnessExpiry, vehicle.permitExpiry, vehicle.pollutionExpiry].filter(Boolean);
  if (dates.length === 0) return <span className="doc-warning"><CircleAlert size={14} /> No dates</span>;
  const soon = vehicle.documentAttention;
  return <span className={soon ? "doc-warning" : "doc-ok"}>{soon ? <CircleAlert size={14} /> : <Check size={14} />}{soon ? "Check expiry" : "Up to date"}</span>;
}

function EmptyState({ icon, title, detail, action }: { icon: "driver" | "vehicle"; title: string; detail: string; action?: React.ReactNode }) {
  const Icon = icon === "driver" ? Users : Truck;
  return <div className="empty-state"><span className="empty-icon"><Icon size={22} /></span><strong>{title}</strong><span>{detail}</span>{action}</div>;
}

function driverToForm(driver: Driver): DriverFormData {
  return {
    name: driver.name,
    phone: driver.phone,
    alternatePhone: driver.alternatePhone || "",
    address: driver.address || "",
    licenceNumber: driver.licenceNumber,
    licenceExpiry: driver.licenceExpiry?.slice(0, 10) || "",
    joiningDate: driver.joiningDate?.slice(0, 10) || "",
    salaryType: driver.salaryType,
    ratePerLoad: String(driver.ratePerLoad),
    baseSalary: String(driver.baseSalary),
    bankOrUpi: driver.bankOrUpi || "",
    emergencyContact: driver.emergencyContact || "",
    notes: driver.notes || "",
    status: driver.status,
  };
}

function vehicleToForm(vehicle: Vehicle): VehicleFormData {
  return {
    vehicleNumber: vehicle.vehicleNumber,
    vehicleType: vehicle.vehicleType,
    capacity: String(vehicle.capacity),
    capacityUnit: vehicle.capacityUnit,
    assignedDriverId: vehicle.assignedDriverId || "",
    insuranceExpiry: vehicle.insuranceExpiry?.slice(0, 10) || "",
    fitnessExpiry: vehicle.fitnessExpiry?.slice(0, 10) || "",
    permitExpiry: vehicle.permitExpiry?.slice(0, 10) || "",
    pollutionExpiry: vehicle.pollutionExpiry?.slice(0, 10) || "",
    status: vehicle.status,
    notes: vehicle.notes || "",
  };
}

function DriverDialog({
  initial,
  editing,
  onClose,
  onSave,
}: {
  initial: DriverFormData;
  editing: boolean;
  onClose: () => void;
  onSave: (data: DriverFormData) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const update = <K extends keyof DriverFormData>(key: K, value: DriverFormData[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await onSave(form);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save changes.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="form-modal" role="dialog" aria-modal="true" aria-labelledby="driver-modal-title">
        <div className="modal-header"><div className="modal-title-icon"><Users size={19} /></div><div><h2 id="driver-modal-title">{editing ? "Edit driver" : "Add a driver"}</h2><p>Driver details and payment settings</p></div><button className="button-icon modal-close" onClick={onClose} type="button" aria-label="Close"><X size={19} /></button></div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <span className="form-section-label">PERSONAL DETAILS</span>
            <div className="form-grid">
              <FormField label="Full name" required><input value={form.name} onChange={(e) => update("name", e.target.value)} required maxLength={100} placeholder="e.g. Ravi Kumar" /></FormField>
              <FormField label="Mobile number" required><input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} required maxLength={20} placeholder="+91 98765 43210" /></FormField>
              <FormField label="Alternate number"><input type="tel" value={form.alternatePhone} onChange={(e) => update("alternatePhone", e.target.value)} maxLength={20} placeholder="Optional" /></FormField>
              <FormField label="Emergency contact"><input value={form.emergencyContact} onChange={(e) => update("emergencyContact", e.target.value)} maxLength={100} placeholder="Name and phone" /></FormField>
              <FormField label="Driving licence number" required><input value={form.licenceNumber} onChange={(e) => update("licenceNumber", e.target.value.toUpperCase())} required maxLength={40} placeholder="TN0120260001234" /></FormField>
              <FormField label="Licence expiry"><input type="date" value={form.licenceExpiry} onChange={(e) => update("licenceExpiry", e.target.value)} /></FormField>
              <FormField label="Joining date"><input type="date" value={form.joiningDate} onChange={(e) => update("joiningDate", e.target.value)} /></FormField>
              <FormField label="Status"><select value={form.status} onChange={(e) => update("status", e.target.value as Driver["status"])}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></FormField>
              <FormField label="Address" wide><textarea rows={2} value={form.address} onChange={(e) => update("address", e.target.value)} maxLength={500} placeholder="Residential address" /></FormField>
            </div>
            <span className="form-section-label form-section-spaced">PAYMENT DETAILS <span className="permission-hint"><ShieldCheck size={13} /> Restricted to managers</span></span>
            <div className="form-grid">
              <FormField label="Salary type"><select value={form.salaryType} onChange={(e) => update("salaryType", e.target.value as Driver["salaryType"])}><option value="PER_LOAD">Per load</option><option value="DAILY_WAGE">Daily wage</option><option value="MONTHLY">Monthly salary</option><option value="CUSTOM">Custom</option></select></FormField>
              <FormField label="Rate per load (₹)"><input type="number" min="0" step="0.01" value={form.ratePerLoad} onChange={(e) => update("ratePerLoad", e.target.value)} required /></FormField>
              <FormField label="Base salary (₹)"><input type="number" min="0" step="0.01" value={form.baseSalary} onChange={(e) => update("baseSalary", e.target.value)} required /></FormField>
              <FormField label="Bank account / UPI"><input value={form.bankOrUpi} onChange={(e) => update("bankOrUpi", e.target.value)} maxLength={120} placeholder="Payment details" /></FormField>
              <FormField label="Notes" wide><textarea rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} maxLength={1000} placeholder="Internal notes" /></FormField>
            </div>
            {error && <div className="form-error modal-error"><CircleAlert size={16} />{error}</div>}
          </div>
          <div className="modal-footer"><span className="required-note"><i /> Required fields</span><div><button className="button button-ghost" onClick={onClose} type="button">Cancel</button><button className="button button-primary" type="submit" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Add driver"}</button></div></div>
        </form>
      </section>
    </div>
  );
}

function DriverAccountDialog({
  driver,
  onClose,
  onCreate,
}: {
  driver: Driver;
  onClose: () => void;
  onCreate: (email: string, password: string) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await onCreate(String(form.get("email") || ""), String(form.get("password") || ""));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create driver login.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="form-modal account-modal" role="dialog" aria-modal="true" aria-labelledby="driver-account-title">
        <div className="modal-header">
          <div className="modal-title-icon"><ShieldCheck size={19} /></div>
          <div><h2 id="driver-account-title">Create driver login</h2><p>{driver.name} · {driver.driverNumber}</p></div>
          <button className="button-icon modal-close" onClick={onClose} type="button" aria-label="Close"><X size={19} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <p className="account-modal-note">This creates a driver-only account. Share the initial password privately with the driver.</p>
            <div className="account-form-fields">
              <FormField label="Login email" required><input name="email" type="email" autoComplete="off" required maxLength={254} placeholder="driver@example.com" /></FormField>
              <FormField label="Initial password (at least 12 characters)" required><input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={200} /></FormField>
            </div>
            {error && <div className="form-error modal-error"><CircleAlert size={16} />{error}</div>}
          </div>
          <div className="modal-footer"><span className="required-note"><i /> Private account setup</span><div><button className="button button-ghost" onClick={onClose} type="button">Cancel</button><button className="button button-primary" type="submit" disabled={pending}>{pending ? "Creating…" : "Create login"}</button></div></div>
        </form>
      </section>
    </div>
  );
}

function VehicleDialog({
  initial,
  editing,
  drivers,
  onClose,
  onSave,
}: {
  initial: VehicleFormData;
  editing: boolean;
  drivers: { id: string; driverNumber: string; name: string }[];
  onClose: () => void;
  onSave: (data: VehicleFormData) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const update = <K extends keyof VehicleFormData>(key: K, value: VehicleFormData[K]) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "assignedDriverId" ? { status: value ? "ASSIGNED" : current.status === "ASSIGNED" ? "AVAILABLE" : current.status } : {}),
      ...(key === "status" && value !== "ASSIGNED" ? { assignedDriverId: "" } : {}),
    }));
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await onSave(form);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save changes.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="form-modal" role="dialog" aria-modal="true" aria-labelledby="vehicle-modal-title">
        <div className="modal-header"><div className="modal-title-icon modal-title-orange"><Truck size={19} /></div><div><h2 id="vehicle-modal-title">{editing ? "Edit vehicle" : "Add a vehicle"}</h2><p>Registration, assignment and document dates</p></div><button className="button-icon modal-close" onClick={onClose} type="button" aria-label="Close"><X size={19} /></button></div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <span className="form-section-label">VEHICLE DETAILS</span>
            <div className="form-grid">
              <FormField label="Vehicle number" required><input value={form.vehicleNumber} onChange={(e) => update("vehicleNumber", e.target.value.toUpperCase())} required maxLength={20} placeholder="TN01AB1234" /></FormField>
              <FormField label="Vehicle type" required><select value={form.vehicleType} onChange={(e) => update("vehicleType", e.target.value)}><option>Tipper</option><option>Truck</option><option>Lorry</option><option>Tractor</option><option>Trailer</option><option>Other</option></select></FormField>
              <FormField label="Capacity" required><div className="input-with-select"><input type="number" min="0.01" step="0.01" value={form.capacity} onChange={(e) => update("capacity", e.target.value)} required placeholder="e.g. 10" /><select aria-label="Capacity unit" value={form.capacityUnit} onChange={(e) => update("capacityUnit", e.target.value)}><option>Ton</option><option>Load</option><option>Unit</option><option>Cubic Feet</option><option>Cubic Meter</option></select></div></FormField>
              <FormField label="Assigned driver"><select value={form.assignedDriverId} onChange={(e) => update("assignedDriverId", e.target.value)}><option value="">Not assigned</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name} · {driver.driverNumber}</option>)}</select></FormField>
              <FormField label="Vehicle status"><select value={form.status} onChange={(e) => update("status", e.target.value as Vehicle["status"])}><option value="AVAILABLE">Available</option><option value="ASSIGNED" disabled={!form.assignedDriverId}>Assigned</option><option value="UNDER_MAINTENANCE">Under maintenance</option><option value="INACTIVE">Inactive</option></select></FormField>
            </div>
            <span className="form-section-label form-section-spaced">DOCUMENT EXPIRY</span>
            <div className="form-grid">
              <FormField label="Insurance"><input type="date" value={form.insuranceExpiry} onChange={(e) => update("insuranceExpiry", e.target.value)} /></FormField>
              <FormField label="Fitness certificate"><input type="date" value={form.fitnessExpiry} onChange={(e) => update("fitnessExpiry", e.target.value)} /></FormField>
              <FormField label="Permit"><input type="date" value={form.permitExpiry} onChange={(e) => update("permitExpiry", e.target.value)} /></FormField>
              <FormField label="Pollution certificate"><input type="date" value={form.pollutionExpiry} onChange={(e) => update("pollutionExpiry", e.target.value)} /></FormField>
              <FormField label="Notes" wide><textarea rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} maxLength={1000} placeholder="Internal notes" /></FormField>
            </div>
            {error && <div className="form-error modal-error"><CircleAlert size={16} />{error}</div>}
          </div>
          <div className="modal-footer"><span className="required-note"><i /> Required fields</span><div><button className="button button-ghost" onClick={onClose} type="button">Cancel</button><button className="button button-primary" type="submit" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Add vehicle"}</button></div></div>
        </form>
      </section>
    </div>
  );
}

function FormField({ label, required, wide, children }: { label: string; required?: boolean; wide?: boolean; children: React.ReactNode }) {
  return <label className={`form-field ${wide ? "form-field-wide" : ""}`}><span>{label}{required && <i> *</i>}</span>{children}</label>;
}
