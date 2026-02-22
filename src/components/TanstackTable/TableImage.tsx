'use client'

import Image from 'next/image'

interface Props {
  src?: string | null
  alt: string
}

export const TableImage = ({ src, alt }: Props ) => {

  return (
    <div className="relative">
      { src ? (
        <Image src={ src } alt={ alt } width={ 40 } height={ 40 } className="aspect-square rounded-full object-cover" />
      ) : (
        <div className="relative flex items-center justify-center w-10 h-10 rounded-full overflow-hidden">
          <i className="fi fi-tr-image-slash relative z-20"></i>
          <span className="absolute z-10 bg-accent opacity-10 w-full h-full top-0 left-0"></span>
        </div>
      )}
    </div>
  )
}