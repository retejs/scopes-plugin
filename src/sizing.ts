import { NodeEditor } from 'rete'
import { BaseAreaPlugin } from 'rete-area-plugin'

import { AgentParams } from './agents/types'
import { ExpectedScheme } from './types'

type Props<T> = { editor: NodeEditor<ExpectedScheme>, area: BaseAreaPlugin<ExpectedScheme, T> }

export function getNodesBoundingBox<T>(nodes: ExpectedScheme['Node'][], { area }: Props<T>) {
  const boxes = nodes.map(node => {
    const view = area.nodeViews.get(node.id)

    if (!view) throw new Error('view')

    return {
      position: view.position,
      width: node.width,
      height: node.height
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

type Size = { width: number, height: number }

export function updateNodeSizes<T>(node: ExpectedScheme['Node'], size: Size, { area }: Props<T>) {
  const { width, height } = size

  node.width = width
  node.height = height

  area.resize(node.id, width, height)
}

// eslint-disable-next-line max-statements
export async function resizeParent<T>(parent: ExpectedScheme['Node'], agentParams: AgentParams, props: Props<T>) {
  const { id } = parent
  const padding = agentParams.padding(id)

  if (children.length === 0) {
    updateNodeSizes(parent, { width: 220, height: 120 }, props)
  } else {
    const { top, left, width, height } = getNodesBoundingBox(children, props)

    const outerWidth = width + padding.left + padding.right
    const outerHeight = height + padding.top + padding.bottom
    const outerTop = top - padding.top
    const outerLeft = left - padding.left

    updateNodeSizes(parent, { width: outerWidth, height: outerHeight }, props)
    await agentParams.translate(parent.id, outerLeft, outerTop)
  }
  if (parent.parent) {
    const parentsParent = props.editor.getNode(parent.parent)

    if (parentsParent) {
      await resizeParent(parentsParent, agentParams, props)
    }
  }
}
