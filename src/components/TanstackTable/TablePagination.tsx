'use client'

import { Table as ReactTable } from '@tanstack/react-table'
import { TablePaginationItem } from "./TablePaginationItem"

type TableInstance<TData extends object> = ReactTable<TData>

type Props<TData extends object> = {
  table: TableInstance<TData>
  pages: number[]
}

export const TablePagination = <TData extends object>({ table, pages }: Props<TData> ) => {
  return (
    <nav className="flex justify-center">
      <ul className="flex items-center">
        <TablePaginationItem onClick={ () => table.setPageIndex( 0 ) } disabled={ !table.getCanPreviousPage() } arrowIcon="angle-double-left" />
        <TablePaginationItem onClick={ () => table.previousPage() } disabled={ !table.getCanPreviousPage() } arrowIcon="angle-left" />
        {
          pages.map( page => (
            <TablePaginationItem key={ page } page={ page } active={ page - 1 === table.getState().pagination.pageIndex } onClick={ () => table.setPageIndex( page - 1 ) }/>
          ))
        }
        <TablePaginationItem onClick={ () => table.nextPage() } disabled={ !table.getCanNextPage() } arrowIcon="angle-double-right" />
        <TablePaginationItem onClick={ () => table.setPageIndex( table.getPageCount() - 1 ) } disabled={ !table.getCanNextPage() } arrowIcon="angle-right" />
      </ul>
    </nav>
  )
}
