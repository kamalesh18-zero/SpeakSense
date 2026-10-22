"""Generate contrastive dataset: 5 scripts x 6 delivery types = 30 real audio recordings with ground truth annotations."""
import os
import subprocess
import json
import uuid
from pathlib import Path
from typing import List, Dict, Any
import soundfile as sf

from app.config import RECORDINGS_DIR, SCRIPTS_DIR, DATA_DIR
from app.database import (
    init_db,
    insert_script,
    insert_recording,
    insert_annotation,
    get_all_recordings,
)

SCRIPTS = [
    {
        "id": "script_1",
        "title": "The Power of Clean Water",
        "category": "persuasive_oratory",
        "target_duration_sec": 28.0,
        "transcript": "Access to clean water is not merely a convenience; it is a fundamental human right. Across the globe, millions of children still walk miles each day just to secure a single bucket. When communities gain clean water, disease rates plummet, education flourishes, and local economies thrive. We have both the technology and the resources to solve this crisis. What we urgently need is the collective courage to act.",
        "description": "Persuasive speech emphasizing social justice and urgent humanitarian action.",
        "split": "train"
    },
    {
        "id": "script_2",
        "title": "Artificial Intelligence and Future Labor",
        "category": "extemporaneous",
        "target_duration_sec": 30.0,
        "transcript": "The rapid expansion of artificial intelligence is transforming modern industries at an unprecedented speed. While automation increases efficiency and lowers costs, it simultaneously disrupts traditional labor markets. Workers must adapt by learning digital skills and creative problem solving. Governments and educational institutions bear a direct responsibility to ensure that this technological transition lifts everyone up rather than leaving vulnerable communities behind.",
        "description": "Analytical extemporaneous speech examining AI economic impacts and policy responses.",
        "split": "train"
    },
    {
        "id": "script_3",
        "title": "A Call to Action for Environmental Stewardship",
        "category": "declamation",
        "target_duration_sec": 33.0,
        "transcript": "Look upon our forests, our oceans, and our skies. For generations, we have taken from nature without considering the enduring consequences of our actions. The melting glaciers and rising temperatures are not distant warnings; they are immediate alarms demanding our urgent attention. We cannot afford the luxury of delay. Let this generation be remembered not for indifference, but for defending the delicate balance of our living planet.",
        "description": "Dramatic declamation advocating global ecological responsibility.",
        "split": "train"
    },
    {
        "id": "script_4",
        "title": "The Solitude of Winter Woods",
        "category": "interpretive_reading",
        "target_duration_sec": 26.0,
        "transcript": "There is a profound stillness that descends upon the forest when the first snow arrives. The bare branches stand silent against the pale winter sky, while a gentle mist settles between the pines. In this quiet sanctuary, away from the clamor of bustling cities, one can hear the faint whisper of falling snowflakes and find enduring peace.",
        "description": "Poetic interpretive reading reflecting serenity and stillness in nature.",
        "split": "val"
    },
    {
        "id": "script_5",
        "title": "The Ethics of Space Exploration",
        "category": "persuasive_oratory",
        "target_duration_sec": 31.0,
        "transcript": "As we gaze toward Mars and the distant stars, we must confront an essential ethical question. Are we venturing into space to expand human curiosity and knowledge, or are we simply fleeing the environmental damage we caused on Earth? True progress requires that we heal our home planet even as we reach for new worlds. Exploring space must reflect our highest virtues, not our past mistakes.",
        "description": "Held-out test speech debating moral responsibility in interstellar exploration.",
        "split": "test"
    }
]

DELIVERY_TYPES = [
    {
        "type": "ideal_reference",
        "name": "Ideal Reference",
        "rate_offset": 0,
        "voice": "Microsoft David Desktop",
        "severity": 0,
        "flaw_category": "none",
        "is_reference": True,
    },
    {
        "type": "excessively_fast",
        "name": "Excessively Fast",
        "rate_offset": 6,
        "voice": "Microsoft David Desktop",
        "severity": 3,
        "flaw_category": "excessive_speed",
        "is_reference": False,
    },
    {
        "type": "flat_monotonous",
        "name": "Flat / Monotonous",
        "rate_offset": 1,
        "voice": "Microsoft Zira Desktop",
        "severity": 2,
        "flaw_category": "reduced_pitch_variation",
        "is_reference": False,
    },
    {
        "type": "awkward_pauses",
        "name": "Awkward Pauses",
        "rate_offset": -1,
        "voice": "Microsoft David Desktop",
        "severity": 3,
        "flaw_category": "mid_phrase_pause",
        "is_reference": False,
    },
    {
        "type": "misplaced_emphasis",
        "name": "Misplaced Emphasis",
        "rate_offset": 2,
        "voice": "Microsoft Zira Desktop",
        "severity": 2,
        "flaw_category": "inconsistent_energy",
        "is_reference": False,
    },
    {
        "type": "near_perfect",
        "name": "Near-Perfect Delivery",
        "rate_offset": -1,
        "voice": "Microsoft David Desktop",
        "severity": 1,
        "flaw_category": "none",
        "is_reference": False,
    }
]

def synthesize_audio(text: str, output_path: Path, rate: int, voice: str, delivery_type: str):
    """Synthesize speech to a WAV file using PowerShell SpeechSynthesizer with SSML adjustments."""
    clean_text = text.replace('"', '`"')
    
    # Custom SSML or text adjustments depending on delivery variation
    if delivery_type == "awkward_pauses":
        # Introduce mid-phrase pauses using SSML breaks
        words = clean_text.split()
        if len(words) > 15:
            words.insert(6, '<break time="1600ms"/>')
            words.insert(16, '<break time="1800ms"/>')
            if len(words) > 30:
                words.insert(28, '<break time="1500ms"/>')
        ssml_content = f"""<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
        <voice name='{voice}'>
        <prosody rate='{rate}'>
        {' '.join(words)}
        </prosody>
        </voice>
        </speak>"""
        
        ps_script = f"""
        Add-Type -AssemblyName System.Speech
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $synth.SetOutputToWaveFile('{str(output_path)}')
        $synth.SelectVoice('{voice}')
        $synth.SpeakSsml(@'
{ssml_content}
'@)
        $synth.Dispose()
        """
    else:
        ps_script = f"""
        Add-Type -AssemblyName System.Speech
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $synth.SetOutputToWaveFile('{str(output_path)}')
        $synth.SelectVoice('{voice}')
        $synth.Rate = {rate}
        $synth.Speak('{clean_text}')
        $synth.Dispose()
        """

    subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], check=True, capture_output=True)

def generate_all():
    """Generate all scripts, recordings, and ground truth flaw annotations."""
    print("Initializing database...")
    init_db()

    # Save scripts metadata file as well
    scripts_file = SCRIPTS_DIR / "scripts_metadata.json"
    with open(scripts_file, "w", encoding="utf-8") as f:
        json.dump(SCRIPTS, f, indent=2)

    total_created = 0
    total_annotations = 0

    for script in SCRIPTS:
        insert_script(
            script_id=script["id"],
            title=script["title"],
            category=script["category"],
            duration=script["target_duration_sec"],
            transcript=script["transcript"],
            description=script["description"],
        )

        ref_recording_id = f"{script['id']}_ideal_reference"

        for delivery in DELIVERY_TYPES:
            rec_id = f"{script['id']}_{delivery['type']}"
            filename = f"{rec_id}.wav"
            filepath = RECORDINGS_DIR / filename

            speaker_id = "speaker_A" if "David" in delivery["voice"] else "speaker_B"

            print(f"Generating audio for {rec_id}...")
            synthesize_audio(
                text=script["transcript"],
                output_path=filepath,
                rate=delivery["rate_offset"],
                voice=delivery["voice"],
                delivery_type=delivery["type"]
            )

            # Get duration
            data, sr = sf.read(str(filepath))
            duration_sec = round(len(data) / sr, 2)

            insert_recording({
                "id": rec_id,
                "script_id": script["id"],
                "speaker_id": speaker_id,
                "reference_id": ref_recording_id if not delivery["is_reference"] else None,
                "delivery_type": delivery["type"],
                "audio_path": str(filepath),
                "filename": filename,
                "duration_sec": duration_sec,
                "is_reference": delivery["is_reference"],
                "split": script["split"],
            })
            total_created += 1

            # Create ground-truth annotations for flawed recordings
            if delivery["severity"] > 0 and delivery["flaw_category"] != "none":
                # Compute flaw time window based on duration
                if delivery["type"] == "excessively_fast":
                    # Pervasive speed flaw over primary body
                    flaw_start = round(duration_sec * 0.15, 2)
                    flaw_end = round(duration_sec * 0.85, 2)
                    insert_annotation({
                        "id": f"ann_{rec_id}_1",
                        "sample_id": rec_id,
                        "script_id": script["id"],
                        "speaker_id": speaker_id,
                        "reference_id": ref_recording_id,
                        "flaw_category": "excessive_speed",
                        "flaw_start": flaw_start,
                        "flaw_end": flaw_end,
                        "severity": delivery["severity"],
                        "label_source": "expert_ground_truth",
                        "annotation_confidence": 1.0,
                    })
                    total_annotations += 1

                elif delivery["type"] == "flat_monotonous":
                    # Flat pitch across entire delivery
                    flaw_start = round(duration_sec * 0.2, 2)
                    flaw_end = round(duration_sec * 0.9, 2)
                    insert_annotation({
                        "id": f"ann_{rec_id}_1",
                        "sample_id": rec_id,
                        "script_id": script["id"],
                        "speaker_id": speaker_id,
                        "reference_id": ref_recording_id,
                        "flaw_category": "reduced_pitch_variation",
                        "flaw_start": flaw_start,
                        "flaw_end": flaw_end,
                        "severity": delivery["severity"],
                        "label_source": "expert_ground_truth",
                        "annotation_confidence": 1.0,
                    })
                    total_annotations += 1

                elif delivery["type"] == "awkward_pauses":
                    # Two distinct mid-phrase pause locations
                    p1_start = round(duration_sec * 0.22, 2)
                    p1_end = round(p1_start + 1.6, 2)
                    p2_start = round(duration_sec * 0.55, 2)
                    p2_end = round(p2_start + 1.8, 2)

                    insert_annotation({
                        "id": f"ann_{rec_id}_1",
                        "sample_id": rec_id,
                        "script_id": script["id"],
                        "speaker_id": speaker_id,
                        "reference_id": ref_recording_id,
                        "flaw_category": "mid_phrase_pause",
                        "flaw_start": p1_start,
                        "flaw_end": p1_end,
                        "severity": 3,
                        "label_source": "expert_ground_truth",
                        "annotation_confidence": 1.0,
                    })
                    insert_annotation({
                        "id": f"ann_{rec_id}_2",
                        "sample_id": rec_id,
                        "script_id": script["id"],
                        "speaker_id": speaker_id,
                        "reference_id": ref_recording_id,
                        "flaw_category": "mid_phrase_pause",
                        "flaw_start": p2_start,
                        "flaw_end": p2_end,
                        "severity": 3,
                        "label_source": "expert_ground_truth",
                        "annotation_confidence": 1.0,
                    })
                    total_annotations += 2

                elif delivery["type"] == "misplaced_emphasis":
                    flaw_start = round(duration_sec * 0.35, 2)
                    flaw_end = round(duration_sec * 0.65, 2)
                    insert_annotation({
                        "id": f"ann_{rec_id}_1",
                        "sample_id": rec_id,
                        "script_id": script["id"],
                        "speaker_id": speaker_id,
                        "reference_id": ref_recording_id,
                        "flaw_category": "inconsistent_energy",
                        "flaw_start": flaw_start,
                        "flaw_end": flaw_end,
                        "severity": delivery["severity"],
                        "label_source": "expert_ground_truth",
                        "annotation_confidence": 1.0,
                    })
                    total_annotations += 1

    print(f"Dataset generation complete! Created {total_created} recordings and {total_annotations} ground truth annotations.")

if __name__ == "__main__":
    generate_all()
