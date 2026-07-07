from __future__ import annotations

from app.domain.workspaces.models import Workspace


def test_workspace_requires_only_name():
    ws = Workspace(name="Canal Curiosidades")
    assert ws.name == "Canal Curiosidades"
    assert ws.id
    assert ws.language == "es"
    assert ws.voice_rate == 1.0
    assert ws.enabled is True
    assert ws.safety_rules == {}
    assert ws.metadata == {}
    assert ws.created_at is not None
    assert ws.updated_at is not None


def test_workspace_accepts_all_fields():
    ws = Workspace(
        name="Reddit Stories ES",
        description="Historias de reddit narradas",
        platform="youtube",
        channel_ref="UC12345",
        language="es",
        target_format="shorts",
        default_voice="es-MX-DaliaNeural",
        voice_rate=1.1,
        subtitle_style="premium",
        visual_style="dramatic",
        music_profile="tense",
        prompt_template_id="tmpl-reddit-001",
        upload_schedule="daily-18:00",
        enabled=False,
        safety_rules={"no_medical_claims": True},
        monetization_policy="not-for-monetization",
        metadata={"notes": "test"},
    )
    assert ws.platform == "youtube"
    assert ws.enabled is False
    assert ws.safety_rules == {"no_medical_claims": True}


def test_workspace_round_trips_through_json():
    ws = Workspace(name="Misterio Shorts")
    raw = ws.model_dump_json()
    restored = Workspace.model_validate_json(raw)
    assert restored == ws
