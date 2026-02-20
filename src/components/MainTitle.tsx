'use client'
import { HugeiconsIcon, IconSvgElement } from '@hugeicons/react'

interface Props {
  title: string
  icon?: IconSvgElement
}

export const MainTitle = ({ title, icon }: Props) => {

  return (
    <h1 className='flex items-center gap-2 text-3xl font-semibold mb-8'>
      { icon && <HugeiconsIcon icon={ icon } size={ 32 } strokeWidth={ 1 } /> }
      { title }
    </h1>
  )
}