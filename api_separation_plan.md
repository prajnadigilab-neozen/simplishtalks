# Implementation Plan - Separate API Keys for SIMPLISH Talks & SNEHI

This guide outlines the step-by-step process and codebase modifications required to separate the Gemini API keys between **SIMPLISH Talks** (conversational chatbot, grammar, speech evaluation, and Text-to-Speech) and **SIMPLISH SNEHI** (scenario practice, voice coach sessions). 

This allows independent billing tracking, separate rate limit management, and compartmentalized key rotation on Google AI Studio.

---

## 1. Environment Configuration

We will introduce separate environment variables while keeping the existing `GEMINI_API_KEY` as a global fallback.

### Variable Mapping

| Component | Features | Client / Edge Function | Target Environment Variable |
| :--- | :--- | :--- | :--- |
| **Global Fallback** | General default / developer mode | All | `GEMINI_API_KEY` |
| **SIMPLISH Talks** | Coach Chat, Speech Evaluation, Placement, TTS, Lesson Gen | Edge Functions (`coach-chat`, `evaluate`, `tts`) | `GEMINI_API_KEY_TALKS` |
| **SIMPLISH SNEHI** | Scenario Practice Chat, Voice Coach (Gemini Live) | Client Hook (`useGeminiLive`) & Edge Functions (`scenario-chat`, `evaluate` scorecard/custom scenario) | `GEMINI_API_KEY_SNEHI` / `VITE_GEMINI_API_KEY_SNEHI` |

### Step 1.1: Update `.env.local`
Add the new keys to your local configuration:
```env
# Talks API Key (Used for Chat Coach, TTS, Placement & Speech Evaluation)
GEMINI_API_KEY_TALKS=AIzaSy...talks_key...

# Snehi API Key (Used for Scenario Practice & Gemini Live Voice Coach)
GEMINI_API_KEY_SNEHI=AIzaSy...snehi_key...
VITE_GEMINI_API_KEY_SNEHI=AIzaSy...snehi_key...
```

### Step 1.2: Set Supabase Production Secrets
Set the keys on the Supabase Edge Runtime using the CLI:
```bash
supabase secrets set GEMINI_API_KEY_TALKS="AIzaSy...talks_key..." GEMINI_API_KEY_SNEHI="AIzaSy...snehi_key..."
```

---

## 2. Codebase Implementation

### Component 2.1: Client-Side Voice Coach (SNEHI)
Update [useGeminiLive.ts](file:///d:/Prajna/Projects/simplishtalks/hooks/useGeminiLive.ts#L119) to prioritize the SNEHI client-side key:

```diff
-            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
+            const ai = new GoogleGenAI({ 
+                apiKey: import.meta.env.VITE_GEMINI_API_KEY_SNEHI || import.meta.env.VITE_GEMINI_API_KEY 
+            });
```

---

### Component 2.2: Supabase Edge Functions

#### 1. `coach-chat` (Talks Package)
Update [coach-chat/index.ts](file:///d:/Prajna/Projects/simplishtalks/supabase/functions/coach-chat/index.ts#L8):

```diff
-const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
+const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY_TALKS') || Deno.env.get('GEMINI_API_KEY')!;
```

#### 2. `scenario-chat` (Snehi Package)
Update [scenario-chat/index.ts](file:///d:/Prajna/Projects/simplishtalks/supabase/functions/scenario-chat/index.ts#L8):

```diff
-const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
+const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY_SNEHI') || Deno.env.get('GEMINI_API_KEY')!;
```

#### 3. `tts` (Talks Package)
Update [tts/index.ts](file:///d:/Prajna/Projects/simplishtalks/supabase/functions/tts/index.ts#L8):

```diff
-const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
+const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY_TALKS') || Deno.env.get('GEMINI_API_KEY')!;
```

#### 4. `evaluate` (Shared Functions Router)
Since the `evaluate` edge function routes both **Talks** and **Snehi** features, it must dynamically inject the correct key.

Update [evaluate/index.ts](file:///d:/Prajna/Projects/simplishtalks/supabase/functions/evaluate/index.ts):

##### A. Configure Key Selectors:
```typescript
const GLOBAL_FALLBACK = Deno.env.get('GEMINI_API_KEY')!;
const GEMINI_API_KEY_TALKS = Deno.env.get('GEMINI_API_KEY_TALKS') || GLOBAL_FALLBACK;
const GEMINI_API_KEY_SNEHI = Deno.env.get('GEMINI_API_KEY_SNEHI') || GLOBAL_FALLBACK;
```

##### B. Refactor `callGemini` to accept the key parameter:
```typescript
async function callGemini(model: string, contents: any, config: any, apiKey: string) {
    if (!apiKey) {
        throw new Error('Gemini API Key is missing.');
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    ...
}
```

##### C. Pass the key from handler functions:
```typescript
async function handlePlacement(body: any, apiKey: string) {
    ...
    const result = await callGemini(PRIMARY_MODEL, contents, config, apiKey);
    ...
}

async function handleSpeech(body: any, apiKey: string) {
    ...
    const result = await callGemini(PRIMARY_MODEL, [contents], config, apiKey);
    ...
}

async function handleGenerateLesson(body: any, apiKey: string) {
    ...
    const result = await callGemini(PRIMARY_MODEL, contents, config, apiKey);
    ...
}

async function handleSnehiScorecard(body: any, apiKey: string) {
    ...
    const result = await callGemini(PRIMARY_MODEL, contents, config, apiKey);
    ...
}

async function handleGenerateCustomScenario(body: any, apiKey: string) {
    ...
    const result = await callGemini(PRIMARY_MODEL, contents, config, apiKey);
    ...
}
```

##### D. Update Request Router inside `Deno.serve`:
```typescript
        let result: any;
        if (type === 'placement') {
            result = await handlePlacement(body, GEMINI_API_KEY_TALKS);
        } else if (type === 'speech') {
            result = await handleSpeech(body, GEMINI_API_KEY_TALKS);
        } else if (type === 'generate_lesson') {
            result = await handleGenerateLesson(body, GEMINI_API_KEY_TALKS);
        } else if (type === 'snehi_scorecard') {
            result = await handleSnehiScorecard(body, GEMINI_API_KEY_SNEHI);
        } else if (type === 'generate_custom_scenario') {
            result = await handleGenerateCustomScenario(body, GEMINI_API_KEY_SNEHI);
        }
```

---

## 3. Verification Plan

### Step 3.1: Deploy Edge Functions
Deploy the updated edge functions to Supabase:
```bash
supabase functions deploy coach-chat
supabase functions deploy scenario-chat
supabase functions deploy tts
supabase functions deploy evaluate
```

### Step 3.2: Verification Tests
1. **Talks Verification**:
   - Log in and start a Conversation in **Coach Chat**. Confirm responses are received.
   - Run a **Pronunciation Check** on a lesson card. Confirm speech evaluation finishes successfully.
   - Check the Google AI Studio console for the **Talks Key** to verify request counters are incrementing.
2. **Snehi Verification**:
   - Start **Scenario Practice** (chat turns).
   - Initiate a **Voice Coach** session (Gemini Live WebSocket session).
   - Check the Google AI Studio console for the **Snehi Key** to verify request counters are incrementing.
