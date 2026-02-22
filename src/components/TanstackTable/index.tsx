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
    <div className="border border-gray50 rounded-lg overflow-x-auto max-w-full bg-surface has-scroll">
      <TableHeader table={ table } filtering={ filtering } setFiltering={ setFiltering } placeholder={ placeholder } />
      <table className="w-full">
        <thead className="sticky top-[3.375rem] z-20">
          { table.getHeaderGroups().map( headerGroup => (
            <tr key={ headerGroup.id }>
              { headerGroup.headers.map
                ( header =>
                  (
                    <th key={ header.id } className="bg-background px-6 py-4 text-left border-b-2 border-b-gray50 first:w-12">
                      <div className="flex items-center gap-3 cursor-pointer uppercase group" onClick={ header.column.getToggleSortingHandler() }>
                        { flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}   
                        { header.column.getCanSort() && (
                          header.column.getIsSorted() ? (
                            header.column.getIsSorted() === 'asc' ? (
                              <i className="text-sm fi fi-rr-arrow-small-up text-accent"></i>
                            ) : (
                              <i className="text-sm fi fi-rr-arrow-small-down text-accent"></i>
                            )
                          ) : (
                            <i className="text-sm fi fi-tr-sort-alt opacity-50 group-hover:opacity-100 group-hover:text-accent"></i>
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
                <td key={ cell.id } className="group-hover:bg-background first:w-12 px-6 py-4 bg-surface border-t border-t-gray50">
                  { flexRender( cell.column.columnDef.cell, cell.getContext() ) }
                </td>
              ) ) }
            </tr>
          ))}
        </tbody>
      </table>
      { pages.length > 1 &&
        <div className="bg-background py-4 px-6 border-t-2 border-t-gray50 sticky z-20 bottom-0">
          <TablePagination table={ table } pages={ pages } />
        </div>
      }
    </div>
  )
}
