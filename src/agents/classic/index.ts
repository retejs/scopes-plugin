import { NodeId } from 'rete'

import { getPickedNodes } from '../..'
import { reassignParent } from '../../scope'
import { Position } from '../../types'
import { AgentContext, AgentParams, ScopeAgent } from '../types'

export type DefaultScopesAgentParams = AgentParams & {
  timeout?: number
}

export const useScopeAgent: ScopeAgent = (params: DefaultScopesAgentParams, { area, editor, scopes }) => {
  const timeout = params.timeout || 250

  let picked: { timeout: number } | null = null
  let candidates: string[] = []

  function cancel() {
    if (picked) {
      window.clearTimeout(picked.timeout)
      picked = null
    }
  }

  function pick(id: NodeId) {
    const timeoutId = window.setTimeout(() => {
      const selected = editor.getNodes().filter(n => n.selected)
      const targets = selected.length
        ? selected.map(n => n.id)
        : [id]

      candidates.push(...targets)
      void scopes.emit({ type: 'scopepicked', data: { ids: targets } })
    }, timeout)

    picked = { timeout: timeoutId }
  }
  function release() {
    const list = [...candidates]

    cancel()
    candidates = []

    void scopes.emit({ type: 'scopereleased', data: { ids: list } })

    return list
  }

  area.addPipe(async context => {
    if (!context || typeof context !== 'object' || !('type' in context)) return context
    if (context.type === 'nodepicked') {
      pick(context.data.id)
    }
    if (context.type === 'nodetranslated') {
      cancel()
    }
    if (context.type === 'nodedragged') {
      const { pointer } = area.area
      const ids = release()

      await reassignParent(ids, pointer, params, { area, editor })
    }
    return context
  })
}

export function useVisualEffects<T>({ area, editor, scopes }: AgentContext<T>): void {
  const pickedNodes = getPickedNodes(scopes)
  let previousHighlighted: string | null = null
  let clientPointerPostion: Position | null = null

  // eslint-disable-next-line max-statements
  function updateHighlightedScopes(position: { x: number, y: number }, nodes: NodeId[]) {
    if (previousHighlighted) {
      const view = area.nodeViews.get(previousHighlighted)

      if (view && nodes.length) view.element.style.opacity = '0.4'
      previousHighlighted = null
    }
    if (nodes.length) {
      const { x, y } = position
      const elements = document.elementsFromPoint(x, y)
      const nodeViews = editor.getNodes().map(node => {
        const view = area.nodeViews.get(node.id)

        if (!view) throw new Error('view')

        return {
          node,
          view
        }
      })

      const intersectedNodes = elements
        .map(el => nodeViews.find(item => item.view.element === el))
        .filter((item): item is Exclude<typeof item, undefined> => Boolean(item))

      const nonSelected = intersectedNodes
        .filter(item => !item.node.selected)
      const first = nonSelected[0]

      if (first) {
        first.view.element.style.opacity = '0.8'
        previousHighlighted = first.node.id
      }
    }
  }

  scopes.addPipe(context => {
    if (context.type === 'scopepicked') {
      const { ids } = context.data

      editor.getNodes().filter(n => !ids.includes(n.id))
        .forEach(node => {
          const view = area.nodeViews.get(node.id)

          if (view) view.element.style.opacity = '0.4'
        })
      if (clientPointerPostion) updateHighlightedScopes(clientPointerPostion, pickedNodes)
    }
    if (context.type === 'scopereleased') {
      const { ids } = context.data

      editor.getNodes().filter(n => !ids.includes(n.id))
        .forEach(node => {
          const view = area.nodeViews.get(node.id)

          if (view) view.element.style.opacity = ''
        })
      if (clientPointerPostion) updateHighlightedScopes(clientPointerPostion, pickedNodes)
    }
    if (context.type === 'pointermove') {
      clientPointerPostion = {
        x: context.data.event.clientX,
        y: context.data.event.clientY
      }
      updateHighlightedScopes(clientPointerPostion, pickedNodes)
    }
    return context
  })
}
