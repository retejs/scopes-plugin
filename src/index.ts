import { NodeEditor, NodeId, Root, Scope } from 'rete'
import { BaseArea, BaseAreaPlugin } from 'rete-area-plugin'

import { useOrdering } from './ordering'
import { Preset } from './presets/types'
import { translateChildren } from './scope'
import { resizeParent } from './sizing'
import { ExpectedScheme, Padding, Size } from './types'
import { belongsTo, hasSelectedParent, trackedTranslate } from './utils'
import { useValidator } from './validation'

export * as Presets from './presets'

/**
 * Props for `ScopesPlugin` class.
 */
export type Props = {
  /** Padding (space) between the scope's border and its children. Default is `() => ({ top: 40, left: 20, right: 20, bottom: 20 })` */
  padding?: (id: NodeId) => Padding
  /** Determines whether the nested node should be excluded from affecting the scope's size, etc. Default is `() => false` */
  exclude?: (id: NodeId) => boolean
  /** Customizes the size of the node which is recognized as a parent. Default is `(id, size) => size` */
  size?: (id: NodeId, size: Size) => Size
}

type Requires<Schemes extends ExpectedScheme> =
  | BaseArea<Schemes>

/**
 * Signal types produced by ConnectionPlugin instance
 * @priority 10
 */
export type Scopes =
  | { type: 'scopepicked', data: { ids: NodeId[] } }
  | { type: 'scopereleased', data: { ids: NodeId[] } }

/**
 * Scope plugin. Responsible for user interaction with scopes (nested nodes, groups)
 * @priority 9
 * @listens nodetranslated
 * @listens noderemoved
 * @emits scopepicked
 * @emits scopereleased
 */
export class ScopesPlugin<Schemes extends ExpectedScheme, T = never> extends Scope<Scopes, [Requires<Schemes>, Root<Schemes>]> {
  padding: (id: NodeId) => Padding
  exclude: (id: NodeId) => boolean
  size: (id: NodeId, size: Size) => Size
  editor!: NodeEditor<Schemes>
  area!: BaseAreaPlugin<Schemes, T>
  presets: Preset[] = []

  constructor(props?: Props) {
    super('scopes')
    this.padding = props?.padding || (() => ({
      top: 40,
      left: 20,
      right: 20,
      bottom: 20
    }))
    this.exclude = props?.exclude || (() => false)
    this.size = props?.size || ((id, size) => size)
  }

  // eslint-disable-next-line max-statements
  setParent(scope: Scope<BaseArea<Schemes>, [Root<Schemes>]>): void {
    super.setParent(scope)

    this.area = this.parentScope<BaseAreaPlugin<Schemes, T>>(BaseAreaPlugin)
    this.editor = this.area.parentScope<NodeEditor<Schemes>>(NodeEditor)

    const props = { editor: this.editor, area: this.area }
    const { padding, size, exclude } = this
    const pickedNodes = getPickedNodes(this)
    const { translate, isTranslating } = trackedTranslate(props)
    const agentParams = { padding, size, exclude, translate }

    useValidator(props)
    useOrdering(props)

    this.presets.forEach(preset => {
      preset(agentParams, { ...props, scopes: this })
    })

    // eslint-disable-next-line max-statements, complexity
    this.addPipe(async context => {
      if (context.type === 'nodetranslated') {
        const { id } = context.data
        const current = props.editor.getNode(id)

        if (!current) throw new Error('cannot find node')
        // prevent translating children if the node translation
        // is triggered by its resizing (when its children moved)
        if (!isTranslating(id)) {
          await translateChildren(id, context.data, props)
        }

        const parent = current.parent ? props.editor.getNode(current.parent) : null

        if (parent && !agentParams.exclude(id)) {
          const hasAnySelectedParent = hasSelectedParent(id, props)
          const isPicked = belongsTo(current.id, pickedNodes, props)

          if (!hasAnySelectedParent && !isPicked) {
            await resizeParent(parent, agentParams, props)
          }
        }
      }
      if (context.type === 'noderemoved') {
        const parentId = context.data.parent
        const parent = parentId && props.editor.getNode(parentId)

        if (parent) {
          await resizeParent(parent, agentParams, props)
        }
      }
      return context
    })
  }

  /**
   * Adds a preset to the plugin.
   * @param preset Preset that is responsible for user interactions with scopes (e.g. assigning nodes to scopes)
   */
  public addPreset(preset: Preset) {
    this.presets.push(preset)
  }

  public isDependent(id: NodeId) {
    const props = { editor: this.editor, area: this.area }
    const node = this.editor.getNode(id)

    return node && (node.selected || hasSelectedParent(id, props))
  }
}

export function getPickedNodes<S extends ExpectedScheme>(scopes: Scope<Scopes, [Requires<S>, Root<S>]>) {
  const nodes: NodeId[] = []

  scopes.addPipe(async context => {
    if (!('type' in context)) return context
    if (context.type === 'scopepicked') {
      nodes.push(...context.data.ids)
    }
    if (context.type === 'scopereleased') {
      nodes.splice(0, nodes.length, ...nodes.filter(id => !context.data.ids.includes(id)))
    }
    return context
  })
  return nodes
}
