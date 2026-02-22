'use client'
import { Button, Modal, ModalConfirm } from '@/components'
import { Color, Size, Variant } from '@/interfaces'
import { useUiStore } from '@/store/ui-store'

interface Props {
  link: string
  id: string
  token: string
  branchId?: string
  onDelete: ( id: string, token: string ) => Promise<void>
  disabled?: boolean
  confirmTitle?: string
  confirmDetail?: string
  confirmButtonText?: string
}

export const TableActions = ({ link, id, token, onDelete, confirmTitle, confirmDetail, confirmButtonText }: Props) => {

  const { openModalPage, closeModalConfirm, openModalConfirm, activeModalConfirmId } = useUiStore()

  const handleDelete = async ( id: string ) => {
    await onDelete( id, token )
    closeModalConfirm()
  }

  return (
    <>
      <ModalConfirm
        title={ confirmTitle || "Está seguro de eliminar este elemento?" }
        detail={ confirmDetail || "Al eliminar este elemento, se eliminará toda su información asociada" }
        buttonConfirmText={ confirmButtonText || "Sí, eliminar" }
        onClickConfirm={() => { handleDelete( id ) }}
        onClickCancel={() => { closeModalConfirm() }}
        isOpen={ activeModalConfirmId === id }
      />
      <div className="flex items-center gap-3 justify-end relative z-10">
        <Button
          href={link}
          onClick={() => openModalPage()}
          text='Editar'
          color={ Color.INFO }
          size={ Size.SM }
          variant={ Variant.GHOST }
          iconName='pencil'
        />
        <Button
          text='Eliminar'
          color={ Color.ERROR }
          size={ Size.SM }
          variant={ Variant.GHOST }
          iconName='trash'
          onClick={() => openModalConfirm(id)}
        />
      </div>
    </>
  )
}