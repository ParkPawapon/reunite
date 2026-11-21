# Free matching provider research

## Selected provider, November 21, 2026

Cloudflare Workers AI runs [Gemma 4 26B A4B](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/) with text and vision through the [Chat Completions endpoint](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/). The adapter requests JSON Schema and validates the result before the suggestion can appear. It sends the two item photos inline from existing normalized WebP bytes.

Workers Free includes 10,000 Neurons per UTC day and stops requests when that allowance is exhausted. The app also caps dispatched comparisons at 10 per day across its database. Other projects using the same account can consume its allowance. Keep the account on Workers Free. An inference token cannot verify the plan and Workers Paid may incur charges. [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)

Cloudflare states that standard synchronous inference does not retain content after processing, subject to safety and legal exceptions, and that Workers AI content is not used to train models. Reunite uses the direct synchronous API. Follow [the deployment checks](MATCHING.md#cloudflare-workers-free-on-vercel) before enabling it. [Workers AI data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/)

## Earlier provider research

The following tradeoffs were recorded on November 16, 2026. Neither Groq nor Gemini is wired into the app.

## Evaluation candidate: GroqCloud Free + Qwen 3.8 27B

The official [vision documentation](https://console.groq.com/docs/vision) lists `qwen/qwen3.8-27b` for text/image input, including base64 images. A request can contain three images, so a lost/found comparison with two stored item photos fits. [Structured outputs](https://console.groq.com/docs/structured-outputs) lists this model as supporting strict JSON Schema, compatible with the existing assessment shape. This establishes API capabilities, not item-matching accuracy.

The published [Free Plan limits](https://console.groq.com/docs/rate-limits) list 30 requests/minute, 1,000 requests/day, 8,000 tokens/minute and 200,000 tokens/day. These are organization-wide limits; the account's Limits page is authoritative and limits can change. Input/output tokens count toward the combined allowance. Each image uses 2,048 input tokens according to the vision guide. Two photos therefore consume 4,096 input tokens before text, schema and output: 1,000 requests/day does not mean 1,000 photo comparisons/day. Even ignoring all text/output, the daily token allowance permits fewer than 49 two-image calls; actual capacity is lower. Long descriptions can exceed the minute allowance for a single request. Do not silently truncate evidence to fit.

[Billing FAQs](https://console.groq.com/docs/billing-faqs) separates the Free plan from the paid Developer plan; upgrading requires a payment method. For a zero-cost evaluation, keep the account on Free and do not enable paid upgrades or automatic paid-provider fallback. A key identifies the account but does not prove its billing tier. The application cannot guarantee zero provider charges if an operator supplies a key from a paid organization.

[Groq data controls](https://console.groq.com/docs/your-data) describe no default inference-content retention, with exceptions for persistence features, troubleshooting and abuse investigation. Usage metadata is retained. All customers can enable Zero Data Retention in account settings. Do not infer that the current account has enabled it, or that this establishes university privacy compliance.

**Production limitation:** the [model catalog](https://console.groq.com/docs/models) classifies Qwen 3.8 27B as Preview. Groq explicitly limits Preview models to evaluation and advises against production use because availability may change quickly. Recommend this candidate for a free pilot, not as a production-ready replacement. The current stable production list does not establish an equivalent generally available free vision alternative on Groq.

## Alternative: Gemini API Free + Gemini 3.5 Flash-Lite

The official [pricing table](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite) lists free input/output access, including image inputs, for `gemini-3.5-flash-lite`. Available free quotas depend on the project/model and should be checked in AI Studio; a fixed universal daily allowance is not assumed. This is API access, separate from a consumer Gemini subscription.

The [Unpaid Services terms](https://ai.google.dev/gemini-api/terms#data-use-unpaid) permit using submitted content and responses for product/model improvement, including human review. They instruct users not to submit sensitive, confidential or personal information. Report descriptions or photos of wallets/cards can contain such information even when account/profile fields are excluded. Use only fictional or suitably redacted evaluation examples unless the data policy has been resolved. The user's permission for inference processing is not treated as separate permission for product-improvement use. No Gemini submission was made.

## Before implementation and live evaluation

1. A Groq Free account/key is needed for the recommended pilot. The user should create/manage credentials directly in the provider console, verify the account's Free tier and desired data settings, then store a key privately on the server. Never paste it in chat. No Groq, Gemini or Google API key was found in the checked server environment/files; only presence booleans were inspected.
2. A Groq adapter must still be implemented and tested. The running app currently supports OpenAI only; setting `GROQ_API_KEY` alone will not enable it. Provider selection must be explicit and never fall back to paid OpenAI on quota exhaustion.
3. Free mode needs real distributed request/token reservations, pacing and quota-aware delays, separate from the existing USD ledger. Reusing fake USD reservations or letting zero-cost jobs bypass all limits would be misleading. Keep the existing ten-table limit by adding justified columns to the pair table through a new migration if this is implemented; do not rewrite applied migration 0007.
4. HTTP 429 should preserve queued work and wait for quota recovery. Reject unsupported/oversized input explicitly; do not claim every pair has been checked when only part of the queue fits a free quota.
5. Validate the provider contract with a real key, then measure precision/recall on labelled held-out item pairs/photos. The existing unit/integration/browser tests do not validate either candidate's model accuracy. The free Preview pilot does not remove the production reliability blocker.

No account was created, agreement accepted, billing method added, private environment changed, model downloaded, API request sent or provider switch implemented during this research step.
