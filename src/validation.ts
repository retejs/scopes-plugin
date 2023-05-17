import { NodeEditor } from 'rete'
import { BaseAreaPlugin } from 'rete-area-plugin'

import { ExpectedScheme } from './types'
import { watchClearing } from './utils'

type Props<T> = { editor: NodeEditor<ExpectedScheme>, area: BaseAreaPlugin<ExpectedScheme, T> }

export function useValidator<T>(props: Props<T>) {
  const isClearing = watchClearing(props.editor)

  // eslint-disable-next-line max-statements
  props.area.addPipe(context => {
    if (!context || !(typeof context === 'object' && 'type' in context)) return context
    if (context.type === 'nodecreate') {
      const parentId = context.data.parent

      if (parentId) {
        const parent = props.editor.getNodes().find(n => n.id === parentId)

        if (!parent) throw new Error('parent node doesnt exist')
      }
    }
    if (context.type === 'noderemove' && !isClearing()) {
      const { id } = context.data

      const child = props.editor.getNodes().find(n => n.parent === id)

      if (child) throw new Error('cannot remove parent node with a children')
    }
    return context
  })
}
