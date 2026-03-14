import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function OfflinePage() {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Offline fallback</CardTitle>
        <CardDescription>
          La shell de la aplicacion debe seguir disponible aunque la red falle. Las acciones de escritura deben reintentarse cuando vuelva la conexion.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-6 text-zinc-700">
        <p>Esta ruta sirve como referencia para estados offline y reintentos de red dentro del PWA.</p>
        <p>
          En fases siguientes conectaremos aqui las vistas de reintento para auth, jobs, applications y sincronizacion de cambios.
        </p>
      </CardContent>
    </Card>
  )
}
