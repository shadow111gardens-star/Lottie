export const providers = { openai: { name: 'OpenAI', model: 'gpt-4.1-mini' }, anthropic: { name: 'Claude', model: 'claude-sonnet-5-5' }, gemini: { name: 'Google Gemini', model: 'gemini-3.8-flash' } };
export const animationSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    title: {type:'string'}, description: {type:'string'},
    effect: {type:'string',enum:['fade','slide','bounce','spin','pulse']},
    direction: {type:'string',enum:['up','down','left','right']},
    duration: {type:'number'}, intensity: {type:'number'}, stagger: {type:'number'},
    loop: {type:'boolean'}, background: {type:'string',enum:['transparent','white','dark']},
    facialMotion: {type:'object',additionalProperties:false,properties:{enabled:{type:'boolean'},blink:{type:'boolean'},speak:{type:'boolean'},eyes:{type:'object',additionalProperties:false,properties:{x:{type:'number'},y:{type:'number'},width:{type:'number'},height:{type:'number'}},required:['x','y','width','height']},mouth:{type:'object',additionalProperties:false,properties:{x:{type:'number'},y:{type:'number'},width:{type:'number'},height:{type:'number'}},required:['x','y','width','height']}},required:['enabled','blink','speak','eyes','mouth']}
  },
  required: ['title','description','effect','direction','duration','intensity','stagger','loop','background','facialMotion']
};
const noFacialMotion=()=>({enabled:false,blink:false,speak:false,eyes:{x:0,y:0,width:0,height:0},mouth:{x:0,y:0,width:0,height:0}});
export function validateAnimationPlan(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k=>!animationSchema.required.includes(k))) throw new Error('The AI returned an unsupported animation plan. Try a more specific prompt.');
  const normalized={...value,facialMotion:value.facialMotion??noFacialMotion()};
  for (const [key, spec] of Object.entries(animationSchema.properties)) {
    if (typeof normalized[key] !== spec.type || (spec.enum && !spec.enum.includes(normalized[key]))) throw new Error('The AI returned an invalid animation plan. Please retry.');
  }
  const motion=normalized.facialMotion;
  const boxShape=box=>!!box&&typeof box==='object'&&!Array.isArray(box)&&Object.keys(box).every(key=>['x','y','width','height'].includes(key))&&['x','y','width','height'].every(key=>typeof box[key]==='number'&&Number.isFinite(box[key])&&box[key]>=0&&box[key]<=1)&&box.x+box.width<=1&&box.y+box.height<=1;
  const rect=box=>boxShape(box)&&box.width>0&&box.height>0;
  const zeroBox=box=>boxShape(box)&&box.width===0&&box.height===0;
  if(!motion||typeof motion!=='object'||Array.isArray(motion)||Object.keys(motion).some(key=>!['enabled','blink','speak','eyes','mouth'].includes(key))||typeof motion.enabled!=='boolean'||typeof motion.blink!=='boolean'||typeof motion.speak!=='boolean'||!boxShape(motion.eyes)||!boxShape(motion.mouth)||(motion.enabled&&(!motion.blink&&!motion.speak||motion.blink&&!rect(motion.eyes)||motion.speak&&!rect(motion.mouth)))||(!motion.enabled&&(motion.blink||motion.speak||!zeroBox(motion.eyes)||!zeroBox(motion.mouth))))throw new Error('The AI returned invalid facial motion regions. Please retry with a face-focused prompt.');
  if (!value.title.trim() || value.title.length>80 || !value.description.trim() || value.description.length>500 || !Number.isFinite(value.duration) || value.duration<1 || value.duration>10 || !Number.isFinite(value.intensity) || value.intensity<0 || value.intensity>1 || !Number.isFinite(value.stagger) || value.stagger<0 || value.stagger>0.5) throw new Error('The AI animation settings are out of range. Please retry.');
  return Object.fromEntries(animationSchema.required.map(key=>[key,normalized[key]]));
}
