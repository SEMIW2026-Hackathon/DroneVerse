
import logging
import asyncio
import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from google import genai
from google.genai import types, errors

load_dotenv()

app = FastAPI(title="Droneverse Analysis")

logger = logging.getLogger("droneverse")
logging.basicConfig(level=logging.INFO)

MAX_IMAGE_SIZE = 10 * 1024 * 1024

ALLOWED_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

# Primary AI model
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

# Backup models, separated by commas in .env
FALLBACK_MODELS = [
    model.strip()
    for model in os.getenv(
        "GEMINI_FALLBACK_MODELS",
        "gemini-3.5-flash-lite",
    ).split(",")
    if model.strip()
]

# Temporary errors that should trigger model failover
RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "droneverse-analysis",
    }


@app.get("/ai/status")
def ai_status() -> dict:
    configured = bool(os.getenv("GEMINI_API_KEY"))

    return {
        "provider": "google-gemini",
        "configured": configured,
        "primary_model": MODEL,
        "fallback_models": FALLBACK_MODELS,
        "status": "ready" if configured else "missing_api_key",
    }


def analyze_with_gemini(
    image_bytes: bytes,
    mime_type: str,
    crop: str | None,
):
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError("Gemini API key is not configured.")

    client = genai.Client(api_key=api_key)

    prompt = f"""
You are assisting an agricultural crop-health assessment system.

Examine the supplied crop image carefully.
Crop supplied by user: {crop or "Unknown"}

Return ONLY valid JSON with these fields:
{{
  "crop": "identified crop or unknown",
  "condition": "healthy, suspected_disease, pest_damage, or unclear",
  "suspected_issue": "possible disease or issue",
  "visible_symptoms": ["list of visible symptoms"],
  "severity": "low, moderate, high, or undetermined",
  "confidence": "low, medium, or high",
  "recommended_next_steps": ["safe practical next steps"],
  "needs_expert_confirmation": true,
  "limitations": ["relevant uncertainties"]
}}

Important:
- Only describe symptoms actually visible in the image.
- Do not claim a disease is confirmed.
- If the image is unclear, say so.
- Do not recommend pesticide products, chemical mixtures,
  application rates, or spraying instructions.
- Always require expert confirmation before treatment decisions.
"""

    # Primary model followed by backup models
    models_to_try = [MODEL] + [
        model for model in FALLBACK_MODELS
        if model != MODEL
    ]

    last_error = None

    for model_name in models_to_try:

        try:
            logger.info(
                "Attempting crop analysis with model: %s",
                model_name,
            )

            response = client.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type=mime_type,
                    ),
                    prompt,
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )

            if not response.text:
                raise RuntimeError(
                    f"{model_name} returned an empty response."
                )

            assessment = json.loads(response.text)

            logger.info(
                "Crop analysis successful. Model used: %s",
                model_name,
            )

            return assessment, model_name

        except errors.APIError as exc:

            last_error = exc

            if exc.code not in RETRYABLE_STATUS_CODES:
                logger.exception(
                    "Non-retryable API error from model %s",
                    model_name,
                )
                raise

            logger.warning(
                "Model %s failed with HTTP %s. "
                "Attempting the next backup model.",
                model_name,
                exc.code,
            )

    if last_error:
        raise last_error

    raise RuntimeError("No Gemini models were configured.")


@app.post("/analyze/leaf")
async def analyze_leaf(
    image: UploadFile = File(...),
    crop: str | None = Form(default=None),
):

    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Upload a JPEG, PNG, or WebP image.",
        )

    image_bytes = await image.read(MAX_IMAGE_SIZE + 1)

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="The image is empty.",
        )

    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Image must be 10 MB or smaller.",
        )

    try:
        result, used_model = await asyncio.to_thread(
            analyze_with_gemini,
            image_bytes,
            image.content_type,
            crop,
        )

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail="AI returned an invalid assessment. Please retry.",
        )

    except Exception as exc:

        logger.exception("Gemini leaf analysis failed")

        if (
            isinstance(exc, RuntimeError)
            and str(exc) == "Gemini API key is not configured."
        ):
            raise HTTPException(
                status_code=503,
                detail=str(exc),
            )

        raise HTTPException(
            status_code=502,
            detail=(
                f"Crop image analysis failed: "
                f"{type(exc).__name__}. Check server logs."
            ),
        ) from exc

    return {
        "provider": "google-gemini",
        "model": used_model,
        "assessment_type": "preliminary_visual_assessment",
        "result": result,
        "safety_notice": (
            "This is an AI-generated preliminary assessment, "
            "not a confirmed diagnosis. Consult an agricultural "
            "expert before treatment."
        ),
    }
