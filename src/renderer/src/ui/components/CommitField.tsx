import { useState } from 'react'
import { Input } from '@/ui/components/ui/input'
import { Textarea } from '@/ui/components/ui/textarea'

interface CommitFieldProps {
  readonly id: string
  readonly value: string
  /** Chamado ao sair do campo com o texto alterado; `false` = recusado, o campo volta ao valor. */
  readonly onCommit: (value: string) => boolean
  readonly multiline?: boolean
  readonly placeholder?: string
}

/**
 * Campo que só grava ao terminar de editar: ao sair do campo ou com Enter (Ctrl+Enter no
 * texto longo). Esc descarta. Assim uma palavra digitada vira um único passo de desfazer.
 */
export function CommitField({
  id,
  value,
  onCommit,
  multiline = false,
  placeholder
}: CommitFieldProps): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  const [source, setSource] = useState(value)
  if (source !== value) {
    // O valor mudou por fora (desfazer, outra feature selecionada): mostra o novo valor.
    setSource(value)
    setDraft(value)
  }

  const commit = (): void => {
    if (draft !== value && !onCommit(draft)) setDraft(value)
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') {
      setDraft(value)
      event.currentTarget.blur()
    } else if (event.key === 'Enter' && (!multiline || event.ctrlKey)) {
      event.preventDefault()
      event.currentTarget.blur()
    }
  }
  const common = {
    id,
    value: draft,
    placeholder,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(event.target.value),
    onBlur: commit,
    onKeyDown
  }
  return multiline ? <Textarea rows={3} {...common} /> : <Input {...common} />
}
