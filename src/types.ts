import { ConnectionBase, GetSchemes, NodeBase, NodeId } from 'rete'

export type Padding = {
  top: number,
  left: number,
  right: number,
  bottom: number
}

export type NodeScheme = NodeBase & {
  width: number
  height: number
  parent?: NodeId
  selected?: boolean
}

export type ExpectedScheme = GetSchemes<NodeScheme, ConnectionBase>

export type Position = { x: number, y: number }
