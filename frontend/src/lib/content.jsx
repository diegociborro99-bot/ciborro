import { createContext, useContext, useEffect, useState } from 'react'
import * as seed from '../data/content'

/**
 * Contenido del sitio.
 *
 * Se pide a la API una sola vez al arrancar. Si no hay backend —desarrollo
 * suelto, build estático, o la API caída— se usa el contenido que viene en
 * `src/data/content.js`. El sitio nunca se queda en blanco por esto.
 */

const fallback = {
  owner: seed.owner,
  photos: seed.photos,
  projects: seed.projects,
  tracks: seed.tracks,
  clocks: seed.clocks,
  live: false,
}

const Ctx = createContext(fallback)

export const useContent = () => useContext(Ctx)

export function ContentProvider({ children }) {
  const [data, setData] = useState(fallback)

  useEffect(() => {
    let alive = true
    const ctrl = new AbortController()
    // si la API tarda, seguimos con el contenido local en vez de esperar
    const bail = setTimeout(() => ctrl.abort(), 4000)

    fetch('/api/content', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => {
        if (!alive || !json) return
        // campo a campo: si la base está a medias, cada hueco lo tapa el
        // contenido local en vez de dejar la sección en blanco
        setData({
          owner: json.owner ?? seed.owner,
          photos: json.photos?.length ? json.photos : seed.photos,
          projects: json.projects?.length ? json.projects : seed.projects,
          tracks: json.tracks?.length ? json.tracks : seed.tracks,
          clocks: json.clocks?.length ? json.clocks : seed.clocks,
          live: true,
        })
      })
      .catch(() => {
        /* sin backend: nos quedamos con el contenido local */
      })
      .finally(() => clearTimeout(bail))

    return () => {
      alive = false
      ctrl.abort()
      clearTimeout(bail)
    }
  }, [])

  return <Ctx.Provider value={data}>{children}</Ctx.Provider>
}
