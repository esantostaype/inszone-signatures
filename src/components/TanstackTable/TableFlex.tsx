'use client'

export const TableFlex: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex items-center gap-3">
      { children }
    </div>
  )
}