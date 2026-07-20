'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PlayerAvatar } from './PlayerAvatar'
import type { NamedPlayerStats } from '@/lib/stats/types'

type Row = NamedPlayerStats & { rank: number }

function SortIcon({ dir }: { dir: false | 'asc' | 'desc' }) {
  if (dir === 'asc') return <ArrowUp className="size-3" />
  if (dir === 'desc') return <ArrowDown className="size-3" />
  return <ArrowUpDown className="size-3 opacity-30" />
}

/**
 * Compact, sortable standings table (TanStack Table) for the homepage.
 * "#" always reflects the incoming rank (wins → GD → GF, matching the
 * server-side leaderboard order) regardless of the active sort — sorting
 * only reorders rows for comparison, it doesn't renumber standings.
 */
export function StandingsTable({
  players,
  currentUserId,
  hrefFor = (id) => `/players/${id}`,
}: {
  players: NamedPlayerStats[]
  currentUserId?: string
  hrefFor?: (id: string) => string
}) {
  const [sorting, setSorting] = useState<SortingState>([])

  const data = useMemo<Row[]>(
    () => players.map((p, i) => ({ ...p, rank: i + 1 })),
    [players]
  )

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: 'rank',
        header: '#',
        accessorKey: 'rank',
        enableSorting: false,
        cell: ({ row }) => (
          <span className={cn('tabular-nums text-muted-foreground', row.original.rank <= 3 && 'font-bold text-gold')}>
            {row.original.rank}
          </span>
        ),
      },
      {
        id: 'player',
        header: 'Player',
        accessorKey: 'name',
        cell: ({ row }) => {
          const p = row.original
          const isMe = p.id === currentUserId
          return (
            <Link href={hrefFor(p.id)} className="flex min-w-0 items-center gap-2 hover:underline">
              <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size="sm" />
              <span className={cn('truncate font-medium', isMe && 'text-primary')}>
                {p.name}
              </span>
              {p.rank === 1 && <Crown className="size-3.5 shrink-0 text-gold" aria-label="Leader" />}
            </Link>
          )
        },
      },
      {
        id: 'mp',
        header: 'MP',
        accessorKey: 'matchesPlayed',
        cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{getValue<number>()}</span>,
      },
      {
        id: 'w',
        header: 'W',
        accessorKey: 'wins',
        cell: ({ getValue }) => <span className="tabular-nums text-win font-medium">{getValue<number>()}</span>,
      },
      {
        id: 'd',
        header: 'D',
        accessorKey: 'draws',
        cell: ({ getValue }) => <span className="tabular-nums text-draw font-medium">{getValue<number>()}</span>,
      },
      {
        id: 'l',
        header: 'L',
        accessorKey: 'losses',
        cell: ({ getValue }) => <span className="tabular-nums text-loss font-medium">{getValue<number>()}</span>,
      },
      {
        id: 'gd',
        header: 'GD',
        accessorKey: 'goalDiff',
        cell: ({ getValue }) => {
          const v = getValue<number>()
          return <span className={cn('tabular-nums font-medium', v > 0 ? 'text-win' : v < 0 ? 'text-loss' : 'text-muted-foreground')}>{v > 0 ? `+${v}` : v}</span>
        },
      },
      {
        id: 'winRate',
        header: 'W%',
        accessorKey: 'winRate',
        cell: ({ getValue }) => <span className="tabular-nums font-heading font-bold">{Math.round(getValue<number>() * 100)}%</span>,
      },
    ],
    [currentUserId, hrefFor]
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // Column ids hidden below each breakpoint — keeps the table usable on
  // narrow screens without horizontal scrolling for the columns that matter most.
  // `.page-content` (globals.css) stays 480px wide until the `lg:` (1024px)
  // breakpoint, where it jumps to 720px — there's no usable extra width at
  // `sm:`/`md:`, so every secondary column waits for that same jump.
  const HIDE_BELOW_LG = new Set(['mp', 'd', 'l'])

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id} className="hover:bg-transparent">
            {hg.headers.map((header) => (
              <TableHead
                key={header.id}
                className={cn(
                  'h-8 px-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase first:pl-1 last:pr-1',
                  header.column.id === 'player' ? 'text-left' : 'text-right',
                  HIDE_BELOW_LG.has(header.column.id) && 'hidden lg:table-cell'
                )}
              >
                {header.column.getCanSort() ? (
                  <button
                    type="button"
                    onClick={header.column.getToggleSortingHandler()}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    <SortIcon dir={header.column.getIsSorted()} />
                  </button>
                ) : (
                  flexRender(header.column.columnDef.header, header.getContext())
                )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => {
          const isMe = row.original.id === currentUserId
          return (
            <TableRow
              key={row.id}
              className={cn(isMe && 'bg-primary/5 border-l-2 border-l-primary')}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn(
                    'px-1.5 py-1.5 first:pl-1 last:pr-1',
                    cell.column.id === 'player' ? 'text-left' : 'text-right',
                    HIDE_BELOW_LG.has(cell.column.id) && 'hidden lg:table-cell'
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
