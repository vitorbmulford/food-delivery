import { useCallback, useEffect, useState } from 'react'
import { Button, Stack } from '@mui/material'
import { Plus } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { PageHeading } from '../components/ui/PageHeading'
import { OrdersList } from '../features/orders/components/OrdersList'
import { useOrders } from '../features/orders/hooks/useOrders'
import { orderStatuses, type OrderStatus } from '../features/orders/types/order'

const pageSize = 10

export function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const rawPage = Number(searchParams.get('page') ?? 0)
  const page = Number.isInteger(rawPage) && rawPage >= 0 ? rawPage : 0
  const rawStatus = searchParams.get('status') ?? ''
  const status = orderStatuses.includes(rawStatus as OrderStatus) ? (rawStatus as OrderStatus) : ''
  const search = searchParams.get('search') ?? ''
  const [searchInput, setSearchInput] = useState(search)
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const query = useOrders({
    page,
    size: pageSize,
    ...(status ? { status } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  })

  const updateParams = useCallback(
    (next: { page?: number; status?: OrderStatus | ''; search?: string }) => {
      const updated = new URLSearchParams(searchParams)
      if (next.page !== undefined && next.page > 0) updated.set('page', String(next.page))
      else updated.delete('page')
      const nextStatus = next.status ?? status
      if (nextStatus) updated.set('status', nextStatus)
      else updated.delete('status')
      const nextSearch = next.search ?? search
      if (nextSearch) updated.set('search', nextSearch)
      else updated.delete('search')
      setSearchParams(updated)
    },
    [search, searchParams, setSearchParams, status],
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350)
    return () => window.clearTimeout(timeout)
  }, [searchInput])

  useEffect(() => {
    if (debouncedSearch !== search) updateParams({ search: debouncedSearch, page: 0 })
  }, [debouncedSearch, search, updateParams])

  useEffect(() => {
    if (query.data && page >= Math.max(query.data.page.totalPages, 1)) {
      const updated = new URLSearchParams(searchParams)
      const lastPage = Math.max(query.data.page.totalPages - 1, 0)
      if (lastPage > 0) updated.set('page', String(lastPage))
      else updated.delete('page')
      setSearchParams(updated)
    }
  }, [page, query.data, searchParams, setSearchParams])

  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', mb: 3.5 }}
      >
        <PageHeading
          title="Pedidos"
          description="Consulte, crie e acompanhe os pedidos da operação."
        />
        <Button
          variant="contained"
          startIcon={<Plus size={18} />}
          onClick={() => navigate('/orders/new')}
          sx={{ mb: { xs: 2, sm: 3.5 }, flexShrink: 0 }}
        >
          Novo pedido
        </Button>
      </Stack>
      <OrdersList
        orders={searchInput.trim() === debouncedSearch ? (query.data?.content ?? []) : []}
        loading={query.isLoading || searchInput.trim() !== debouncedSearch}
        error={query.isError}
        page={page}
        totalPages={query.data?.page.totalPages ?? 0}
        totalElements={query.data?.page.totalElements ?? 0}
        status={status}
        search={searchInput}
        onSearchChange={setSearchInput}
        onClearSearch={() => setSearchInput('')}
        onStatusChange={(value) => updateParams({ status: value, page: 0 })}
        onPageChange={(value) => updateParams({ page: value })}
        onRetry={() => query.refetch()}
        onCreate={() => navigate('/orders/new')}
      />
    </>
  )
}
