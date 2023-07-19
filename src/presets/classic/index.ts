import { classic } from '../../agents'
import { Preset } from '../types'

/**
 * Classic preset allowing capturing a node by long-pressing it and dropping it onto another node to make it a nested.
 * @returns Preset
 * @listens nodepicked
 * @listens nodetranslated
 * @listens nodedragged
 * @emits scopepicked
 * @emits scopereleased
 */
export function setup(): Preset {
  return (params, context) => {
    classic.useScopeAgent(params, context)
    classic.useVisualEffects(context)
  }
}
