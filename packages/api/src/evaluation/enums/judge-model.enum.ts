export enum JudgeModel {
  GEMINI_2_5_PRO = 'gemini-2.5-pro-preview-06-05',
  GEMINI_2_5_FLASH = 'gemini-2.5-flash-preview-05-20',
  GPT_4O = 'gpt-4o',
  GPT_4O_MINI = 'gpt-4o-mini',
  CLAUDE_3_OPUS = 'claude-3-opus-20240229',
  CLAUDE_3_5_SONNET = 'claude-3-5-sonnet-20241022',
  CLAUDE_3_HAIKU = 'claude-3-haiku-20240307',
  LOCAL_VLLM = 'local-vllm',
  LOCAL_OLLAMA = 'local-ollama',
}

export const JUDGE_MODEL_PROVIDERS: Record<JudgeModel, string> = {
  [JudgeModel.GEMINI_2_5_PRO]: 'google',
  [JudgeModel.GEMINI_2_5_FLASH]: 'google',
  [JudgeModel.GPT_4O]: 'openai',
  [JudgeModel.GPT_4O_MINI]: 'openai',
  [JudgeModel.CLAUDE_3_OPUS]: 'anthropic',
  [JudgeModel.CLAUDE_3_5_SONNET]: 'anthropic',
  [JudgeModel.CLAUDE_3_HAIKU]: 'anthropic',
  [JudgeModel.LOCAL_VLLM]: 'local',
  [JudgeModel.LOCAL_OLLAMA]: 'local',
};

export const DEFAULT_JUDGE_MODEL = JudgeModel.GEMINI_2_5_PRO;
