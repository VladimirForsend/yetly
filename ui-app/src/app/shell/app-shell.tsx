import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  BarChart3,
  Bell,
  Bot,
  ChevronDown,
  Clock3,
  CircleHelp,
  FolderKanban,
  Home,
  Inbox,
  Menu,
  PanelLeftClose,
  Search,
  Settings,
  Timer,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useWorkspace } from "../providers/app-providers";
import { QuickAddDialog } from "../../features/tasks/components/quick-add-dialog";
import { Avatar } from "../../shared/ui/avatar";
import { cn } from "../../shared/lib/cn";
import { TeamChat } from "../../features/chat/components/team-chat";

const navigation = [
  { to: "/home", label: "Inicio", Icon: Home },
  { to: "/ai", label: "Yetly AI", Icon: Bot },
  { to: "/my-work", label: "Mi trabajo", Icon: Zap },
  { to: "/inbox", label: "Bandeja", Icon: Inbox },
  { to: "/projects", label: "Proyectos", Icon: FolderKanban },
  { to: "/teams", label: "Equipos", Icon: Users },
  { to: "/timesheets", label: "Timesheets", Icon: Clock3 },
  { to: "/workload", label: "Carga de trabajo", Icon: BarChart3 },
  { to: "/reports", label: "Reportes", Icon: BarChart3 },
  { to: "/faq", label: "Ayuda y FAQ", Icon: CircleHelp },
];

const routeLabels: Record<string, string> = {
  "/home": "Inicio",
  "/ai": "Yetly AI",
  "/my-work": "Mi trabajo",
  "/inbox": "Bandeja",
  "/projects": "Proyectos",
  "/teams": "Equipos",
  "/timesheets": "Timesheets",
  "/workload": "Carga de trabajo",
  "/reports": "Reportes",
  "/faq": "Ayuda y FAQ",
  "/settings": "Configuración",
};

function Brand() {
  return (
    <div className="flex min-h-14 items-center gap-3 px-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-blue-500 text-white shadow-sm">
        <span className="text-lg font-black tracking-[-0.08em]">Y</span>
      </span>
      <div className="min-w-0">
        <p className="text-base font-black tracking-[-0.035em] text-ink-950">Yetly</p>
        <p className="truncate text-[11px] font-medium text-ink-500">Siempre sabes cómo vamos</p>
      </div>
    </div>
  );
}

function OrganizationSwitcher() {
  const { snapshot, switchOrganization, createOrganization, isMutating } = useWorkspace();
  if (!snapshot) {
    return <div className="mx-3 h-12 animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />;
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="mx-3 flex min-h-12 w-[calc(100%-1.5rem)] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left shadow-sm hover:border-brand-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-black text-white"
            style={{ backgroundColor: snapshot.activeOrganization.color }}
            aria-hidden="true"
          >
            {snapshot.activeOrganization.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-ink-950">{snapshot.activeOrganization.name}</span>
            <span className="block text-[11px] text-ink-500">Organización activa</span>
          </span>
          <ChevronDown className="h-4 w-4 text-ink-500" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={8}
          align="start"
          className="z-[70] min-w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-float"
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-ink-500">
            Cambiar organización
          </DropdownMenu.Label>
          {snapshot.organizations.map((organization) => (
            <DropdownMenu.Item
              key={organization.id}
              onSelect={() => switchOrganization(organization.id)}
              className="flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-semibold text-ink-900 outline-none data-[highlighted]:bg-brand-50"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg text-xs font-black text-white" style={{ backgroundColor: organization.color }}>
                {organization.initials}
              </span>
              {organization.name}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
          <DropdownMenu.Item
            disabled={isMutating}
            onSelect={async () => {
              const name = window.prompt("Nombre de la nueva organización");
              if (!name?.trim()) return;
              try { await createOrganization(name); } catch (cause) { window.alert(cause instanceof Error ? cause.message : "No fue posible crear la organización."); }
            }}
            className="cursor-pointer rounded-xl px-2.5 py-2.5 text-sm font-black text-brand-700 outline-none data-[highlighted]:bg-brand-50 data-[disabled]:opacity-50"
          >
            + Nueva organización
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4" aria-label="Navegación principal">
      <ul className="space-y-1">
        {navigation.map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-600 hover:bg-slate-100 hover:text-ink-950",
                )
              }
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="my-4 h-px bg-slate-200" aria-hidden="true" />
      <NavLink
        to="/settings"
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200",
            isActive ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-slate-100 hover:text-ink-950",
          )
        }
      >
        <Settings className="h-[18px] w-[18px]" aria-hidden="true" />
        Configuración
      </NavLink>
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { snapshot } = useWorkspace();
  return (
    <div className="flex h-full flex-col">
      <Brand />
      <OrganizationSwitcher />
      <SidebarNav onNavigate={onNavigate} />
      {snapshot && (
        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-3 rounded-xl p-2">
            <Avatar person={snapshot.currentUser} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink-950">{snapshot.currentUser.name}</p>
              <p className="truncate text-xs text-ink-500">{snapshot.currentUser.role}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { snapshot, stopTimer, isMutating } = useWorkspace();
  const [timerError, setTimerError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!snapshot?.activeTimer) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [snapshot?.activeTimer]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query || !snapshot) return [];
    const projects = snapshot.projects
      .filter((project) => `${project.name} ${project.code}`.toLowerCase().includes(query))
      .slice(0, 4)
      .map((project) => ({ id: project.id, label: project.name, meta: project.code, to: `/projects/${project.id}/list` }));
    const tasks = snapshot.tasks
      .filter((task) => task.title.toLowerCase().includes(query))
      .slice(0, 5)
      .map((task) => ({ id: task.id, label: task.title, meta: task.projectCode, to: `/projects/${task.projectId}/list` }));
    return [...projects, ...tasks].slice(0, 7);
  }, [searchQuery, snapshot]);

  const timerLabel = useMemo(() => {
    if (!snapshot?.activeTimer) return "";
    const total = Math.max(0, Math.floor((Date.now() - new Date(snapshot.activeTimer.startedAtIso).getTime()) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [h, m, s].map((value) => String(value).padStart(2, "0")).join(":");
  }, [snapshot?.activeTimer, tick]);

  const routeLabel = useMemo(() => {
    if (location.pathname.startsWith("/projects/")) return "Detalle de proyecto";
    return routeLabels[location.pathname] ?? "Yetly";
  }, [location.pathname]);

  const unread = snapshot?.notifications.filter((item) => item.unread).length ?? 0;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur lg:px-6">
      <button
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 lg:hidden"
        onClick={onOpenMenu}
        aria-label="Abrir navegación"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="hidden min-w-0 items-center gap-2 text-sm lg:flex">
        <span className="font-semibold text-ink-500">{snapshot?.activeOrganization.name ?? "Organización"}</span>
        <span className="text-slate-300" aria-hidden="true">/</span>
        <span className="truncate font-bold text-ink-950">{routeLabel}</span>
      </div>

      <div className="relative mx-auto hidden max-w-xl flex-1 md:block lg:ml-8">
        <label htmlFor="global-search" className="sr-only">Buscar tareas o proyectos</label>
        <Search className="pointer-events-none absolute left-3.5 top-5 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
        <input
          id="global-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && searchResults[0]) {
              event.preventDefault();
              navigate(searchResults[0].to);
              setSearchQuery("");
            }
          }}
          placeholder="Buscar tareas o proyectos…"
          className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-16 text-sm text-ink-950 outline-none placeholder:text-ink-500 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
          aria-expanded={searchResults.length > 0}
          aria-controls="global-search-results"
        />
        <kbd className="pointer-events-none absolute right-3 top-5 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-ink-500 xl:block">↵</kbd>
        {searchQuery.trim() && (
          <div id="global-search-results" className="absolute left-0 right-0 top-12 z-[75] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-float">
            {searchResults.length ? searchResults.map((result) => (
              <Link key={`${result.meta}-${result.id}`} to={result.to} onClick={() => setSearchQuery("")} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200">
                <span className="truncate font-bold text-ink-950">{result.label}</span>
                <span className="shrink-0 text-xs font-bold text-ink-500">{result.meta}</span>
              </Link>
            )) : <p className="px-3 py-4 text-center text-sm font-semibold text-ink-500">Sin coincidencias</p>}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {snapshot?.activeTimer && (
          <button
            className="hidden min-h-10 items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 text-sm font-bold text-brand-700 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:opacity-60 sm:flex"
            disabled={isMutating}
            onClick={async () => {
              setTimerError("");
              try { await stopTimer(); } catch (cause) { setTimerError(cause instanceof Error ? cause.message : "No fue posible detener el timer."); }
            }}
            title={`Detener timer: ${snapshot.activeTimer.taskTitle}`}
          >
            <Timer className="h-4 w-4" aria-hidden="true" />
            <span className="font-mono text-xs">{timerLabel}</span>
            <span className="sr-only">Detener timer activo en {snapshot.activeTimer.taskTitle}</span>
          </button>
        )}
        <QuickAddDialog compact />
        <Link
          to="/inbox"
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
          aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ""}`}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute right-2 top-2 grid h-4 min-w-4 place-items-center rounded-full bg-danger-600 px-1 text-[9px] font-black text-white">
              {unread}
            </span>
          )}
        </Link>
        {snapshot && <Avatar person={snapshot.currentUser} size="sm" className="ml-1 hidden sm:inline-flex" />}
      </div>
      {timerError && <span className="sr-only" role="alert">{timerError}</span>}
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <a href="#main-content" className="skip-link">Saltar al contenido principal</a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] border-r border-slate-200 bg-white lg:block">
        <SidebarContent />
      </aside>

      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink-950/35 lg:hidden" />
          <Dialog.Content
            className="fixed inset-y-0 left-0 z-50 w-[min(88vw,310px)] border-r border-slate-200 bg-white shadow-float focus:outline-none lg:hidden"
            aria-describedby={undefined}
          >
            <Dialog.Title className="sr-only">Navegación principal</Dialog.Title>
            <Dialog.Close asChild>
              <button className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200" aria-label="Cerrar navegación">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="lg:pl-[272px]">
        <Topbar onOpenMenu={() => setMobileOpen(true)} />
        <main id="main-content" className="mx-auto w-full max-w-[1680px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
      <TeamChat />
    </div>
  );
}
