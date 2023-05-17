import { NodeEditor, Root, Scope } from 'rete'
import { BaseArea, BaseAreaPlugin } from 'rete-area-plugin'

import { Scopes } from '..'
import { ExpectedScheme, Padding } from '../types'
import { Translate } from '../utils'

export type AgentContext<T> = {
  editor: NodeEditor<ExpectedScheme>
  area: BaseAreaPlugin<ExpectedScheme, BaseArea<ExpectedScheme> | T>
  scopes: Scope<Scopes, [BaseArea<ExpectedScheme>, Root<ExpectedScheme>]>
}
export type AgentParams = { padding: Padding, translate: Translate }

export type ScopeAgent = <T>(params: AgentParams, context: AgentContext<T>) => void
