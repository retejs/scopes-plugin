import { BaseSchemes, NodeEditor, NodeId, Root, Scope } from 'rete'
import { Area2D, Area2DInherited, AreaPlugin } from 'rete-area-plugin'

import { useOrdering } from './ordering'
import { Preset } from './presets/types'
import { translateChildren } from './scope'
import { resizeParent } from './sizing'
import { ExpectedScheme, Padding } from './types'
import { belongsTo, hasSelectedParent, trackedTranslate } from './utils'
import { useValidator } from './validation'

export * as Presets from './presets'

type Props = {
  padding?: Padding
}

export type Scopes =
    | { type: 'scopepicked', data: { ids: NodeId[] } }
    | { type: 'scopereleased', data: { ids: NodeId[] } }

export class ScopesPlugin<Schemes extends ExpectedScheme, T = never> extends Scope<Scopes, Area2DInherited<Schemes>> {
  padding: Padding
  editor!: NodeEditor<Schemes>
  area!: AreaPlugin<Schemes, T>
  presets: Preset[] = []

  constructor(private props?: Props) {
    super('scopes')
    this.padding = props?.padding || {
      top: 40,
      left: 20,
      right: 20,
      bottom: 20
    }
  }

  // eslint-disable-next-line max-statements
  setParent(scope: Scope<Area2D<Schemes>, [Root<Schemes>]>): void {
    super.setParent(scope)

    this.area = this.parentScope<AreaPlugin<Schemes, T>>(AreaPlugin)
    this.editor = this.area.parentScope<NodeEditor<Schemes>>(NodeEditor)

    const props = { editor: this.editor, area: this.area }
    const { padding } = this
    const pickedNodes = getPickedNodes(this)
    const { translate, isTranslating } = trackedTranslate(props)

    useValidator(props)
    useOrdering(props)

    this.presets.forEach(preset => {
      preset({ padding, translate }, { ...props, scopes: this })
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

        if (parent) {
          const hasAnySelectedParent = hasSelectedParent(id, props)
          const isPicked = belongsTo(current.id, pickedNodes, props)

          if (!hasAnySelectedParent && !isPicked) {
            await resizeParent(parent, padding, translate, props)
          }
        }
      }
      if (context.type === 'noderemoved') {
        const parentId = context.data.parent
        const parent = parentId && props.editor.getNode(parentId)

        if (parent) {
          await resizeParent(parent, padding, translate, props)
        }
      }
      return context
    })
  }

  public addPreset(preset: Preset) {
    this.presets.push(preset)
  }

  public isDependent(id: NodeId) {
    const props = { editor: this.editor, area: this.area }
    const node = this.editor.getNode(id)

    return node && (node.selected || hasSelectedParent(id, props))
  }
}

export function getPickedNodes(scopes: Scope<Scopes, Area2DInherited<BaseSchemes>>) {
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
