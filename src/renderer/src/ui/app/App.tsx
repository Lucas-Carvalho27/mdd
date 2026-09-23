import { Button } from '@/ui/components/ui/button'

export function App(): React.JSX.Element {
  return (
    <main className="flex h-screen flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">mdd</h1>
      <Button className="self-start">Abrir pasta de projeto</Button>
    </main>
  )
}
