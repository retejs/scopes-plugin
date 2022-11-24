import { BaseSchemes, NodeEditor, Scope } from 'rete'
import { Area2DInherited, AreaPlugin } from 'rete-area-plugin'

import { Scopes } from '..'
import { ExpectedScheme, Padding } from '../types'
import { Translate } from '../utils'

export type AgentContext<T> = {
  editor: NodeEditor<ExpectedScheme>
  area: AreaPlugin<ExpectedScheme, T>
  scopes: Scope<Scopes, Area2DInherited<BaseSchemes>>
}
export type AgentParams = { padding: Padding, translate: Translate }

export type ScopeAgent = <T>(params: AgentParams, context: AgentContext<T>) => void
