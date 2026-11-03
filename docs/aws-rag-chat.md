# Portfolio guide: AWS Lambda + Groq GPT-OSS

The public site stays human-first. Its Ask panel calls a server-side API; the browser never receives the Groq API key. The AWS Lambda function retrieves the best matching passages from the checked portfolio corpus with BM25, sends only those passages plus the visitor's question to Groq GPT-OSS, and returns the answer with the retrieved passage IDs. The page resolves IDs against its own checked corpus and displays the original evidence links and caveats.

```text
Portfolio browser → API Gateway HTTP API → Lambda
                                          ├─ local BM25 retrieval over the 22 checked passages
                                          ├─ AWS Secrets Manager → Groq API key
                                          └─ Groq API → openai/gpt-oss-120b
```

This avoids a Bedrock Knowledge Base and a continuously running vector store. The AWS piece is still usage-based: Lambda, API Gateway, and the already-created secret's storage/read usage depend on your account and free allowances. Do not deploy until you have checked that your AWS account plan and remaining free usage cover these resources. This plan does not promise $0 if your account is on a paid plan or its free allowances are exhausted.

## Check the free-plan limits first

Groq documents a Free Plan for GPT-OSS with organization rate limits. Requests that exceed the free-plan rate limits return HTTP 429; the guide UI shows a retry-later message. Confirm your Groq organization is still on the Free tier and has access to `openai/gpt-oss-120b`. Do not upgrade it to a paid tier. [Groq model ID and pricing](https://console.groq.com/docs/model/openai/gpt-oss-120b) · [Groq rate limits](https://console.groq.com/docs/rate-limits) · [Groq billing FAQ](https://console.groq.com/docs/billing-faqs).

The AWS Builder student reward of 12 months is Skill Builder Premium; AWS service credits are a separate, earned reward. Neither guarantees a year of free hosting. [AWS Student Rewards](https://builder.aws.com/content/3I1qkUtKhwU6K1VaGkfYRwtbz3o).

## Prepare the RAG corpus

Run `npm run rag:export`. It regenerates `src/generated/corpus.json`, exports the checked passages to `backend/ask/corpus.json` for the Lambda retrieval function, and writes readable passage files to `backend/kb-data/`. Do not put the Groq key in the corpus, Amplify variables, or the public website.

When portfolio evidence changes, rerun the export and redeploy Lambda so that the backend retrieval corpus matches the site. The browser only shows citations for passage IDs that exist in its own corpus.

## Lambda and API setup

1. In the AWS console, confirm the account's plan, free usage, region, and whether the existing Groq secret incurs a monthly Secrets Manager charge. Set AWS Budgets alerts if available, but remember that alerts notify; they do not stop usage.
2. Confirm that your Groq account is on the Free Plan and its console identifies the secret key you stored in Secrets Manager. The secret can be a raw API key or JSON with `GROQ_API_KEY`, `groq_api_key`, or `apiKey`. Keep the secret name/ARN private as well.
3. In `backend/ask`, run `npm install --omit=dev`. Zip `index.mjs`, `corpus.json`, `package.json`, `package-lock.json`, and `node_modules` into the ZIP archive root.
4. Create a Node.js 22 Lambda function in the same AWS region as the secret. Upload the ZIP, set handler `index.handler`, timeout to 25 seconds, and reserved concurrency to 1. Keep the function outside a VPC unless you have an already-paid-for outbound internet path; Groq must be reachable over HTTPS.
5. Set environment variables `GROQ_API_SECRET_ID` to the existing secret's ARN/name, `GROQ_MODEL_ID=openai/gpt-oss-120b`, and `ALLOWED_ORIGIN=https://main.d3j3qw8xj45viu.amplifyapp.com`. Do not copy the secret value into Lambda environment variables.
6. Give the Lambda execution role CloudWatch Logs permissions and `secretsmanager:GetSecretValue` scoped to just the Groq secret ARN. It needs no Bedrock permissions. The function caches the key briefly in memory, sends no question or key to CloudWatch, caps input at 200 characters and generation at 240 tokens, and never uses Groq web-search/tools.
7. Create an API Gateway HTTP API with `POST /ask`, payload format 2.0, and the Lambda integration. Configure CORS for the exact Amplify origin, `POST, OPTIONS`, and `content-type`. Add a low route throttle. Throttling is best-effort, not an absolute cost cap.
8. Verify the endpoint from the site origin. Confirm replies cite matching passage IDs and that the site displays the correct checked source links. A question with no lexical match is declined before it reaches Groq.
9. Only after the AWS endpoint works and your AWS account's free limits are confirmed, set `VITE_ASK_API_URL` in Amplify to the API's HTTPS `/ask` URL and rebuild the site. Until then the Ask feature uses the existing local evidence search. Keep `content/aws-status.yaml` truthful; it currently does not claim this API is connected.

## Privacy and limits

Visitor questions and selected portfolio passages are sent to Groq for generation. The API does not store conversation history and returns only the answer and passage IDs. Lambda's request payload is not logged. Ask visitors not to enter sensitive personal information. Free-tier rate limits can make the guide temporarily unavailable; the site retains its local evidence search.

## References

- [Groq GPT-OSS model](https://console.groq.com/docs/model/openai/gpt-oss-120b)
- [Groq OpenAI-compatible chat completions](https://console.groq.com/docs/api-reference)
- [Groq rate limits](https://console.groq.com/docs/rate-limits)
- [AWS Lambda and Secrets Manager](https://docs.aws.amazon.com/lambda/latest/dg/with-secrets-manager.html)
- [AWS Free Tier FAQ](https://aws.amazon.com/free/free-tier-faqs/)
