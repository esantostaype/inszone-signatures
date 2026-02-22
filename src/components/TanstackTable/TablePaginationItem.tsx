'use client'

interface TablePaginationItemProps {
  page?: number
  className?: string
  arrowIcon?: string
  active?: boolean
  disabled?: boolean
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLDivElement | HTMLAnchorElement>
}

export const TablePaginationItem = ({ page, arrowIcon, active, disabled, onClick }: TablePaginationItemProps) => {
  return (
    <li className={ `${ arrowIcon && "text-[10px]" } ${ disabled ? "pointer-events-none opacity-50" : "" } ${ active ? "pointer-events-none text-accent" : "" } hover:text-accent` }>
      <button onClick={ onClick } className="w-10 h-10 rounded-full flex items-center justify-center relative overflow-hidden">
        <span className="relative z-20">
        { arrowIcon ? (
          <i className={`fi fi-rr-${ arrowIcon }`}></i>
        ) : (
          `${ page }`
        ) }
        </span>
        { active && <span className="absolute h-full w-full left-0 top-0 bg-accent opacity-10 z-10"></span> }
      </button>
    </li>
  )
}