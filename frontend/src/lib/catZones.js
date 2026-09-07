import { useEffect } from 'react'

/**
 * Zonas donde el gato del escritorio no entra.
 *
 * Un juego con gatos dentro y una foto a pantalla completa no son sitio para
 * que un gato más se pasee por encima. Cada componente registra el nodo que
 * quiere libre de gato; el gato consulta la lista en cada fotograma y, si el
 * cursor cae dentro, se queda en el umbral esperando, como ante una puerta
 * cerrada. Si la zona ocupa la pantalla entera, se desvanece.
 */
const zonas = new Set()

export function useCatZone(ref, active = true) {
  useEffect(() => {
    const el = ref.current
    if (!el || !active) return
    zonas.add(el)
    return () => zonas.delete(el)
  }, [ref, active])
}

export const catZones = () => zonas
