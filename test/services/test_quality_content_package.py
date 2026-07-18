"""Unit tests for the Spanish Content Package generator (Fase 7).

Pure/stdlib, fully deterministic: works with a manually pasted script and
without any LLM/API key. An optional ``llm_metadata`` dict can override the
deterministic title/description/hashtags when a provider is available.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.quality import content_package as cp


SCRIPT = (
    "La programación en español es cada vez más popular. "
    "Aprender a programar abre muchas puertas laborales. "
    "Con práctica y constancia, cualquiera puede lograrlo."
)


class TestKeywordExtraction(unittest.TestCase):
    def test_removes_stopwords_and_short_tokens(self):
        kws = cp.extract_keywords("la casa y el árbol son grandes", limit=10)
        self.assertNotIn("la", kws)
        self.assertNotIn("y", kws)
        self.assertIn("casa", kws)
        self.assertIn("árbol", kws)

    def test_orders_by_frequency_then_first_seen(self):
        kws = cp.extract_keywords("perro gato perro gato perro pájaro", limit=3)
        self.assertEqual(kws[0], "perro")  # most frequent first
        self.assertEqual(kws[1], "gato")

    def test_respects_limit(self):
        kws = cp.extract_keywords(SCRIPT, limit=2)
        self.assertEqual(len(kws), 2)

    def test_preserves_spanish_accents_in_keywords(self):
        kws = cp.extract_keywords("canción melodía canción", limit=5)
        self.assertIn("canción", kws)


class TestScenes(unittest.TestCase):
    def test_splits_into_sentences(self):
        scenes = cp.split_scenes(SCRIPT)
        self.assertEqual(len(scenes), 3)

    def test_empty_script_yields_no_scenes(self):
        self.assertEqual(cp.split_scenes("   "), [])


class TestHashtags(unittest.TestCase):
    def test_hashtags_are_ascii_normalized(self):
        tags = cp.build_hashtags(["programación", "canción"], "", "shorts", limit=12)
        self.assertIn("#programacion", tags)
        self.assertIn("#cancion", tags)
        # no spaces or accents leak into a tag
        for tag in tags:
            self.assertTrue(tag.startswith("#"))
            self.assertNotIn(" ", tag)

    def test_includes_platform_tag(self):
        tags = cp.build_hashtags(["x"], "", "tiktok", limit=12)
        self.assertIn("#tiktok", tags)

    def test_deduplicates_and_respects_limit(self):
        tags = cp.build_hashtags(["a", "a", "b", "c", "d", "e"], "a", "shorts", limit=4)
        self.assertEqual(len(tags), len(set(tags)))
        self.assertLessEqual(len(tags), 4)


class TestBuildPackage(unittest.TestCase):
    def test_deterministic_package_from_subject_and_script(self):
        pkg = cp.build_content_package(
            subject="Programar en español",
            script=SCRIPT,
            keywords=["programación", "empleo"],
            platform="shorts",
        )
        self.assertEqual(pkg.title, "Programar en español")
        self.assertTrue(pkg.hook)
        self.assertTrue(pkg.summary)
        self.assertTrue(pkg.hashtags)
        self.assertEqual(len(pkg.scene_keywords), 3)  # one per scene
        self.assertIn("Programar en español", pkg.thumbnail_prompt)
        self.assertTrue(pkg.review_checklist)

    def test_works_without_subject_using_script(self):
        pkg = cp.build_content_package(subject="", script=SCRIPT, platform="reels")
        self.assertTrue(pkg.title)  # derived from script
        self.assertTrue(pkg.hashtags)

    def test_is_deterministic(self):
        a = cp.build_content_package(subject="Tema", script=SCRIPT)
        b = cp.build_content_package(subject="Tema", script=SCRIPT)
        self.assertEqual(cp.package_to_dict(a), cp.package_to_dict(b))

    def test_llm_metadata_overrides_deterministic_fields(self):
        pkg = cp.build_content_package(
            subject="Tema",
            script=SCRIPT,
            llm_metadata={
                "title": "Título LLM",
                "caption": "Descripción generada por LLM",
                "hashtags": ["#ia", "#contenido"],
            },
        )
        self.assertEqual(pkg.title, "Título LLM")
        self.assertIn("Descripción generada por LLM", pkg.description)
        self.assertEqual(pkg.hashtags, ["#ia", "#contenido"])

    def test_serialization_roundtrip_keys(self):
        pkg = cp.build_content_package(subject="Tema", script=SCRIPT)
        data = cp.package_to_dict(pkg)
        for key in (
            "title",
            "hook",
            "summary",
            "description",
            "hashtags",
            "scene_keywords",
            "thumbnail_prompt",
            "review_checklist",
        ):
            self.assertIn(key, data)
        md = cp.package_to_markdown(pkg)
        self.assertIn("Tema", md)
        self.assertIn("#", md)  # hashtags section


if __name__ == "__main__":
    unittest.main()
