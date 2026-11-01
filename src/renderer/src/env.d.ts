/// <reference types="vite/client" />

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.svg' {
  import React from 'react'
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  const src: string
  export default src
}

import type { HelioxenApi } from '../../preload/types'

export type { HelioxenApi, HelioxenWindowApi } from '../../preload/types'

declare global {
  interface Window {
    helioxen?: HelioxenApi
  }
}
