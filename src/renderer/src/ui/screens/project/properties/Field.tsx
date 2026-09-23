import { Label } from '@/ui/components/ui/label'

interface FieldProps {
  readonly label: string
  readonly htmlFor?: string
  readonly children: React.ReactNode
}

/** Rótulo + conteúdo, com o espaçamento padrão do painel de propriedades. */
export function Field({ label, htmlFor, children }: FieldProps): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
