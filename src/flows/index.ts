import { NodeEditor, NodeId } from 'rete'
import { AreaPlugin } from 'rete-area-plugin'

import { ExpectedScheme } from '../types'

type Props<T> = { editor: NodeEditor<ExpectedScheme>, area: AreaPlugin<ExpectedScheme, T> }

export function moveBetweenScopes<T>(props: Props<T>) {
    let picked: { timeout: number } | null = null
    let candidates: string[] = []

    function getPicked() {
        return [...candidates]
    }
    function cancel() {
        if (picked) {
            window.clearTimeout(picked.timeout)
            picked = null
        }
    }

    return {
        pick(id: NodeId) {
            const timeout = window.setTimeout(() => {
                const selected = props.editor.getNodes().filter(n => n.selected)
                const targets = selected.length ? selected.map(n => n.id) : [id]

                candidates.push(...targets)
            }, 250)

            picked = { timeout }
        },
        release() {
            const list = getPicked()

            cancel()
            candidates = []

            return list
        },
        getPicked,
        cancel
    }
}
