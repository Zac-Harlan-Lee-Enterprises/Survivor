import { useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import type { WeekSummary } from '@/domain'
import { useLeagueContext } from './hooks'

const PARAM = 'week'

export interface SelectedWeek {
  /** The week currently being shown. Always a week the season actually has. */
  week: number
  /** Every week of the season, in order. */
  weeks: WeekSummary[]
  /** The live week, which is not always the one being viewed. */
  currentWeek: number
  setWeek: (week: number) => void
}

/**
 * Which week the league view is showing.
 *
 * Kept in the URL rather than in component state, so a week is shareable and
 * survives a reload: "#/?week=7" links straight to week 7's slate. An absent,
 * malformed or out-of-range value falls back to the current week, so a
 * hand-edited URL can never produce an empty page.
 */
export function useSelectedWeek(): SelectedWeek {
  const { evaluation } = useLeagueContext()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const requested = Number(params.get(PARAM))
  const week = evaluation.weeks.some((w) => w.week === requested)
    ? requested
    : evaluation.currentWeek

  const setWeek = useCallback(
    (next: number) => {
      // The slate lives on the league home, and this control sits in the
      // header on every page — so choosing a week goes to the page that can
      // actually show it, rather than silently doing nothing.
      // The current week needs no parameter, which keeps the default URL clean.
      navigate(next === evaluation.currentWeek ? '/' : `/?${PARAM}=${next}`)
    },
    [navigate, evaluation.currentWeek],
  )

  return { week, weeks: evaluation.weeks, currentWeek: evaluation.currentWeek, setWeek }
}
