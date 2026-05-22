import os
import json
import asyncio
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()


class LLMClient:
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENROUTER_API_KEY") or "dummy_key"
        base_url = os.getenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
        self.model = os.getenv("OPENAI_MODEL", "openai/gpt-4o-mini")
        self.client = AsyncOpenAI(base_url=base_url, api_key=api_key)

    async def chat(self, system: str, messages: list) -> dict:
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "system", "content": system}] + messages,
                temperature=0.7,
                max_tokens=1000,
            )
            return {"content": response.choices[0].message.content or ""}
        except Exception as e:
            print(f"LLM chat error: {e}")
            return {
                "content": (
                    "I'm having trouble reaching the AI right now. "
                    "Check your OpenRouter API key in ai-service/.env"
                )
            }

    async def chat_with_tools(self, system: str, messages: list, tools: list) -> dict:
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "system", "content": system}] + messages,
                tools=tools if tools else None,
                tool_choice="auto" if tools else None,
                temperature=0.7,
                max_tokens=1000,
            )
            message = response.choices[0].message

            if message.tool_calls:
                tool_call = message.tool_calls[0]
                args = tool_call.function.arguments
                if isinstance(args, str):
                    args = json.loads(args)
                return {
                    "tool_call": {
                        "name": tool_call.function.name,
                        "arguments": args,
                    },
                    "content": message.content or "",
                }

            return {"content": message.content or ""}
        except Exception as e:
            print(f"Tool calling failed: {e}, falling back")
            return await self.chat(system, messages)


llm_client = LLMClient()


async def get_ai_response(system_prompt: str, user_question: str) -> str:
    result = await llm_client.chat(
        system_prompt,
        [{"role": "user", "content": user_question}],
    )
    return result.get("content", "")


# Backward-compatible module-level helpers
async def chat_with_tools(system: str, messages: list, tools: list | None):
    return await llm_client.chat_with_tools(system, messages, tools or [])


async def chat(system: str, messages: list) -> str:
    result = await llm_client.chat(system, messages)
    return result.get("content", "")
