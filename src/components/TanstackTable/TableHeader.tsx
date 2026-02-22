'use client'

import { Table as ReactTable } from '@tanstack/react-table'

type TableInstance<TData extends object> = ReactTable<TData>

type Props<TData extends object> = {
  table: TableInstance<TData>
  filtering: string
  setFiltering: any
  placeholder?: string
}

export const TableHeader = <TData extends object>({ table, filtering, setFiltering, placeholder }: Props<TData> ) => {

  return (
    <div className="flex justify-between px-6 py-4 bg-background border-b border-b-gray50 sticky top-0 z-20">
      <div className="flex items-center gap-2">
        <i className="fi fi-rr-search"></i>
        <input
          type="text"
          name="searchTerm"
          placeholder={ placeholder || "Buscar" }
          autoComplete="off"
          value={ filtering }
          onChange={ (e) => setFiltering( e.target.value ) }
          className="outline-none"
        />
      </div>
      <div className="flex items-center gap-6">
        Páginas: {' '}
        { table.getState().pagination.pageIndex + 1 } de{' '}
        { table.getPageCount().toLocaleString() } 
        <select
          value={ table.getState().pagination.pageSize }
          onChange={ e => {
            table.setPageSize( Number( e.target.value ))
          }}
        >
          {[ 10, 20, 30, 40, 50 ].map( pageSize  => (
            <option key={ pageSize } value={ pageSize }>
              Mostrar { pageSize }
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}