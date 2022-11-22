import { NodeEditor, Scope } from 'rete'
import { Area2DInherited, AreaPlugin } from 'rete-area-plugin'

import { moveBetweenScopes } from './flows'
import { useOrdering } from './ordering'
import { reassignParent, translateChildren } from './scope'
import { resizeParent } from './sizing'
import { ExpectedScheme, Padding } from './types'
import { belongsTo, trackedTranslate } from './utils'
import { useValidator } from './validation'

type Props<Schemes extends ExpectedScheme, T> = {
    area: AreaPlugin<Schemes, T>
    editor: NodeEditor<Schemes>
    padding?: Padding
}

export class ScopesPlugin<Schemes extends ExpectedScheme, T> extends Scope<never, Area2DInherited<Schemes>> {
    constructor(props: Props<Schemes, T>) {
        super('scopes')
        const padding: Padding = props.padding || {
            top: 40,
            left: 20,
            right: 20,
            bottom: 20
        }
        const { translate, isTranslating } = trackedTranslate(props)
        const { pick, cancel, release, getPicked } = moveBetweenScopes(props)

        useValidator(props)
        useOrdering(props)

        // eslint-disable-next-line max-statements
        this.addPipe(async context => {
            if (!('type' in context)) return context
            if (context.type === 'nodetranslated') {
                const { id } = context.data
                const current = props.editor.getNode(id)

                if (!current) throw new Error('cannot find node')
                // prevent translating children if the node translation
                // is triggered by its resizing (when its children moved)
                if (!isTranslating(id)) {
                    await translateChildren(id, context.data, props)
                }

                const parent = current.parent ? props.editor.getNode(current.parent) : null

                if (parent && !parent.selected && !belongsTo(id, getPicked(), props)) {
                    await resizeParent(parent, padding, translate, props)
                }
            }
            if (context.type === 'nodepicked') {
                pick(context.data.id)
            }
            if (context.type === 'nodetranslated') {
                cancel()
            }
            if (context.type === 'nodedragged') {
                const { pointer } = props.area.area
                const ids = release()

                await reassignParent(ids, pointer, padding, translate, props)
            }

            return context
        })
    }
}
