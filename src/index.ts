import { ConnectionBase, GetSchemes, NodeBase, NodeEditor, NodeId, Scope } from 'rete'
import { Area2DInherited, AreaPlugin } from 'rete-area-plugin'

import { Padding } from './types'

export type NodeScheme = NodeBase & {
  width: number
  height: number
  parent?: NodeId
  selected?: boolean
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
        let picked: { id: string, time: number, timeout: number } | null = null
        let extractCandidates: string[] = []

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

            function updateNodeSizes(node: Schemes['Node'], width: number, height: number) {
                node.width = width
                node.height = height

                const view = props.area.nodeViews.get(node.id)

                if (!view) throw new Error('cannot find parent node view')

                const item = view.element.children.item(0) as HTMLElement

                if (item) {
                    item.style.width = `${width}px` // TODO create interface and keep performance
                    item.style.height = `${height}px`
                }
            }

            // eslint-disable-next-line max-statements
            async function resizeParent(parent: Schemes['Node']) {
                const children = props.editor.getNodes().filter(child => child.parent === parent.id)

                if (children.length === 0) {
                    updateNodeSizes(parent, 220, 120)
                    if (parent.parent) {
                        const parentsParent = props.editor.getNode(parent.parent)

                        if (parentsParent) {
                            await resizeParent(parentsParent)
                        }
                    }
                    return
                }

                const { top, left, width, height } = getNodesBBox(children)

                const outerWidth = width + padding.left + padding.right
                const outerHeight = height + padding.top + padding.bottom
                const outerTop = top - padding.top
                const outerLeft = left - padding.left

                const view = props.area.nodeViews.get(parent.id)

                if (!view) throw new Error('cannot find parent node view')

                updateNodeSizes(parent, outerWidth, outerHeight)
                lockTranslateFor.push(parent.id)
                await view.translate(outerLeft, outerTop)
                lockTranslateFor = lockTranslateFor.filter(p => p !== parent.id)

            }

            if (context.type === 'nodetranslated') {
                const { id } = context.data
                const nodes = props.editor.getNodes()
                const current = nodes.find(n => n.id === id)

                if (!current) throw new Error('cannot find node')

                //// move children

                if (!lockTranslateFor.includes(id)) {
                    const children = nodes.filter(n => n.parent === id)

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

                if (parent && !extractCandidates.includes(id)) {
                    await resizeParent(parent)
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
            if (context.type === 'nodepicked') {
                const { id } = context.data

                picked = { id, time: Date.now(), timeout: window.setTimeout(() => {
                    const selected = props.editor.getNodes().filter(n => n.selected)
                    const targets = selected.length ? selected.map(n => n.id) : [id]

                    extractCandidates.push(...targets)
                }, 500) }
            }

            if (context.type === 'nodetranslated') {
                if (picked) {
                    window.clearTimeout(picked.timeout)
                    picked = null
                }
            }

            // eslint-disable-next-line max-statements
            async function reassignParent(ids: NodeId[], pointer: { x: number, y: number }) {
                const nodes = ids
                    .map(id => props.editor.getNode(id))
                    .filter((n): n is Schemes['Node'] => Boolean(n))

                const overlayNodes = props.editor.getNodes()
                    .map(node => {
                        const view = props.area.nodeViews.get(node.id)

                        if (!view) throw new Error('node view')

                        return { node, view }
                    }).filter(({ node, view }) => {
                        return !ids.includes(node.id)
                            && pointer.x > view.position.x
                            && pointer.y > view.position.y
                            && pointer.x < view.position.x + node.width
                            && pointer.y < view.position.y + node.height
                    })
                const areaElements = Array.from(props.area.area.element.childNodes)
                const overlayNodesWithIndex = overlayNodes.map(({ node, view }) => {
                    const index = areaElements.indexOf(view.element)

                    return { node, view, index }
                })

                overlayNodesWithIndex.sort((a, b) => b.index - a.index)
                const topOverlayParent = overlayNodesWithIndex[0]

                const formerParents = nodes
                    .map(node => node.parent)
                    .filter((id): id is string => Boolean(id))
                    .map(id => {
                        const node = props.editor.getNode(id)

                        if (!node) throw new Error('node')

                        return node
                    })

                // eslint-disable-next-line no-undefined
                nodes.forEach(node => node.parent = undefined)
                if (topOverlayParent) {
                    console.log(topOverlayParent.view.element)
                    nodes.forEach(node => node.parent = topOverlayParent.node.id)
                    await resizeParent(topOverlayParent.node)
                }

                for (const formerParent of formerParents) {
                    await resizeParent(formerParent)
                }
            }

            if (context.type === 'nodedragged') {
                if (picked) {
                    window.clearTimeout(picked.timeout)
                    picked = null
                }
                if (extractCandidates.length) {
                    await reassignParent([...extractCandidates], props.area.area.pointer)
                    extractCandidates = []
                }
            }

            return context
        })
    }
}
