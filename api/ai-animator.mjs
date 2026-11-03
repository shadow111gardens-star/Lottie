import { createAiAnimatorApi } from '../server/ai-animator.mjs';
const app=createAiAnimatorApi();
export default function handler(req,res){return app(req,res);}
