# AI Animator (bring your own key)

The Dashboard sidebar places AI Animator / New directly below PNG to SVG. Users upload a PNG, JPG or SVG logo, choose OpenAI / Claude / Google Gemini, enter their provider key and describe the motion. A successful model response is validated and compiled to normal Vekto keyframes. Users can refine the last plan, replay the preview, download animated SVG / Lottie JSON or open the animation in the existing editor.

## Credentials and data flow

- API keys live only in mounted React component state. Changing provider, clearing the key, leaving the tool or reloading removes the key from the tool. No localStorage/sessionStorage, database, project field or application log receives it.
- Generate sends a normalized PNG logo preview, prompt and optional previous plan to authenticated POST /api/ai-animator. The key travels in X-Vekto-AI-Key, then only in the selected provider's authentication header. HTTPS is required in Production.
- The server has a fixed provider host allowlist; no client-specified base URL or redirect is allowed. It does not use Vekto's configured platform AI keys. Firebase authentication and server-confirmed paid or enrolled Free access are required.
- Provider charges use the user's account. Provider retention policies still apply. OpenAI requests explicitly use store:false. No real customer key or paid provider call was used during automated validation.
- Provider errors are replaced with safe messages. Raw response bodies/headers, user keys and generated code are never echoed. JSON settings are validated on both server and client. Response text is never executed or mounted as HTML.

## Supported results

Fade, slide, bounce, spin and pulse with 1–10-second duration, controlled intensity, optional stagger, loop and transparent/white/dark backgrounds. Whole-logo motion is the default, preserving layer colors and geometry. This is constrained AI-directed motion, not arbitrary generated video, 3D or logo redesign. The AI only selects supported motion parameters.

Basic SVG paths remain vectors. PNG/JPG and complex SVG styling are rasterized/traced, with a visible fidelity notice. Inputs are capped at 8 MB / 16 megapixels; preview inputs at 1024 pixels per side. Editable logos have at most 500 shapes. External SVG resources/scripts are rejected. The original logo is retained only when the user saves the resulting project.

Single-play SVG animations freeze at the final frame. Lottie looping is controlled by the consuming player. Project creation uses the existing createProject path, so Open in Editor uses one Free project slot and cannot bypass the three-project cap. Upload/previews do not create hidden library projects.

## Deployment and testing

No platform AI environment key is required. Deploy api/ai-animator.mjs with the frontend; Vercel route and function timeout are configured. The local server, Vite dev and preview include the same middleware. Existing Firestore rules and billing architecture are unchanged. Default model IDs can be changed by users for their provider account; provider availability/credits determine access.

Run npm run test:ai-animator, npm run typecheck and npm run build. Tests cover authenticated BYOK, all provider adapters, safe provider errors, prompt/schema validation, fixed hosts, cancellation, follow-up prompts, logo preservation, loop seams, animated exports and editor project creation. Provider calls are simulated; no real keys or API charges are used. In-flight concurrency protection is process-local, not a distributed quota.

Provider request formats follow [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Claude Messages](https://platform.claude.com/docs/en/api/messages/create), [Claude structured output](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) and [Gemini image inputs](https://ai.google.dev/gemini-api/docs/image-understanding).
