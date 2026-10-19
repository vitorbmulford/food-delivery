import { useQuery } from '@tanstack/react-query'
import { getInsights } from './insightsApi'

export const insightsKeys = {
  all: ['insights'] as const,
  period: (from: string, to: string) => [...insightsKeys.all, from, to] as const,
}

export function useInsights(from: string, to: string) {
  return useQuery({
    queryKey: insightsKeys.period(from, to),
    queryFn: ({ signal }) => getInsights(from, to, signal),
    enabled: Boolean(from && to && from <= to),
    staleTime: 60_000,
  })
}
