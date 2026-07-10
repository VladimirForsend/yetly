import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./shell/app-shell";
import { useWorkspace } from "./providers/app-providers";

const DashboardPage = lazy(() => import("../features/dashboard/pages/dashboard-page").then((module) => ({ default: module.DashboardPage })));
const AiPage = lazy(() => import("../features/ai/pages/ai-page").then((module) => ({ default: module.AiPage })));
const ChannelsPage = lazy(() => import("../features/chat/pages/channels-page").then((module) => ({ default: module.ChannelsPage })));
const FaqPage = lazy(() => import("../features/help/pages/faq-page").then((module) => ({ default: module.FaqPage })));
const InboxPage = lazy(() => import("../features/inbox/pages/inbox-page").then((module) => ({ default: module.InboxPage })));
const MyWorkPage = lazy(() => import("../features/my-work/pages/my-work-page").then((module) => ({ default: module.MyWorkPage })));
const OnboardingPage = lazy(() => import("../features/onboarding/pages/onboarding-page").then((module) => ({ default: module.OnboardingPage })));
const ProjectPage = lazy(() => import("../features/projects/pages/project-page").then((module) => ({ default: module.ProjectPage })));
const ProjectsPage = lazy(() => import("../features/projects/pages/projects-page").then((module) => ({ default: module.ProjectsPage })));
const ReportsPage = lazy(() => import("../features/insights/pages/reports-page").then((module) => ({ default: module.ReportsPage })));
const SettingsPage = lazy(() => import("../features/settings/pages/settings-page").then((module) => ({ default: module.SettingsPage })));
const TeamsPage = lazy(() => import("../features/teams/pages/teams-page").then((module) => ({ default: module.TeamsPage })));
const TimesheetsPage = lazy(() => import("../features/time/pages/timesheets-page").then((module) => ({ default: module.TimesheetsPage })));
const WorkloadPage = lazy(() => import("../features/workload/pages/workload-page").then((module) => ({ default: module.WorkloadPage })));
const NotFoundPage = lazy(() => import("../features/errors/pages/not-found-page").then((module) => ({ default: module.NotFoundPage })));

function RouteLoading() {
  return (
    <div className="grid min-h-48 place-items-center rounded-2xl border border-slate-200 bg-white" role="status" aria-live="polite">
      <div className="text-center"><span className="mx-auto block h-8 w-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" aria-hidden="true" /><p className="mt-3 text-sm font-bold text-ink-600">Cargando vista…</p></div>
    </div>
  );
}

export function App() {
  const { isLoading, isError, error, needsOnboarding } = useWorkspace();

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="text-center" role="status" aria-live="polite">
          <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" aria-hidden="true" />
          <p className="mt-4 text-sm font-bold text-ink-700">Abriendo tu workspace…</p>
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <section className="max-w-lg rounded-2xl border border-danger-600/20 bg-white p-6 text-center shadow-card">
          <h1 className="text-xl font-black text-ink-950">No pudimos abrir tus datos</h1>
          <p className="mt-2 text-sm leading-6 text-ink-600">{error?.message ?? "Error desconocido."}</p>
        </section>
      </main>
    );
  }

  if (needsOnboarding) return <Suspense fallback={<main className="min-h-screen"><RouteLoading /></main>}><OnboardingPage /></Suspense>;

  return (
    <AppShell>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<DashboardPage />} />
          <Route path="/ai" element={<AiPage />} />
          <Route path="/my-work" element={<MyWorkPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<NavigateProjectToList />} />
          <Route path="/projects/:projectId/:view" element={<ProjectPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/timesheets" element={<TimesheetsPage />} />
          <Route path="/workload" element={<WorkloadPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/connect-supabase" element={<OnboardingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

function NavigateProjectToList() {
  return <Navigate to="list" replace />;
}
