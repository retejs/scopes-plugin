import { ConnectionId, NodeEditor, NodeId } from 'rete'
import { AreaPlugin } from 'rete-area-plugin'

import { ExpectedScheme } from './types'

type Props<T> = { editor: NodeEditor<ExpectedScheme>, area: AreaPlugin<ExpectedScheme, T> }

function bringConnectionForward<T>(id: ConnectionId, props: Props<T>) {
    const view = props.area.connectionViews.get(id)

    if (view) {
        props.area.area.appendChild(view)
    }
}

function bringConnectionBack<T>(id: ConnectionId, props: Props<T>) {
    const view = props.area.connectionViews.get(id)

    if (view) {
        props.area.area.element.prepend(view)
    }
}

function bringForward<T>(nodeId: NodeId, props: Props<T>) {
    const view = props.area.nodeViews.get(nodeId)

    if (view) {
        props.area.area.appendChild(view.element)
    }

    const connections = props.editor.getConnections().filter(c => {
        return nodeId === c.source || nodeId === c.target
    })
    const children = props.editor.getNodes().filter(n => {
        return n.parent === nodeId
    })

    connections.forEach(connection => bringConnectionForward(connection.id, props))
    children.forEach(child => bringForward(child.id, props))
}

export function useOrdering<T>(props: Props<T>) {
    // eslint-disable-next-line max-statements
    props.area.addPipe(async context => {
        if (!('type' in context)) return context
        if (context.type === 'nodepicked') {
            bringForward(context.data.id, props)
        }
        if (context.type === 'connectioncreated') {
            const { id } = context.data
            const connection = props.editor.getConnection(id)

            if (!connection) throw new Error('connection was removed')
            bringConnectionBack(context.data.id, props)
            bringForward(connection.source, props)
            bringForward(connection.target, props)
        }
        return context
    })
}
