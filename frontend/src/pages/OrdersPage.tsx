import { ClipboardList } from 'lucide-react'
import { PageHeading } from '../components/ui/PageHeading'
import { PlaceholderPanel } from '../components/ui/PlaceholderPanel'

export function OrdersPage() {
  return (
    <>
      <PageHeading title="Pedidos" description="Consulte e acompanhe os pedidos da operação." />
      <PlaceholderPanel
        icon={<ClipboardList size={22} />}
        title="A lista de pedidos será exibida aqui"
        description="Esta tela está preparada para receber a integração com a API de pedidos."
      />
    </>
  )
}
