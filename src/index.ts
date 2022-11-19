import { ConnectionBase, GetSchemes, NodeBase, NodeEditor, NodeId, Scope } from 'rete'
import { Area2DInherited, AreaPlugin } from 'rete-area-plugin'

import { Padding } from './types'

export type NodeScheme = NodeBase & {
  width: number
  height: number
  parent?: NodeId
}

export type BaseSchemes = GetSchemes<NodeScheme, ConnectionBase>

export class ScopesPlugin<Schemes extends BaseSchemes, T> extends Scope<never, Area2DInherited<Schemes>> {
    constructor(props: { area: AreaPlugin<Schemes, T>, editor: NodeEditor<Schemes>, padding?: Padding }) {
        super('scopes')
        const padding: Padding = props.padding || {
            top: 40,
            left: 20,
            right: 20,
            bottom: 20
        }
        let lockTranslateFor: string[] = []

        function connectionToTop(id: string) {
            const view = props.area.connectionViews.get(id)

            if (view) {
                props.area.area.appendChild(view)
            }
        }
        function toTop(nodeId: NodeId) {
            const view = props.area.nodeViews.get(nodeId)

            if (view) {
                props.area.area.appendChild(view.element)
            }

            const connections = props.editor.getConnections()
                .filter(c => nodeId === c.source || nodeId === c.target)

            connections.forEach(connection => connectionToTop(connection.id))
            props.editor.getNodes().filter(n => n.parent === nodeId).forEach(child => {
                toTop(child.id)
            })
        }

        function getNodesBBox(nodes: Schemes['Node'][]) {
            const boxes = nodes
                .map(c => {
                    const view = props.area.nodeViews.get(c.id)

                    if (!view) throw new Error('view')

                    return {
                        position: view.position,
                        width: c.width,
                        height: c.height
                    }
                })

            const left = Math.min(...boxes.map(b => b.position.x))
            const right = Math.max(...boxes.map(b => b.position.x + b.width))
            const top = Math.min(...boxes.map(b => b.position.y))
            const bottom = Math.max(...boxes.map(b => b.position.y + b.height))
            const width = right - left
            const height = bottom - top

            return {
                top,
                left,
                right,
                bottom,
                width,
                height
            }
        }

        // eslint-disable-next-line max-statements
        this.addPipe(async context => {
            if (!('type' in context)) return context

            if (context.type === 'nodecreate') {
                const parentId = context.data.parent

                if (parentId) {
                    const parent = props.editor.getNodes().find(n => n.id === parentId)

                    if (!parent) throw new Error('parent node doesnt exist')
                }
            }
            if (context.type === 'noderemove') {
                const { id } = context.data

                const child = props.editor.getNodes().find(n => n.parent === id)

                if (child) throw new Error('cannot remove parent node with a children')
            }
            if (context.type === 'nodepicked') {
                toTop(context.data.id)
            }
            if (context.type === 'connectioncreated') {
                const view = props.area.connectionViews.get(context.data.id)

                if (view) {
                    props.area.area.element.prepend(view)
                }
            }
            if (context.type === 'nodetranslated') {
                const nodes = props.editor.getNodes()
                const current = nodes.find(n => n.id === context.data.id)

                if (!current) throw new Error('cannot find node')

                //// move children

                if (!lockTranslateFor.includes(context.data.id)) {
                    const children = nodes.filter(n => n.parent === context.data.id)

                    await Promise.all(children.map(async n => {
                        const dx = context.data.position.x - context.data.previous.x
                        const dy = context.data.position.y - context.data.previous.y

                        const view = props.area.nodeViews.get(n.id)

                        if (view) {
                            const nodePosition = view.position

                            await view.translate(nodePosition.x + dx, nodePosition.y + dy)
                        }
                    }))
                }

                //// fit parent

                const parent = nodes.find(n => n.id === current.parent)

                if (parent) {
                    const parentChildren = nodes.filter(child => child.parent === parent.id)
                    const { top, left, width, height } = getNodesBBox(parentChildren)

                    const outerWidth = width + padding.left + padding.right
                    const outerHeight = height + padding.top + padding.bottom
                    const outerTop = top - padding.top
                    const outerLeft = left - padding.left

                    parent.width = outerWidth
                    parent.height = outerHeight

                    const view = props.area.nodeViews.get(parent.id)

                    if (view) {
                        const i = view.element.children.item(0) as HTMLElement

                        if (i) {
                            i.style.width = `${outerWidth}px`
                            i.style.height = `${outerHeight}px`

                            lockTranslateFor.push(parent.id)
                            await view.translate(outerLeft, outerTop)
                            lockTranslateFor = lockTranslateFor.filter(p => p !== parent.id)
                        }
                    }
                }
            }
            if (context.type === 'connectioncreated') {
                const { id } = context.data
                const connection = props.editor.getConnection(id)

                if (connection) {
                    toTop(connection.source)
                    toTop(connection.target)
                }
            }

            return context
        })
    }
}
