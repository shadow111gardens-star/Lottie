export const providers = { openai: { name: 'OpenAI', model: 'gpt-4.1-mini' }, anthropic: { name: 'Claude', model: 'claude-sonnet-5-5' }, gemini: { name: 'Google Gemini', model: 'gemini-3.8-flash' } };
export const animationSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    title: {type:'string'}, description: {type:'string'},
    effect: {type:'string',enum:['fade','slide','bounce','spin','pulse']},
    direction: {type:'string',enum:['up','down','left','right']},
    duration: {type:'number'}, intensity: {type:'number'}, stagger: {type:'number'},
    loop: {type:'boolean'}, background: {type:'string',enum:['transparent','white','dark']}
  },
  required: ['title','description','effect','direction','duration','intensity','stagger','loop','background']
};
export function validateAnimationPlan(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k=>!animationSchema.required.includes(k))) throw new Error('The AI returned an unsupported animation plan. Try a more specific prompt.');
  for (const [key, spec] of Object.entries(animationSchema.properties)) {
    if (typeof value[key] !== spec.type || (spec.enum && !spec.enum.includes(value[key]))) throw new Error('The AI returned an invalid animation plan. Please retry.');
  }
  if (!value.title.trim() || value.title.length>80 || !value.description.trim() || value.description.length>500 || !Number.isFinite(value.duration) || value.duration<1 || value.duration>10 || !Number.isFinite(value.intensity) || value.intensity<0 || value.intensity>1 || !Number.isFinite(value.stagger) || value.stagger<0 || value.stagger>0.5) throw new Error('The AI animation settings are out of range. Please retry.');
  return Object.fromEntries(animationSchema.required.map(key=>[key,value[key]]));
}
