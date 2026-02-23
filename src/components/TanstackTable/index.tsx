/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useReactTable,
  getCoreRowModel,
  flexRender,
  getPaginationRowModel,
  ColumnDef,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel
} from '@tanstack/react-table';
import { useState } from "react";
import { TablePagination } from './TablePagination';
import { TableHeader } from './TableHeader';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUpDownIcon, SortByDown02Icon, SortByUp02Icon } from '@hugeicons/core-free-icons';

interface Props {
  data: any[]
  columns: ColumnDef<any>[]
  placeholder?: string
}

export const TanstackTable = ({ data, columns, placeholder }: Props) => {

  const addRowNumberColumn = <T,>( columns: ColumnDef<T>[] ): ColumnDef<T>[] => {
    const hasOrderNumberColumn = columns.some(column => column.header === '#')

    if (hasOrderNumberColumn) {
      return columns
    }

    const rowNumberColumn: ColumnDef<T> = {
      header: '#',
      id: 'rowNumber',
      cell: ({ row }) => row.index + 1,
      accessorFn: (_, index) => index + 1,
      enableSorting: true,
      sortingFn: (rowA, rowB) => rowA.index - rowB.index
    }
    
    return [ rowNumberColumn, ...columns ]
  }

  const [ sorting, setSorting ] = useState<SortingState>([])
  const [ filtering, setFiltering ] = useState("")

  const columnsWithRowNumber = addRowNumberColumn( columns )

  const table = useReactTable({
    data,
    columns: columnsWithRowNumber,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      globalFilter: filtering
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: ( value: string ) => {
      const timer = setTimeout(() => {
        setFiltering( value )
      }, 1000 )
      return () => clearTimeout( timer )
    }
  })

  const pages = Array.from({ length: table.getPageCount() }, ( _, i ) => i + 1 )

  return (
    <div className="border border-[var(--soft-bg-active)] rounded-lg overflow-x-auto max-w-full bg-surface has-scroll">
      <TableHeader table={ table } filtering={ filtering } setFiltering={ setFiltering } placeholder={ placeholder } />
      <table className="w-full">
        <thead className="sticky top-[3.375rem] z-20">
          { table.getHeaderGroups().map( headerGroup => (
            <tr key={ headerGroup.id }>
              { headerGroup.headers.map
                ( header =>
                  (
                    <th key={ header.id } className="bg-surface px-6 py-4 text-left border-b-2 border-b-[var(--soft-bg-active)] first:w-12">
                      <div className="flex items-center gap-3 cursor-pointer text-xs text-foreground/70 uppercase group" onClick={ header.column.getToggleSortingHandler() }>
                        { flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}   
                        { header.column.getCanSort() && (
                          header.column.getIsSorted() ? (
                            header.column.getIsSorted() === 'asc' ? (
                              <HugeiconsIcon icon={ SortByUp02Icon } size={ 16 } strokeWidth={ 2 } className='text-accent-900 dark:text-accent' />
                            ) : (
                              <HugeiconsIcon icon={ SortByDown02Icon } size={ 16 } strokeWidth={ 2 } className='text-accent-900 dark:text-accent' />
                            )
                          ) : (
                            <HugeiconsIcon icon={ ArrowUpDownIcon } size={ 16 } strokeWidth={ 2 } className='hover:text-accent-900 dark:hover:text-accent opacity-40 hover:opacity-100' />
                          )
                        )}
                      </div>
                    </th>
                  )
                )
              }
            </tr>
          ))}
        </thead>
        <tbody>
          { table.getRowModel().rows.map(( row ) => (
            <tr key={ row.id } className="group">
              { row.getVisibleCells().map( cell => (
                <td key={ cell.id } className="group-hover:bg-background first:w-12 px-6 py-4 bg-surface border-t border-t-[var(--soft-bg-active)]">
                  { flexRender( cell.column.columnDef.cell, cell.getContext() ) }
                </td>
              ) ) }
            </tr>
          ))}
        </tbody>
      </table>
      { pages.length > 1 &&
        <div className="bg-background py-4 px-6 border-t-2 border-t-[var(--soft-bg-active)] sticky z-20 bottom-0">
          <TablePagination table={ table } pages={ pages } />
        </div>
      }
    </div>
  )
}
