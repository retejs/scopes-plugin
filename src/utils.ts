import { NodeEditor, NodeId } from 'rete'
import { AreaPlugin } from 'rete-area-plugin'

import { ExpectedScheme } from './types'

type Props<T> = { editor: NodeEditor<ExpectedScheme>, area: AreaPlugin<ExpectedScheme, T> }

export function belongsTo<T>(nodeId: NodeId, ids: NodeId[], props: Props<T>) {
    const node = props.editor.getNode(nodeId)

    if (!node) throw new Error('node')

    if (ids.includes(nodeId)) return true
    if (!node.parent) return false
    if (belongsTo(node.parent, ids, props)) return true
}

export function hasSelectedParent<T>(nodeId: NodeId, props: Props<T>): boolean {
    const node = props.editor.getNode(nodeId)

    if (!node) throw new Error('node')

    if (!node.parent) return false

    const parent = props.editor.getNode(node.parent)

    if (!parent) throw new Error('node')

    if (parent.selected) return true

    return hasSelectedParent(node.parent, props)
}

export type Translate = (nodeId: string, x: number, y: number) => Promise<void>

/**
 * keep track of currently moving nodes (to prevent infinite loop)
 */
export function trackedTranslate<T>(props: Props<T>): {
    translate: Translate,
    isTranslating: (id: NodeId) => boolean
} {
    const active = new Map<NodeId, number>()
    const increment = (id: NodeId) => active.set(id, (active.get(id) || 0) + 1)
    const decrement = (id: NodeId) => active.set(id, (active.get(id) || 0) - 1)

    return {
        async translate(id, x, y) {
            const view = props.area.nodeViews.get(id)

            if (!view) throw new Error('cannot find parent node view')

            const previous = view.position

            if (previous.x !== x || previous.y !== y) {
                increment(id)
                await view.translate(x, y)
                decrement(id)
            }
        },
        isTranslating(id) {
            return (active.get(id) || 0) > 0
        }
    }
}
