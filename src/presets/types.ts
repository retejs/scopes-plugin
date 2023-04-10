import { AgentContext, AgentParams } from '../agents/types'

export type Preset = (params: AgentParams, context: AgentContext<unknown>) => void
