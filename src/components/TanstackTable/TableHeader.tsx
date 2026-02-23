/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
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
    <div className="flex justify-between px-6 py-4 bg-surface border-b border-b-[var(--soft-bg-active)] sticky top-0 z-20">
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={ Search01Icon } size={ 20 } strokeWidth={ 1 } />
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
      {/* <div className="flex items-center gap-6 text-sm">
        Pages: {' '}
        { table.getState().pagination.pageIndex + 1 } de{' '}
        { table.getPageCount().toLocaleString() } 
        <select
          value={ table.getState().pagination.pageSize }
          onChange={ e => {
            table.setPageSize( Number( e.target.value ))
          }}
        >
          {[ 10, 20, 30, 40, 50 ].map( pageSize  => (
            <option key={ pageSize } value={ pageSize } className='text-foreground'>
              Show { pageSize }
            </option>
          ))}
        </select>
      </div> */}
    </div>
  )
}