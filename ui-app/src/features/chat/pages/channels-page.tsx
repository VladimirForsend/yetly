import { PageHeader } from "../../../shared/ui/page-header";
import { TeamChat } from "../components/team-chat";

export function ChannelsPage() {
  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <PageHeader
        eyebrow="Canales"
        title="Chat del equipo"
        description="Conversa en el canal general, crea canales de texto y abre mensajes directos con personas conectadas a Yetly."
      />
      <TeamChat />
    </div>
  );
}
