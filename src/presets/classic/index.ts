import { classic } from '../../agents'
import { Preset } from '../types'

export function setup(): Preset {
  return (params, context) => {
    classic.useScopeAgent(params, context)
    classic.useVisualEffects(context)
  }
}
