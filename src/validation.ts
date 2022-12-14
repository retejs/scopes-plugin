import { NodeEditor } from 'rete'
import { AreaPlugin } from 'rete-area-plugin'

import { ExpectedScheme } from './types'

type Props<T> = { editor: NodeEditor<ExpectedScheme>, area: AreaPlugin<ExpectedScheme, T> }

export function useValidator<T>(props: Props<T>) {
    // eslint-disable-next-line max-statements
    props.area.addPipe(context => {
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
        return context
    })
}
