import { PageHeader } from "../../../shared/ui/page-header";
import { ExecutiveAiAssistant } from "../components/executive-ai-assistant";

export function AiPage() {
  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <PageHeader
        eyebrow="Yetly AI"
        title="Análisis ejecutivo"
        description="Resume proyectos, detecta riesgos y prepara decisiones con el contexto actual de Yetly."
      />
      <ExecutiveAiAssistant />
    </div>
  );
}
