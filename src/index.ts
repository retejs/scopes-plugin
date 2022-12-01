import { BaseSchemes, NodeEditor, NodeId, Root, Scope } from 'rete'
import { Area2D, Area2DInherited, AreaPlugin } from 'rete-area-plugin'

import { classic } from './agents'
import { ScopeAgent } from './agents/types'
import { useOrdering } from './ordering'
import { translateChildren } from './scope'
import { resizeParent } from './sizing'
import { ExpectedScheme, Padding } from './types'
import { belongsTo, hasSelectedParent, trackedTranslate } from './utils'
import { useValidator } from './validation'

type Props = {
    padding?: Padding
    agent?: ScopeAgent
}

export type Scopes =
    | { type: 'scopepicked', data: { ids: NodeId[] } }
    | { type: 'scopereleased', data: { ids: NodeId[] } }

export class ScopesPlugin<Schemes extends ExpectedScheme, T = never> extends Scope<Scopes, Area2DInherited<Schemes>> {
    padding: Padding

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

        const area = this.parentScope<AreaPlugin<Schemes, T>>(AreaPlugin)
        const editor = area.parentScope<NodeEditor<Schemes>>(NodeEditor)
        const props = { editor, area }
        const { padding } = this
        const pickedNodes = getPickedNodes(this)
        const { translate, isTranslating } = trackedTranslate(props)

        useValidator(props)
        useOrdering(props)

        if (this.props?.agent) {
            this.props.agent({ padding, translate }, { ...props, scopes: this })
        } else {
            classic.useScopeAgent({ padding, translate }, { ...props, scopes: this })
            classic.useVisualEffects({ ...props, scopes: this })
        }

        // eslint-disable-next-line max-statements
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
                    const isPicked = belongsTo(id, pickedNodes, props)

                    if (!parent.selected && !hasAnySelectedParent && !isPicked) {
                        await resizeParent(parent, padding, translate, props)
                    }
                }
            }
            return context
        })
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
