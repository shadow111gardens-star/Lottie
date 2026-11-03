export type FacialBox = {x:number;y:number;width:number;height:number};
export type FacialMotion = {enabled:boolean;blink:boolean;speak:boolean;eyes:FacialBox;mouth:FacialBox};
export type AnimationPlan = {title:string;description:string;effect:'fade'|'slide'|'bounce'|'spin'|'pulse';direction:'up'|'down'|'left'|'right';duration:number;intensity:number;stagger:number;loop:boolean;background:'transparent'|'white'|'dark';facialMotion:FacialMotion};
export const providers: Record<'openai'|'anthropic'|'gemini',{name:string;model:string}>;
export const animationSchema: Record<string,unknown>;
export function validateAnimationPlan(value:unknown): AnimationPlan;
