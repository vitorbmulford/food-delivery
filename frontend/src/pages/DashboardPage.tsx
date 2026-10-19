import { ChartNoAxesCombined } from 'lucide-react'
import { PageHeading } from '../components/ui/PageHeading'
import { PlaceholderPanel } from '../components/ui/PlaceholderPanel'

export function DashboardPage() {
  return (
    <>
      <PageHeading
        title="Visão geral"
        description="Acompanhe a operação do seu delivery em um só lugar."
      />
      <PlaceholderPanel
        icon={<ChartNoAxesCombined size={22} />}
        title="Seu painel começa aqui"
        description="Quando a integração estiver pronta, os principais indicadores da operação serão exibidos nesta área."
      />
    </>
  )
}
