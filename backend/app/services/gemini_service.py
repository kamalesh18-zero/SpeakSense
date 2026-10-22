"""Gemini AI Service for SpeakSense AI.
Provides speech generation, interactive coaching, and acoustic flaw diagnostics.
"""
import json
import logging
import re
from typing import Dict, Any, Optional, List
import httpx

from app.config import GEMINI_API_KEY

logger = logging.getLogger("speaksense.gemini")

# Model candidate priority list
GEMINI_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite"
]

async def call_gemini(
    prompt: str,
    system_instruction: Optional[str] = None,
    temperature: float = 0.7,
    timeout: float = 30.0
) -> str:
    """Call Google Gemini REST API using httpx with model fallback."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured.")

    contents = []
    if system_instruction:
        contents.append({"role": "user", "parts": [{"text": f"SYSTEM INSTRUCTION: {system_instruction}"}]})
        contents.append({"role": "model", "parts": [{"text": "Understood. I will act strictly according to this instruction."}]})

    contents.append({"role": "user", "parts": [{"text": prompt}]})

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": 1500
        }
    }

    last_error = None
    for model_name in GEMINI_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={GEMINI_API_KEY}"
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        text = "".join(p.get("text", "") for p in parts)
                        if text.strip():
                            return text.strip()
                elif res.status_code in [404, 503]:
                    logger.warning(f"Gemini model {model_name} returned {res.status_code}, trying fallback...")
                    continue
                else:
                    logger.error(f"Gemini API error ({model_name}): {res.status_code} - {res.text[:200]}")
                    last_error = f"API error {res.status_code}: {res.text[:200]}"
        except Exception as e:
            logger.warning(f"Gemini model {model_name} failed: {e}")
            last_error = str(e)
            continue

    raise RuntimeError(f"Gemini API failed across all fallback models. Last error: {last_error}")


async def generate_speech_script(
    topic: str,
    category: str = "persuasive_oratory",
    duration_seconds: int = 45,
    tone: str = "inspiring"
) -> Dict[str, Any]:
    """Generate a competitive speech transcript on any given topic."""
    category_labels = {
        "persuasive_oratory": "Persuasive Oratory (rhetorical climaxes, balanced cadence, vivid arguments)",
        "declamation": "Declamation (dramatic conviction, resonance, controlled emotional power)",
        "extemporaneous": "Extemporaneous Speech (analytical, logical progression, evidence-backed clarity)",
        "interpretive_reading": "Interpretive Reading (lyrical phrasing, intentional expressive pauses)",
        "impromptu": "Impromptu Oratory (spontaneous, structured hook-story-lesson delivery)"
    }
    cat_desc = category_labels.get(category, "Public Speaking Competition")

    target_word_count = int((duration_seconds / 60.0) * 140)
    target_word_count = max(40, min(300, target_word_count))

    system_prompt = (
        "You are an elite speechwriting coach for collegiate and national speech competitions. "
        "You craft spoken scripts specifically optimized for spoken delivery, vocal variety, and crisp phrasing. "
        "Always return strictly valid JSON matching the requested structure."
    )

    user_prompt = f"""Write an outstanding speech for competition on the topic: "{topic}".
Category: {cat_desc}
Tone: {tone}
Target spoken duration: {duration_seconds} seconds (approx. {target_word_count} words at 140 WPM).

Requirements:
1. High impact opening hook.
2. Memorable rhetorical devices (such as antithesis, rule of three, or anaphora).
3. Clear punctuation designed for breath-supported pauses (commas, em-dashes, periods).
4. Estimated speaking pace of ~135-150 WPM.

Return your response ONLY as a valid JSON object without markdown formatting:
{{
  "title": "A captivating 3-6 word title",
  "category": "{category}",
  "estimated_duration_sec": {duration_seconds},
  "estimated_wpm": 142,
  "transcript": "The full clean speech text for the speaker to read...",
  "pause_markers": ["List 2-4 key spots where deliberate pauses should be taken, e.g. After 'not with silence, but with action' [0.8s]"],
  "emphasis_words": ["3-5 specific words that should receive higher vocal energy or pitch lift"],
  "coaching_tips": [
    "Tip 1: vocal pacing advice",
    "Tip 2: pause advice",
    "Tip 3: pitch variation advice"
  ]
}}
"""

    response_text = await call_gemini(user_prompt, system_instruction=system_prompt, temperature=0.7)
    
    # Clean json fences if present
    cleaned = re.sub(r"^```json\s*", "", response_text, flags=re.MULTILINE)
    cleaned = re.sub(r"^```\s*", "", cleaned, flags=re.MULTILINE).strip()
    
    try:
        data = json.loads(cleaned)
        return data
    except Exception:
        # Fallback extraction if JSON parsing was imperfect
        title_match = re.search(r'"title"\s*:\s*"([^"]+)"', response_text)
        transcript_match = re.search(r'"transcript"\s*:\s*"([^"]+)"', response_text)
        return {
            "title": title_match.group(1) if title_match else f"{topic.title()} Speech",
            "category": category,
            "estimated_duration_sec": duration_seconds,
            "estimated_wpm": 140,
            "transcript": transcript_match.group(1) if transcript_match else response_text,
            "pause_markers": ["Pause at transition moments", "Hold 0.8s at major punctuation"],
            "emphasis_words": ["action", "future", "transform"],
            "coaching_tips": [
                "Keep pacing between 130 and 160 WPM.",
                "Do not rush through the conclusion.",
                "Lift your pitch on questions to maintain audience engagement."
            ]
        }


async def ask_coach_ai(
    user_question: str,
    context: Optional[str] = None
) -> Dict[str, Any]:
    """Ask Alex the Speech Coach a question about delivery, flaws, or practice."""
    system_prompt = (
        "You are Alex, a supportive, highly knowledgeable, and friendly AI speech coach at SpeakSense AI. "
        "You give encouraging, practical, and acoustically grounded vocal advice in 2-3 concise paragraphs. "
        "Always end with one concrete, 30-second physical vocal drill the speaker can try right now."
    )

    user_prompt = f"""The speaker asks: "{user_question}"
Context: {context or "General public speaking and speech competition preparation"}

Provide your coaching response in JSON format:
{{
  "coach_name": "Alex",
  "advice": "Your warm, practical advice directly answering the question in 2-3 short paragraphs...",
  "key_takeaway": "One punchy sentence summarizing the core lesson.",
  "quick_drill": "Name and brief instructions for a 30-second action drill to practice immediately."
}}
"""

    response_text = await call_gemini(user_prompt, system_instruction=system_prompt, temperature=0.6)
    cleaned = re.sub(r"^```json\s*", "", response_text, flags=re.MULTILINE)
    cleaned = re.sub(r"^```\s*", "", cleaned, flags=re.MULTILINE).strip()

    try:
        return json.loads(cleaned)
    except Exception:
        return {
            "coach_name": "Alex",
            "advice": response_text,
            "key_takeaway": "Focus on steady breath support and intentional pauses.",
            "quick_drill": "Breathe in for 4 seconds, then speak one full sentence evenly while exhaling."
        }


async def diagnose_flaws_ai(
    acoustic_metrics: Dict[str, Any]
) -> Dict[str, Any]:
    """Generate an AI Flaw Doctor report based on real acoustic measurements."""
    system_prompt = (
        "You are the SpeakSense AI Flaw Doctor, an audio signal processing and vocal performance specialist. "
        "You analyze real mathematical acoustic measurements (WPM, pause violations, pitch semitone standard deviation, "
        "energy drop in dB, SNR) and explain the physiological and acoustic causes, avoiding vague platitudes."
    )

    user_prompt = f"""Analyze these acoustic measurements from a speaker's delivery:
Measurements:
{json.dumps(acoustic_metrics, indent=2)}

Generate a Flaw Doctor diagnosis in JSON format:
{{
  "overall_summary": "Executive diagnosis of the delivery (2-3 sentences)",
  "primary_flaw_analysis": {{
    "name": "The single most impactful flaw (e.g. Mid-Sentence Pause Violations / Monotone Frequency / Rushed Cadence)",
    "acoustic_evidence": "Explain the exact numbers that prove this flaw",
    "root_cause": "The physiological reason (e.g., shallow chest breathing, lack of breath planning)",
    "audience_perception": "How this sounds to a human judge or audience"
  }},
  "actionable_drills": [
    {{
      "name": "Name of Drill 1",
      "duration": "1 minute",
      "instruction": "Step-by-step physical instruction"
    }},
    {{
      "name": "Name of Drill 2",
      "duration": "2 minutes",
      "instruction": "Step-by-step physical instruction"
    }}
  ],
  "score_potential": "Estimated points (+5 to +15) gainable on next attempt by fixing these issues"
}}
"""

    response_text = await call_gemini(user_prompt, system_instruction=system_prompt, temperature=0.5)
    cleaned = re.sub(r"^```json\s*", "", response_text, flags=re.MULTILINE)
    cleaned = re.sub(r"^```\s*", "", cleaned, flags=re.MULTILINE).strip()

    try:
        return json.loads(cleaned)
    except Exception:
        return {
            "overall_summary": "Your speech exhibits clear articulation but would benefit from improved pause placement and dynamic pitch modulation.",
            "primary_flaw_analysis": {
                "name": "Pacing and Mid-Phrase Pause Control",
                "acoustic_evidence": f"WPM: {acoustic_metrics.get('wpm', 155)}, Pauses: {acoustic_metrics.get('total_pauses', 4)}",
                "root_cause": "Running low on breath before completing grammatical clauses.",
                "audience_perception": "Creates an impression of hesitation or uncertainty."
            },
            "actionable_drills": [
                {
                    "name": "Breath Stacking Drill",
                    "duration": "1 minute",
                    "instruction": "Inhale fully before each sentence and speak only on the exhale."
                }
            ],
            "score_potential": "+8 to +12 points"
        }


async def polish_speech_transcript(
    raw_text: str
) -> Dict[str, Any]:
    """Polish a draft speech with rhetorical devices and cadence optimization."""
    system_prompt = (
        "You are an oratorical editor. Enhance the given text for spoken delivery without changing its core message. "
        "Make sentences flow smoothly and add natural vocal rhythm."
    )

    user_prompt = f"""Enhance this speech draft for verbal recitation:
Draft:
{raw_text}

Return JSON:
{{
  "polished_text": "Enhanced speech text...",
  "enhancements_made": [
    "Brief note on enhancement 1",
    "Brief note on enhancement 2"
  ],
  "estimated_duration_sec": 40
}}
"""

    response_text = await call_gemini(user_prompt, system_instruction=system_prompt, temperature=0.6)
    cleaned = re.sub(r"^```json\s*", "", response_text, flags=re.MULTILINE)
    cleaned = re.sub(r"^```\s*", "", cleaned, flags=re.MULTILINE).strip()

    try:
        return json.loads(cleaned)
    except Exception:
        return {
            "polished_text": raw_text,
            "enhancements_made": ["Retained original draft."],
            "estimated_duration_sec": 35
        }
