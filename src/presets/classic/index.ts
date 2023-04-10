import { classic } from '../../agents'
import { Preset } from '../types'

export function setup(): Preset {
  return ({ padding, translate }, context) => {
    classic.useScopeAgent({ padding, translate }, context)
    classic.useVisualEffects(context)
  }
}
