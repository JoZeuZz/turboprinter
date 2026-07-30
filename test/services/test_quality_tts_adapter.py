"""Unit tests for the TTS adapter + word-timestamp alignment (Fase 4).

Pure/stdlib: no edge_tts / faster_whisper / moviepy. The edge_tts SubMaker and
the whisper aligner are represented by lightweight fakes, so the normalization,
extraction and alignment-fallback logic is fully testable here.
"""

import sys
import types
import unittest
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.quality import tts_adapter as tts


class TestNormalizeWordTimestamps(unittest.TestCase):
    def test_accepts_tuples_and_dicts(self):
        raw = [("Hola", 0.0, 0.5), {"word": "mundo", "start": 0.5, "end": 1.0}]
        wt = tts.normalize_word_timestamps(raw)
        self.assertEqual([w.word for w in wt], ["Hola", "mundo"])
        self.assertEqual(wt[1].start, 0.5)

    def test_accepts_text_key_alias(self):
        wt = tts.normalize_word_timestamps([{"text": "hola", "start": 0, "end": 1}])
        self.assertEqual(wt[0].word, "hola")

    def test_drops_empty_words_and_sorts_by_start(self):
        raw = [("b", 1.0, 1.5), ("", 0.0, 0.2), ("a", 0.0, 0.4)]
        wt = tts.normalize_word_timestamps(raw)
        self.assertEqual([w.word for w in wt], ["a", "b"])

    def test_swaps_reversed_start_end(self):
        wt = tts.normalize_word_timestamps([("x", 1.0, 0.5)])
        self.assertLessEqual(wt[0].start, wt[0].end)


class TestSubMakerExtraction(unittest.TestCase):
    def test_extracts_from_cues_in_seconds(self):
        cue = types.SimpleNamespace(
            text="Hola", start=timedelta(seconds=0.2), end=timedelta(seconds=0.6)
        )
        sub_maker = types.SimpleNamespace(cues=[cue])
        wt = tts.extract_word_timestamps_from_submaker(sub_maker)
        self.assertEqual(len(wt), 1)
        self.assertAlmostEqual(wt[0].start, 0.2)
        self.assertAlmostEqual(wt[0].end, 0.6)

    def test_extracts_from_legacy_subs_offset_in_100ns_units(self):
        # offsets are edge_tts 100-nanosecond units: 5_000_000 == 0.5s
        sub_maker = types.SimpleNamespace(
            cues=[], subs=["Hola", "mundo"], offset=[(0, 5_000_000), (5_000_000, 10_000_000)]
        )
        wt = tts.extract_word_timestamps_from_submaker(sub_maker)
        self.assertEqual([w.word for w in wt], ["Hola", "mundo"])
        self.assertAlmostEqual(wt[0].end, 0.5)
        self.assertAlmostEqual(wt[1].end, 1.0)

    def test_returns_empty_when_no_timing_info(self):
        self.assertEqual(tts.extract_word_timestamps_from_submaker(None), [])
        self.assertEqual(
            tts.extract_word_timestamps_from_submaker(types.SimpleNamespace()), []
        )


class TestTTSResult(unittest.TestCase):
    def test_build_and_has_word_timestamps(self):
        result = tts.build_tts_result(
            audio_file="/a.mp3", duration=3.0, provider="edge"
        )
        self.assertFalse(tts.has_word_timestamps(result))
        result2 = tts.build_tts_result(
            audio_file="/a.mp3",
            duration=3.0,
            provider="edge",
            word_timestamps=[tts.WordTimestamp("hola", 0.0, 0.5)],
        )
        self.assertTrue(tts.has_word_timestamps(result2))

    def test_provider_protocol_is_structural(self):
        class DummyProvider:
            def synthesize(self, text, voice, rate, output_file, **kwargs):
                return tts.build_tts_result(output_file, 1.0, "dummy")

        self.assertIsInstance(DummyProvider(), tts.TTSProvider)

    def test_serialization_roundtrip(self):
        result = tts.build_tts_result(
            "/a.mp3", 2.0, "edge",
            word_timestamps=[tts.WordTimestamp("hola", 0.0, 0.5)],
            metadata={"voice": "es-ES"},
        )
        data = tts.result_to_dict(result)
        self.assertEqual(data["provider"], "edge")
        self.assertEqual(data["word_timestamps"][0]["word"], "hola")
        self.assertEqual(data["metadata"]["voice"], "es-ES")


class TestAlignmentFallback(unittest.TestCase):
    def _fake_aligner(self, audio_file):
        return [("uno", 0.0, 0.3), ("dos", 0.3, 0.7)]

    def test_align_with_transcriber_normalizes_output(self):
        wt = tts.align_with_transcriber("/a.mp3", self._fake_aligner)
        self.assertEqual([w.word for w in wt], ["uno", "dos"])

    def test_ensure_keeps_existing_timestamps_without_calling_aligner(self):
        calls = []

        def aligner(audio_file):
            calls.append(audio_file)
            return [("x", 0.0, 1.0)]

        result = tts.build_tts_result(
            "/a.mp3", 1.0, "edge",
            word_timestamps=[tts.WordTimestamp("ya", 0.0, 0.5)],
        )
        out = tts.ensure_word_timestamps(result, "/a.mp3", aligner=aligner)
        self.assertEqual(out.word_timestamps[0].word, "ya")
        self.assertEqual(calls, [])  # aligner not invoked

    def test_ensure_fills_missing_timestamps_via_aligner(self):
        result = tts.build_tts_result("/a.mp3", 1.0, "edge")
        out = tts.ensure_word_timestamps(result, "/a.mp3", aligner=self._fake_aligner)
        self.assertTrue(tts.has_word_timestamps(out))
        self.assertEqual(out.word_timestamps[0].word, "uno")

    def test_ensure_without_aligner_is_clean_fallback(self):
        result = tts.build_tts_result("/a.mp3", 1.0, "edge")
        out = tts.ensure_word_timestamps(result, "/a.mp3", aligner=None)
        self.assertFalse(tts.has_word_timestamps(out))


if __name__ == "__main__":
    unittest.main()
