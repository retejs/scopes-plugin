import { NodeEditor, NodeId } from 'rete'
import { AreaPlugin } from 'rete-area-plugin'

import { resizeParent } from './sizing'
import { ExpectedScheme, Padding, Position } from './types'
import { Translate } from './utils'

type Props<T> = { editor: NodeEditor<ExpectedScheme>, area: AreaPlugin<ExpectedScheme, T> }

// eslint-disable-next-line max-statements, max-len
export async function reassignParent<T>(ids: NodeId[], pointer: { x: number, y: number }, padding: Padding, translate: Translate, props: Props<T>) {
  if (!ids.length) return
  const nodes = ids
    .map(id => props.editor.getNode(id))
    .filter((n): n is ExpectedScheme['Node'] => Boolean(n))

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
  const areaElements = Array.from(props.area.area.content.holder.childNodes)
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
    nodes.forEach(node => node.parent = topOverlayParent.node.id)
    await resizeParent(topOverlayParent.node, padding, translate, props)
  }

  for (const formerParent of formerParents) {
    await resizeParent(formerParent, padding, translate, props)
  }
}

export async function translateChildren<T>(id: NodeId, { position, previous }: { position: Position, previous: Position }, props: Props<T>) {
  const children = props.editor.getNodes().filter(n => n.parent === id)

  await Promise.all(children.map(async n => {
    const dx = position.x - previous.x
    const dy = position.y - previous.y

    const view = props.area.nodeViews.get(n.id)
    const node = props.editor.getNode(n.id)

    if (view && node && !node.selected) {
      const nodePosition = view.position

      await view.translate(nodePosition.x + dx, nodePosition.y + dy)
    }
  }))
}
